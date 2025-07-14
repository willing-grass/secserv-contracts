import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("MessageMarketplaceV2", function () {
  let messageMarketplace: any;
  let usdc: any;
  let owner: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let fiatProvider: HardhatEthersSigner;
  let systemFeeAddress: HardhatEthersSigner;
  let ownerAddress: string;
  let creatorAddress: string;
  let buyerAddress: string;
  let fiatProviderAddress: string;
  let systemFeeAddressString: string;

  async function deployContracts() {
    // Deploy mock USDC
    const MockUSDC = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockUSDC.deploy("USD Coin", "USDC", 6);
    await mockUSDC.waitForDeployment();

    // Deploy MessageMarketplace as upgradable proxy
    const MessageMarketplace = await ethers.getContractFactory("MessageMarketplace");
    const marketplace = await upgrades.deployProxy(MessageMarketplace, [
      await mockUSDC.getAddress(),
      await systemFeeAddress.getAddress(),
      1000 // 10% fee (1000 basis points)
    ], { initializer: 'initialize' });
    await marketplace.waitForDeployment();

    return { marketplace, mockUSDC };
  }

  async function upgradeToV2(marketplace: any) {
    const MessageMarketplaceV2 = await ethers.getContractFactory("MessageMarketplaceV2");
    const upgraded = await upgrades.upgradeProxy(await marketplace.getAddress(), MessageMarketplaceV2);
    await upgraded.waitForDeployment();
    return upgraded;
  }

  beforeEach(async function () {
    [owner, creator, buyer, fiatProvider, systemFeeAddress] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    creatorAddress = await creator.getAddress();
    buyerAddress = await buyer.getAddress();
    fiatProviderAddress = await fiatProvider.getAddress();
    systemFeeAddressString = await systemFeeAddress.getAddress();

    const { marketplace, mockUSDC } = await loadFixture(deployContracts);
    messageMarketplace = marketplace;
    usdc = mockUSDC;

    // Mint USDC to buyer and fiatProvider
    await usdc.mint(buyerAddress, ethers.parseUnits("1000", 6));
    await usdc.connect(buyer).approve(await messageMarketplace.getAddress(), ethers.parseUnits("1000", 6));
    
    // Mint USDC to fiatProvider and approve contract with large amount
    await usdc.mint(fiatProviderAddress, ethers.parseUnits("1000000", 6));
    await usdc.connect(fiatProvider).approve(await messageMarketplace.getAddress(), ethers.parseUnits("1000000", 6));
  });

  describe("Upgrade to V2", function () {
    it("Should upgrade successfully and preserve all existing data", async function () {
      // Create a message in V1
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Purchase in V1
      await messageMarketplace.connect(buyer).purchaseMessage(messageId);

      // Upgrade to V2
      const v2Marketplace = await upgradeToV2(messageMarketplace);

      // Verify existing data is preserved
      const message = await v2Marketplace.getMessage(messageId);
      expect(message.creator).to.equal(creatorAddress);
      expect(message.price).to.equal(price);

      const purchaseDetails = await v2Marketplace.getPurchaseDetails(messageId, buyerAddress);
      expect(purchaseDetails.timestamp).to.be.gt(0);
      expect(purchaseDetails.price).to.equal(price);

      // Verify V2 functions are available
      expect(await v2Marketplace.hasPurchasedMessageByFiat(ethers.keccak256(ethers.toUtf8Bytes("test")))).to.be.false;
    });

    it("Should maintain all V1 functionality after upgrade", async function () {
      const v2Marketplace = await upgradeToV2(messageMarketplace);

      // Test message creation
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("new message"));
      const price = ethers.parseUnits("20", 6);
      const expireAt = 0n;

      await expect(v2Marketplace.connect(creator).createMessage(messageId, price, expireAt))
        .to.emit(v2Marketplace, "MessageCreated")
        .withArgs(messageId, creatorAddress, price, expireAt);

      // Test message purchase
      await expect(v2Marketplace.connect(buyer).purchaseMessage(messageId))
        .to.emit(v2Marketplace, "MessagePurchased");

      // Verify purchase details
      const purchaseDetails = await v2Marketplace.getPurchaseDetails(messageId, buyerAddress);
      expect(purchaseDetails.timestamp).to.be.gt(0);
      expect(purchaseDetails.price).to.equal(price);
    });
  });

  describe("Fiat Purchase Functionality", function () {
    beforeEach(async function () {
      // Upgrade to V2 for fiat purchase tests
      messageMarketplace = await upgradeToV2(messageMarketplace);
    });

    it("Should purchase message by fiat successfully", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("fiat test message"));
      const web2UserId = "user123";
      const price = ethers.parseUnits("15", 6);
      const expireAt = 0n;

      // Create message
      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Create purchase hash (messageId + web2UserId)
      const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId, web2UserId]
      ));

      // Create backend validation hash
      const backendValidationHash = ethers.keccak256(ethers.toUtf8Bytes("backend_validation_data"));

      // Record initial balances BEFORE purchase
      const initialFiatProviderBalance = await usdc.balanceOf(fiatProviderAddress);
      const initialCreatorBalance = await usdc.balanceOf(creatorAddress);
      const initialSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      const purchaseTx = await messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId,
        purchaseHash,
        backendValidationHash
      );
      const receipt = await purchaseTx.wait();

      // Get the timestamp from the event
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "MessagePurchasedByFiat"
      );
      const purchaseTimestamp = event?.args[2];

      await expect(purchaseTx)
        .to.emit(messageMarketplace, "MessagePurchasedByFiat")
        .withArgs(purchaseHash, price, purchaseTimestamp, backendValidationHash);

      // Verify fiat purchase details
      const fiatPurchaseDetails = await messageMarketplace.getFiatPurchaseDetails(purchaseHash);
      expect(fiatPurchaseDetails.timestamp).to.equal(purchaseTimestamp);
      expect(fiatPurchaseDetails.price).to.equal(price);
      expect(fiatPurchaseDetails.purchaseHash).to.equal(purchaseHash);
      expect(fiatPurchaseDetails.backendValidationHash).to.equal(backendValidationHash);

      // Check balances AFTER purchase
      const finalFiatProviderBalance = await usdc.balanceOf(fiatProviderAddress);
      const finalCreatorBalance = await usdc.balanceOf(creatorAddress);
      const finalSystemBalance = await usdc.balanceOf(systemFeeAddressString);
      expect(finalFiatProviderBalance).to.equal(initialFiatProviderBalance - price);
      // Calculate fee and creator amount exactly like the contract
      const feeAmount = (price * 1000n) / 10000n; // 10% fee (1000 basis points)
      const creatorAmount = price - feeAmount;
      expect(finalCreatorBalance).to.equal(initialCreatorBalance + creatorAmount);
      expect(finalSystemBalance).to.equal(initialSystemBalance + feeAmount);
    });

    it("Should not allow duplicate fiat purchases with same hash", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("duplicate test"));
      const web2UserId = "user456";
      const price = ethers.parseUnits("25", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId, web2UserId]
      ));

      const backendValidationHash = ethers.keccak256(ethers.toUtf8Bytes("validation1"));

      // First purchase
      await messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId,
        purchaseHash,
        backendValidationHash
      );

      // Second purchase with same hash should fail
      await expect(
        messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
          messageId,
          purchaseHash,
          backendValidationHash
        )
      ).to.be.revertedWith("Message already purchased with this hash");
    });

    it("Should allow different purchase hashes for same message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("multi user test"));
      const web2UserId1 = "user1";
      const web2UserId2 = "user2";
      const price = ethers.parseUnits("30", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const purchaseHash1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId, web2UserId1]
      ));

      const purchaseHash2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId, web2UserId2]
      ));

      const backendValidationHash1 = ethers.keccak256(ethers.toUtf8Bytes("validation1"));
      const backendValidationHash2 = ethers.keccak256(ethers.toUtf8Bytes("validation2"));

      // First purchase
      await expect(messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId,
        purchaseHash1,
        backendValidationHash1
      )).to.emit(messageMarketplace, "MessagePurchasedByFiat");

      // Second purchase with different hash should succeed
      await expect(messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId,
        purchaseHash2,
        backendValidationHash2
      )).to.emit(messageMarketplace, "MessagePurchasedByFiat");

      // Verify both purchases exist
      expect(await messageMarketplace.hasPurchasedMessageByFiat(purchaseHash1)).to.be.true;
      expect(await messageMarketplace.hasPurchasedMessageByFiat(purchaseHash2)).to.be.true;
    });

    it("Should not allow fiat purchase of non-existent message", async function () {
      const nonExistentMessageId = ethers.keccak256(ethers.toUtf8Bytes("non existent"));
      const web2UserId = "user789";
      const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [nonExistentMessageId, web2UserId]
      ));

      const backendValidationHash = ethers.keccak256(ethers.toUtf8Bytes("validation"));

      await expect(
        messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
          nonExistentMessageId,
          purchaseHash,
          backendValidationHash
        )
      ).to.be.revertedWith("Message does not exist");
    });

    it("Should not allow fiat purchase of expired message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("expired test"));
      const web2UserId = "user999";
      const price = ethers.parseUnits("40", 6);
      
      // Get current block timestamp and add 3 seconds
      const currentBlock = await ethers.provider.getBlock("latest");
      const expireAt = BigInt(currentBlock!.timestamp + 3);

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId, web2UserId]
      ));

      const backendValidationHash = ethers.keccak256(ethers.toUtf8Bytes("validation"));

      // Advance EVM time by 4 seconds and mine a block
      await ethers.provider.send("evm_increaseTime", [4]);
      await ethers.provider.send("evm_mine");

      await expect(
        messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
          messageId,
          purchaseHash,
          backendValidationHash
        )
      ).to.be.revertedWith("Message has expired");
    });

    it("Should handle fiat purchase with different backend validation hashes", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("validation test"));
      const web2UserId = "user111";
      const price = ethers.parseUnits("50", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId, web2UserId]
      ));

      const backendValidationHash1 = ethers.keccak256(ethers.toUtf8Bytes("validation_data_1"));
      const backendValidationHash2 = ethers.keccak256(ethers.toUtf8Bytes("validation_data_2"));

      // First purchase with validation hash 1
      await messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId,
        purchaseHash,
        backendValidationHash1
      );

      // Try to purchase again with different validation hash (should fail due to same purchase hash)
      await expect(
        messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
          messageId,
          purchaseHash,
          backendValidationHash2
        )
      ).to.be.revertedWith("Message already purchased with this hash");

      // Verify the first validation hash was stored
      const fiatPurchaseDetails = await messageMarketplace.getFiatPurchaseDetails(purchaseHash);
      expect(fiatPurchaseDetails.backendValidationHash).to.equal(backendValidationHash1);
    });
  });

  describe("Mixed Purchase Scenarios", function () {
    beforeEach(async function () {
      messageMarketplace = await upgradeToV2(messageMarketplace);
    });

    it("Should allow both regular and fiat purchases for same message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("mixed test"));
      const price = ethers.parseUnits("60", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Regular purchase
      await expect(messageMarketplace.connect(buyer).purchaseMessage(messageId))
        .to.emit(messageMarketplace, "MessagePurchased");

      // Fiat purchase
      const web2UserId = "mixed_user";
      const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId, web2UserId]
      ));
      const backendValidationHash = ethers.keccak256(ethers.toUtf8Bytes("mixed_validation"));

      await expect(messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId,
        purchaseHash,
        backendValidationHash
      )).to.emit(messageMarketplace, "MessagePurchasedByFiat");

      // Verify both purchase types exist
      expect(await messageMarketplace.hasPurchasedMessage(messageId, buyerAddress)).to.be.true;
      expect(await messageMarketplace.hasPurchasedMessageByFiat(purchaseHash)).to.be.true;
    });

    it("Should handle multiple fiat purchases and regular purchases", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("multiple test"));
      const price = ethers.parseUnits("70", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Multiple regular purchases by different buyers
      const [_, __, ___, buyer2, buyer3] = await ethers.getSigners();
      const buyer2Address = await buyer2.getAddress();
      const buyer3Address = await buyer3.getAddress();

      // Setup additional buyers
      await usdc.mint(buyer2Address, ethers.parseUnits("1000", 6));
      await usdc.mint(buyer3Address, ethers.parseUnits("1000", 6));
      await usdc.connect(buyer2).approve(await messageMarketplace.getAddress(), ethers.parseUnits("1000", 6));
      await usdc.connect(buyer3).approve(await messageMarketplace.getAddress(), ethers.parseUnits("1000", 6));

      await messageMarketplace.connect(buyer).purchaseMessage(messageId);
      await messageMarketplace.connect(buyer2).purchaseMessage(messageId);
      await messageMarketplace.connect(buyer3).purchaseMessage(messageId);

      // Multiple fiat purchases
      const web2UserIds = ["fiat_user1", "fiat_user2", "fiat_user3"];
      const purchaseHashes = web2UserIds.map(userId => 
        ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "string"],
          [messageId, userId]
        ))
      );

      for (let i = 0; i < purchaseHashes.length; i++) {
        const backendValidationHash = ethers.keccak256(ethers.toUtf8Bytes(`validation_${i}`));
        await messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
          messageId,
          purchaseHashes[i],
          backendValidationHash
        );
      }

      // Verify all purchases exist
      expect(await messageMarketplace.hasPurchasedMessage(messageId, buyerAddress)).to.be.true;
      expect(await messageMarketplace.hasPurchasedMessage(messageId, buyer2Address)).to.be.true;
      expect(await messageMarketplace.hasPurchasedMessage(messageId, buyer3Address)).to.be.true;

      for (const purchaseHash of purchaseHashes) {
        expect(await messageMarketplace.hasPurchasedMessageByFiat(purchaseHash)).to.be.true;
      }
    });
  });

  describe("Edge Cases and Error Handling", function () {
    beforeEach(async function () {
      messageMarketplace = await upgradeToV2(messageMarketplace);
    });

    it("Should handle empty web2UserId in fiat purchase", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("empty user test"));
      const web2UserId = "";
      const price = ethers.parseUnits("80", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId, web2UserId]
      ));

      const backendValidationHash = ethers.keccak256(ethers.toUtf8Bytes("validation"));

      await expect(messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId,
        purchaseHash,
        backendValidationHash
      )).to.emit(messageMarketplace, "MessagePurchasedByFiat");

      expect(await messageMarketplace.hasPurchasedMessageByFiat(purchaseHash)).to.be.true;
    });

    it("Should handle very long web2UserId in fiat purchase", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("long user test"));
      const web2UserId = "a".repeat(1000); // Very long user ID
      const price = ethers.parseUnits("90", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId, web2UserId]
      ));

      const backendValidationHash = ethers.keccak256(ethers.toUtf8Bytes("validation"));

      await expect(messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId,
        purchaseHash,
        backendValidationHash
      )).to.emit(messageMarketplace, "MessagePurchasedByFiat");

      expect(await messageMarketplace.hasPurchasedMessageByFiat(purchaseHash)).to.be.true;
    });

    it("Should handle zero backend validation hash", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("zero validation test"));
      const web2UserId = "user_zero";
      const price = ethers.parseUnits("100", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId, web2UserId]
      ));

      const backendValidationHash = ethers.ZeroHash; // Zero hash

      await expect(messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId,
        purchaseHash,
        backendValidationHash
      )).to.emit(messageMarketplace, "MessagePurchasedByFiat");

      const fiatPurchaseDetails = await messageMarketplace.getFiatPurchaseDetails(purchaseHash);
      expect(fiatPurchaseDetails.backendValidationHash).to.equal(backendValidationHash);
    });

    it("Should handle fiat purchase with same backend validation hash for different messages", async function () {
      const messageId1 = ethers.keccak256(ethers.toUtf8Bytes("same validation 1"));
      const messageId2 = ethers.keccak256(ethers.toUtf8Bytes("same validation 2"));
      const web2UserId1 = "user_same1";
      const web2UserId2 = "user_same2";
      const price = ethers.parseUnits("110", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId1, price, expireAt);
      await messageMarketplace.connect(creator).createMessage(messageId2, price, expireAt);

      const purchaseHash1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId1, web2UserId1]
      ));

      const purchaseHash2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "string"],
        [messageId2, web2UserId2]
      ));

      const sameBackendValidationHash = ethers.keccak256(ethers.toUtf8Bytes("same_validation"));

      // Both purchases should succeed with same backend validation hash
      await messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId1,
        purchaseHash1,
        sameBackendValidationHash
      );

      await messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId2,
        purchaseHash2,
        sameBackendValidationHash
      );

      expect(await messageMarketplace.hasPurchasedMessageByFiat(purchaseHash1)).to.be.true;
      expect(await messageMarketplace.hasPurchasedMessageByFiat(purchaseHash2)).to.be.true;
    });
  });

  describe("Gas Optimization and Performance", function () {
    beforeEach(async function () {
      messageMarketplace = await upgradeToV2(messageMarketplace);
    });

    it("Should handle multiple fiat purchases efficiently", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("gas test"));
      const price = ethers.parseUnits("120", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Perform multiple fiat purchases and measure gas
      const gasUsed = [];
      for (let i = 0; i < 5; i++) {
        const web2UserId = `gas_user_${i}`;
        const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "string"],
          [messageId, web2UserId]
        ));
        const backendValidationHash = ethers.keccak256(ethers.toUtf8Bytes(`gas_validation_${i}`));

        const tx =       await messageMarketplace.connect(fiatProvider).purchaseMessageByFiat(
        messageId,
        purchaseHash,
        backendValidationHash
      );
        const receipt = await tx.wait();
        gasUsed.push(receipt?.gasUsed);
      }

      // Verify all purchases were successful
      for (let i = 0; i < 5; i++) {
        const web2UserId = `gas_user_${i}`;
        const purchaseHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "string"],
          [messageId, web2UserId]
        ));
        expect(await messageMarketplace.hasPurchasedMessageByFiat(purchaseHash)).to.be.true;
      }

      console.log("Gas used for fiat purchases:", gasUsed);
    });
  });
}); 