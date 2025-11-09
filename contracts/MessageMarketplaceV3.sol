// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MessageMarketplaceV3 is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    using ECDSA for bytes32;

    // V2 Storage Layout (must be maintained for compatibility)
    ERC20Upgradeable public usdc;
    address public systemFeeAddress;
    uint256 public feePercentage;
    uint256 public constant BASIS_POINTS = 10000;

    struct Message {
        address creator;
        uint256 price;
        uint256 expireAt;
    }

    struct Purchase {
        uint256 timestamp;
        uint256 price;
    }

    mapping(bytes32 => Message) public messages;
    mapping(bytes32 => mapping(address => Purchase)) public messagePurchases;

    struct FiatPurchase {
        uint256 timestamp;
        uint256 price;
        bytes32 purchaseHash;
        bytes32 backendValidationHash;
    }

    mapping(bytes32 => FiatPurchase) public fiatPurchases;

    // V3 New Storage (added after existing storage)
    mapping(address => bool) public signers;
    mapping(bytes32 => mapping(address => bool)) public offchainPurchases; // messageHash => buyer => purchased

    // V3 Events
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event MessagePurchased(
        bytes32 indexed messageId, 
        address indexed buyer, 
        address indexed seller, 
        uint256 amount, 
        address token,
        uint256 chainId
    );
    event FeePercentageUpdated(uint256 oldFee, uint256 newFee);
    event SystemFeeAddressUpdated(address oldAddress, address newAddress);
    event USDCAddressUpdated(address oldAddress, address newAddress);

    // V2 Events (maintained for compatibility)
    event MessageCreated(bytes32 indexed messageId, address indexed seller, uint256 price, uint256 expireAt);
    event MessagePurchasedByFiat(bytes32 indexed messageId, address indexed buyer, uint256 amount, uint256 timestamp, bytes32 backendValidationHash);

    // Modifiers
    modifier onlySigner() {
        require(signers[msg.sender], "Not authorized signer");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _usdcAddress,
        address _systemFeeAddress,
        uint256 _feePercentage
    ) public initializer {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_systemFeeAddress != address(0), "Invalid system fee address");
        require(_feePercentage <= BASIS_POINTS, "Fee percentage too high");

        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        usdc = ERC20Upgradeable(_usdcAddress);
        systemFeeAddress = _systemFeeAddress;
        feePercentage = _feePercentage;
    }

    /**
     * @dev Add a new signer to the allowlist
     * @param signer The address to add as a signer
     */
    function addSigner(address signer) external onlyOwner {
        require(signer != address(0), "Invalid signer address");
        require(!signers[signer], "Signer already exists");
        
        signers[signer] = true;
        emit SignerAdded(signer);
    }

    /**
     * @dev Remove a signer from the allowlist
     * @param signer The address to remove as a signer
     */
    function removeSigner(address signer) external onlyOwner {
        require(signers[signer], "Signer does not exist");
        
        signers[signer] = false;
        emit SignerRemoved(signer);
    }


    /**
     * @dev Purchase message using ERC-20 token with off-chain signature
     * @param messageId The unique message identifier
     * @param seller The address of the message seller
     * @param token The ERC-20 token address
     * @param amount The amount to pay (in token units)
     * @param deadline The deadline for the signature validity
     * @param signature The EIP-191 signature from backend
     */
    function purchaseOffchainMessage(
        bytes32 messageId,
        address seller,
        address token,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        require(block.timestamp <= deadline, "Signature expired");
        require(token != address(0), "Invalid token address");
        require(seller != address(0), "Invalid seller address");
        require(amount > 0, "Amount must be greater than 0");

        // Rebuild hash exactly as backend did (including token)
        bytes32 dataHash = keccak256(abi.encode(
            messageId,
            seller,
            token,
            amount,
            deadline
        ));

        // Convert to EIP-191 signed message hash
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        address signer = ECDSA.recover(ethHash, signature);
        require(signers[signer], "Invalid signature");

        // Calculate fees
        uint256 feeAmount = (amount * feePercentage) / BASIS_POINTS;
        uint256 sellerAmount = amount - feeAmount;

        IERC20 tokenContract = IERC20(token);

        // Transfer token from buyer to contract
        require(tokenContract.transferFrom(msg.sender, address(this), amount), "Token transfer failed");

        // Transfer fee to system address
        if (feeAmount > 0) {
            require(tokenContract.transfer(systemFeeAddress, feeAmount), "Fee transfer failed");
        }

        // Transfer remaining amount to seller
        if (sellerAmount > 0) {
            require(tokenContract.transfer(seller, sellerAmount), "Seller transfer failed");
        }

        // Mark as purchased in offchain purchases mapping using message hash
        offchainPurchases[keccak256(abi.encodePacked(messageId, seller, token, amount))][msg.sender] = true;

        emit MessagePurchased(messageId, msg.sender, seller, amount, token, block.chainid);
    }

    /**
     * @dev Update the system fee address
     * @param _newFeeAddress The new fee address
     */
    function updateSystemFeeAddress(address _newFeeAddress) external onlyOwner {
        require(_newFeeAddress != address(0), "Invalid fee address");
        address oldAddress = systemFeeAddress;
        systemFeeAddress = _newFeeAddress;
        emit SystemFeeAddressUpdated(oldAddress, _newFeeAddress);
    }

    /**
     * @dev Update the fee percentage
     * @param _newFeePercentage The new fee percentage (in basis points)
     */
    function updateFeePercentage(uint256 _newFeePercentage) external onlyOwner {
        require(_newFeePercentage <= BASIS_POINTS, "Fee percentage too high");
        uint256 oldFee = feePercentage;
        feePercentage = _newFeePercentage;
        emit FeePercentageUpdated(oldFee, _newFeePercentage);
    }

    /**
     * @dev Update the USDC token address
     * @param _newUSDCAddress The new USDC token address
     */
    function updateUSDCAddress(address _newUSDCAddress) external onlyOwner {
        require(_newUSDCAddress != address(0), "Invalid USDC address");
        address oldAddress = address(usdc);
        usdc = ERC20Upgradeable(_newUSDCAddress);
        emit USDCAddressUpdated(oldAddress, _newUSDCAddress);
    }

    /**
     * @dev Check if an address is an authorized signer
     * @param signer The address to check
     * @return True if the address is an authorized signer
     */
    function isSigner(address signer) external view returns (bool) {
        return signers[signer];
    }

    /**
     * @dev Check if a message has been purchased offchain by a specific buyer
     * @param messageId The message ID to check
     * @param seller The seller address
     * @param token The token address
     * @param amount The amount
     * @param buyer The buyer address to check
     * @return True if the message has been purchased by the buyer
     */
    function hasPurchasedOffchain(
        bytes32 messageId, 
        address seller, 
        address token, 
        uint256 amount, 
        address buyer
    ) external view returns (bool) {
        return offchainPurchases[keccak256(abi.encodePacked(messageId, seller, token, amount))][buyer];
    }

    /**
     * @dev Check if a fiat purchase exists using V3 parameters
     * @param messageId The message ID
     * @param creator The creator address
     * @param amount The amount paid
     * @param web2UserId The web2 user identifier
     * @param validationHash The validation hash from backend
     * @param timestamp The timestamp when the purchase was made
     * @return True if the fiat purchase exists
     */
    function hasPurchasedByFiatV3(
        bytes32 messageId,
        address creator,
        uint256 amount,
        bytes32 web2UserId,
        bytes32 validationHash,
        uint256 timestamp
    ) external view returns (bool) {
        bytes32 purchaseHash = keccak256(abi.encode(
            messageId,
            creator,
            amount,
            web2UserId,
            validationHash,
            timestamp
        ));
        return fiatPurchases[purchaseHash].timestamp > 0;
    }

    /**
     * @dev Get the current fee configuration
     * @return systemFeeAddress The current system fee address
     * @return feePercentage The current fee percentage
     */
    function getFeeConfiguration() external view returns (address, uint256) {
        return (systemFeeAddress, feePercentage);
    }

    /**
     * @dev Emergency function to withdraw stuck ERC-20 tokens
     * @param token The ERC-20 token address
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        IERC20(token).transfer(msg.sender, amount);
    }

    // V2 View Functions (maintained for compatibility)
    function hasPurchasedMessage(bytes32 messageId, address buyer) external view returns (bool) {
        return messagePurchases[messageId][buyer].timestamp > 0;
    }

    function hasPurchasedMessageByFiat(bytes32 purchaseHash) external view returns (bool) {
        return fiatPurchases[purchaseHash].timestamp > 0;
    }

    function getFiatPurchaseDetails(bytes32 purchaseHash) external view returns (FiatPurchase memory) {
        return fiatPurchases[purchaseHash];
    }

    function getMessage(bytes32 messageId) external view returns (Message memory) {
        return messages[messageId];
    }

    /**
     * @dev Disable the old message creation and purchase flow
     * These functions are overridden to prevent usage of the old flow
     */
    function createMessage(
        bytes32 messageId,
        uint256 price,
        uint256 expireAt
    ) external pure {
        revert("V2 function disabled - use off-chain flow");
    }

    function purchaseMessage(bytes32 messageId) external pure {
        revert("V2 function disabled - use off-chain flow");
    }

    /**
     * @dev Purchase message by fiat with off-chain signature (V3 implementation)
     * @param messageId The unique message identifier
     * @param creator The address of the message creator/seller
     * @param amount The amount paid in fiat
     * @param web2UserId The web2 user identifier
     * @param validationHash The validation hash from backend
     * @param deadline The deadline for the signature validity
     * @param signature The EIP-191 signature from backend
     */
    function purchaseMessageByFiat(
        bytes32 messageId,
        address creator,
        uint256 amount,
        bytes32 web2UserId,
        bytes32 validationHash,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        require(block.timestamp <= deadline, "Signature expired");
        require(creator != address(0), "Invalid creator address");
        require(amount > 0, "Amount must be greater than 0");
        require(messageId != bytes32(0), "Invalid message ID");

        // Rebuild hash exactly as backend did (including creator)
        bytes32 dataHash = keccak256(abi.encode(
            messageId,
            creator,
            amount,
            web2UserId,
            validationHash,
            deadline
        ));

        // Convert to EIP-191 signed message hash
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        address signer = ECDSA.recover(ethHash, signature);
        require(signers[signer], "Invalid signature");

        // Calculate fees (same as V2 logic)
        uint256 feeAmount = (amount * feePercentage) / BASIS_POINTS;
        uint256 creatorAmount;
        unchecked {
            creatorAmount = amount - feeAmount;
        }

        // Transfer USDC from buyer to contract (same as V2)
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");

        // Transfer fee to system address
        if (feeAmount > 0) {
            require(usdc.transfer(systemFeeAddress, feeAmount), "Fee transfer failed");
        }

        // Transfer remaining amount to creator
        if (creatorAmount > 0) {
            require(usdc.transfer(creator, creatorAmount), "Creator transfer failed");
        }

        // Create purchase hash for tracking
        bytes32 purchaseHash = keccak256(abi.encode(
            messageId,
            creator,
            amount,
            web2UserId,
            validationHash,
            block.timestamp
        ));

        // Store fiat purchase details
        fiatPurchases[purchaseHash] = FiatPurchase({
            timestamp: block.timestamp,
            price: amount,
            purchaseHash: purchaseHash,
            backendValidationHash: validationHash
        });

        emit MessagePurchasedByFiat(messageId, msg.sender, amount, block.timestamp, validationHash);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
