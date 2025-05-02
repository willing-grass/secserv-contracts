// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MessageMarketplace is Ownable, ReentrancyGuard {
    IERC20 public usdc;
    address public systemFeeAddress;
    uint256 public feePercentage; // Configurable fee percentage
    uint256 public constant BASIS_POINTS = 10000; // Using 10000 for more precise percentages

    struct Message {
        address creator;
        uint256 price;
        bool exists;
    }

    mapping(bytes32 => Message) public messages;
    // Track which buyers have purchased which messages
    mapping(bytes32 => mapping(address => bool)) public messagePurchases;

    event MessageCreated(bytes32 indexed messageId, address indexed creator, uint256 price);
    event MessagePurchased(bytes32 indexed messageId, address indexed buyer, uint256 price);
    event FeePercentageUpdated(uint256 oldFee, uint256 newFee);
    event USDCAddressUpdated(address oldAddress, address newAddress);
    event SystemFeeAddressUpdated(address oldAddress, address newAddress);

    constructor(
        address _usdcAddress, 
        address _systemFeeAddress,
        uint256 _feePercentage
    ) Ownable(msg.sender) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_systemFeeAddress != address(0), "Invalid system fee address");
        require(_feePercentage <= BASIS_POINTS, "Fee percentage too high");
        
        usdc = IERC20(_usdcAddress);
        systemFeeAddress = _systemFeeAddress;
        feePercentage = _feePercentage;
    }

    function createMessage(bytes32 messageId, uint256 price) external {
        require(!messages[messageId].exists, "Message already exists");
        require(price > 0, "Price must be greater than 0");

        messages[messageId] = Message({
            creator: msg.sender,
            price: price,
            exists: true
        });

        emit MessageCreated(messageId, msg.sender, price);
    }

    function purchaseMessage(bytes32 messageId) external nonReentrant {
        Message storage message = messages[messageId];
        require(message.exists, "Message does not exist");
        require(msg.sender != message.creator, "Creator cannot purchase their own message");

        uint256 price = message.price;
        uint256 feeAmount = (price * feePercentage) / BASIS_POINTS;
        uint256 creatorAmount = price - feeAmount;

        // Transfer USDC from buyer to contract
        require(usdc.transferFrom(msg.sender, address(this), price), "USDC transfer failed");

        // Transfer fee to system address
        require(usdc.transfer(systemFeeAddress, feeAmount), "Fee transfer failed");

        // Transfer remaining amount to creator
        require(usdc.transfer(message.creator, creatorAmount), "Creator transfer failed");

        // Mark this buyer as having purchased this message
        messagePurchases[messageId][msg.sender] = true;

        emit MessagePurchased(messageId, msg.sender, price);
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
        usdc = IERC20(_newUSDCAddress);
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

    function hasPurchasedMessage(bytes32 messageId, address buyer) external view returns (bool) {
        return messagePurchases[messageId][buyer];
    }
} 