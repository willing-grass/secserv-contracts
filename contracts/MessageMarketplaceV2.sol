// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./MessageMarketplace.sol";

contract MessageMarketplaceV2 is MessageMarketplace {
    uint256 public totalSales;
    uint256 public totalVolume;

    function purchaseMessage(bytes32 messageId) external nonReentrant override {
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

        // Update new V2 statistics
        totalSales += 1;
        totalVolume += price;

        emit MessagePurchased(messageId, msg.sender, price, block.timestamp);
    }

    // New function to get marketplace statistics
    function getMarketplaceStats() external view returns (uint256 sales, uint256 volume) {
        return (totalSales, totalVolume);
    }
} 