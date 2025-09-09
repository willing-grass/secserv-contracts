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

    // Signer management
    mapping(address => bool) public signers;
    
    // Fee configuration
    address public systemFeeAddress;
    uint256 public feePercentage;
    uint256 public constant BASIS_POINTS = 10000;

    // Events
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
        address _systemFeeAddress,
        uint256 _feePercentage
    ) public initializer {
        require(_systemFeeAddress != address(0), "Invalid system fee address");
        require(_feePercentage <= BASIS_POINTS, "Fee percentage too high");

        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

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
     * @dev Check if an address is an authorized signer
     * @param signer The address to check
     * @return True if the address is an authorized signer
     */
    function isSigner(address signer) external view returns (bool) {
        return signers[signer];
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

    /**
     * @dev Disable the old message creation and purchase flow
     * These functions are overridden to prevent usage of the old flow
     */
    function createMessage(bytes32, uint256, uint256) external pure {
        revert("V3: Old message creation flow disabled. Use off-chain flow.");
    }

    function purchaseMessage(bytes32) external pure {
        revert("V3: Old message purchase flow disabled. Use off-chain flow.");
    }

    function purchaseMessageByFiat(bytes32, bytes32, bytes32) external pure {
        revert("V3: Old fiat purchase flow disabled. Use off-chain flow.");
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
