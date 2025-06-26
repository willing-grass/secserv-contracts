// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract MessageMarketplace is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    ERC20Upgradeable public usdc;
    address public systemFeeAddress;
    uint256 public feePercentage; // Configurable fee percentage
    uint256 public constant BASIS_POINTS = 10000; // Using 10000 for more precise percentages

    struct Message {
        address creator;
        uint256 price;
        uint256 expireAt; // Timestamp when message expires
    }

    struct Purchase {
        uint256 timestamp; // Time of purchase
        uint256 price;     // Price paid
    }

    mapping(bytes32 => Message) public messages;
    // Track which buyers have purchased which messages with purchase details
    mapping(bytes32 => mapping(address => Purchase)) public messagePurchases;

    event MessageCreated(bytes32 indexed messageId, address indexed creator, uint256 price, uint256 expireAt);
    event MessagePurchased(bytes32 indexed messageId, address indexed buyer, uint256 price, uint256 timestamp);
    event FeePercentageUpdated(uint256 oldFee, uint256 newFee);
    event USDCAddressUpdated(address oldAddress, address newAddress);
    event SystemFeeAddressUpdated(address oldAddress, address newAddress);

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

    function createMessage(bytes32 messageId, uint256 price, uint256 expireAt) external {
        require(messages[messageId].creator == address(0), "Message already exists");
        require(price > 0, "Price must be greater than 0");
        require(expireAt == 0 || expireAt > block.timestamp, "Expiration must be in the future");

        messages[messageId] = Message({
            creator: msg.sender,
            price: price,
            expireAt: expireAt
        });

        emit MessageCreated(messageId, msg.sender, price, expireAt);
    }

    function purchaseMessage(bytes32 messageId) external nonReentrant virtual {
        Message storage message = messages[messageId];
        require(message.creator != address(0), "Message does not exist");
        require(msg.sender != message.creator, "Creator cannot purchase their own message");
        require(!hasPurchasedMessage(messageId, msg.sender), "Message already purchased by this buyer");

        // Check if message has expired
        require(message.expireAt == 0 || block.timestamp < message.expireAt, "Message has expired");

        uint256 price = message.price;
        uint256 feeAmount = (price * feePercentage) / BASIS_POINTS;
        uint256 creatorAmount = price - feeAmount;

        // Transfer USDC from buyer to contract
        require(usdc.transferFrom(msg.sender, address(this), price), "USDC transfer failed");

        // Transfer fee to system address
        require(usdc.transfer(systemFeeAddress, feeAmount), "Fee transfer failed");

        // Transfer remaining amount to creator
        require(usdc.transfer(message.creator, creatorAmount), "Creator transfer failed");

        // Mark this buyer as having purchased this message with timestamp
        messagePurchases[messageId][msg.sender] = Purchase({
            timestamp: block.timestamp,
            price: price
        });

        emit MessagePurchased(messageId, msg.sender, price, block.timestamp);
    }

    function updateSystemFeeAddress(address _newFeeAddress) external onlyOwner {
        require(_newFeeAddress != address(0), "Invalid fee address");
        address oldAddress = systemFeeAddress;
        systemFeeAddress = _newFeeAddress;
        emit SystemFeeAddressUpdated(oldAddress, _newFeeAddress);
    }

    function updateUSDCAddress(address _newUSDCAddress) external onlyOwner {
        require(_newUSDCAddress != address(0), "Invalid USDC address");
        address oldAddress = address(usdc);
        usdc = ERC20Upgradeable(_newUSDCAddress);
        emit USDCAddressUpdated(oldAddress, _newUSDCAddress);
    }

    function updateFeePercentage(uint256 _newFeePercentage) external onlyOwner {
        require(_newFeePercentage <= BASIS_POINTS, "Fee percentage too high");
        uint256 oldFee = feePercentage;
        feePercentage = _newFeePercentage;
        emit FeePercentageUpdated(oldFee, _newFeePercentage);
    }

    function getMessage(bytes32 messageId) external view returns (Message memory) {
        return messages[messageId];
    }

    function hasPurchasedMessage(bytes32 messageId, address buyer) public view returns (bool) {
        return messagePurchases[messageId][buyer].timestamp > 0;
    }

    function getPurchaseDetails(bytes32 messageId, address buyer) external view returns (Purchase memory) {
        return messagePurchases[messageId][buyer];
    }

    function messageExists(bytes32 messageId) external view returns (bool) {
        return messages[messageId].creator != address(0);
    }

    function isMessageExpired(bytes32 messageId) external view returns (bool) {
        Message storage message = messages[messageId];
        return message.creator != address(0) && message.expireAt > 0 && block.timestamp >= message.expireAt;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
} 