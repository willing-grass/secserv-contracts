// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./MessageMarketplace.sol";

contract MessageMarketplaceV2 is MessageMarketplace {
    struct FiatPurchase {
        uint256 timestamp; // Time of purchase
        uint256 price;     // Price paid
        bytes32 purchaseHash; // Hash of messageId + web2UserId
        bytes32 backendValidationHash; // Hash from backend validation
    }

    // Track fiat purchases by purchase hash (messageId + web2UserId)
    mapping(bytes32 => FiatPurchase) public fiatPurchases;

    event MessagePurchasedByFiat(bytes32 indexed purchaseHash, uint256 price, uint256 timestamp, bytes32 backendValidationHash);

    function purchaseMessageByFiat(
        bytes32 messageId, // The actual messageId
        bytes32 purchaseHash, // Hash of messageId + web2UserId
        bytes32 backendValidationHash // Hash from backend validation
    ) external nonReentrant {
        // Cache storage reads
        Message storage message = messages[messageId];
        address creator = message.creator;
        require(creator != address(0), "Message does not exist");
        require(!_hasPurchasedMessageByFiat(purchaseHash), "Message already purchased with this hash");

        // Check if message has expired
        uint256 expireAt = message.expireAt;
        require(expireAt == 0 || block.timestamp < expireAt, "Message has expired");

        uint256 price = message.price;
        uint256 feeAmount = (price * feePercentage) / BASIS_POINTS;
        // Use unchecked for safe subtraction (price >= feeAmount due to feePercentage <= BASIS_POINTS)
        uint256 creatorAmount;
        unchecked {
            creatorAmount = price - feeAmount;
        }

        // Transfer USDC from buyer to contract
        require(usdc.transferFrom(msg.sender, address(this), price), "USDC transfer failed");

        // Transfer fee to system address
        require(usdc.transfer(systemFeeAddress, feeAmount), "Fee transfer failed");

        // Transfer remaining amount to creator
        require(usdc.transfer(creator, creatorAmount), "Creator transfer failed");

        // Mark this purchase with timestamp
        fiatPurchases[purchaseHash] = FiatPurchase({
            timestamp: block.timestamp,
            price: price,
            purchaseHash: purchaseHash,
            backendValidationHash: backendValidationHash
        });

        emit MessagePurchasedByFiat(purchaseHash, price, block.timestamp, backendValidationHash);
    }

    function hasPurchasedMessageByFiat(bytes32 purchaseHash) public view returns (bool) {
        return fiatPurchases[purchaseHash].timestamp > 0;
    }

    // More gas-efficient version for internal use
    function _hasPurchasedMessageByFiat(bytes32 purchaseHash) internal view returns (bool) {
        return fiatPurchases[purchaseHash].timestamp > 0;
    }

    function getFiatPurchaseDetails(bytes32 purchaseHash) external view returns (FiatPurchase memory) {
        return fiatPurchases[purchaseHash];
    }
}