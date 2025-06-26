import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("MessageMarketplace", function () {
  let messageMarketplace: any;
  let usdc: any;
  let owner: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let systemFeeAddress: HardhatEthersSigner;
  let ownerAddress: string;
  let creatorAddress: string;
  let buyerAddress: string;
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

  beforeEach(async function () {
    [owner, creator, buyer, systemFeeAddress] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    creatorAddress = await creator.getAddress();
    buyerAddress = await buyer.getAddress();
    systemFeeAddressString = await systemFeeAddress.getAddress();

    const { marketplace, mockUSDC } = await loadFixture(deployContracts);
    messageMarketplace = marketplace;
    usdc = mockUSDC;

    // Mint USDC to buyer
    await usdc.mint(buyerAddress, ethers.parseUnits("1000", 6));
    await usdc.connect(buyer).approve(await messageMarketplace.getAddress(), ethers.parseUnits("1000", 6));
  });

  describe("Message Creation", function () {
    it("Should create a message successfully without expiration", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6); // 10 USDC
      const expireAt = 0n; // No expiration

      await expect(messageMarketplace.connect(creator).createMessage(messageId, price, expireAt))
        .to.emit(messageMarketplace, "MessageCreated")
        .withArgs(messageId, creatorAddress, price, expireAt);

      const message = await messageMarketplace.getMessage(messageId);
      expect(message.creator).to.equal(creatorAddress);
      expect(message.price).to.equal(price);
      expect(message.expireAt).to.equal(expireAt);
    });

    it("Should create a message successfully with expiration", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      
      // Get current block timestamp and add 1 hour
      const currentBlock = await ethers.provider.getBlock("latest");
      const expireAt = BigInt(currentBlock!.timestamp + 3600); // 1 hour from now

      await expect(messageMarketplace.connect(creator).createMessage(messageId, price, expireAt))
        .to.emit(messageMarketplace, "MessageCreated")
        .withArgs(messageId, creatorAddress, price, expireAt);

      const message = await messageMarketplace.getMessage(messageId);
      expect(message.creator).to.equal(creatorAddress);
      expect(message.price).to.equal(price);
      expect(message.expireAt).to.equal(expireAt);
    });

    it("Should not allow creating a message with the same ID", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      await expect(
        messageMarketplace.connect(creator).createMessage(messageId, price, expireAt)
      ).to.be.revertedWith("Message already exists");
    });

    it("Should not allow creating a message with zero price", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = 0;
      const expireAt = 0n;

      await expect(
        messageMarketplace.connect(creator).createMessage(messageId, price, expireAt)
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("Should not allow creating a message with past expiration", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      
      // Get current block timestamp and subtract 1 hour
      const currentBlock = await ethers.provider.getBlock("latest");
      const expireAt = BigInt(currentBlock!.timestamp - 3600); // 1 hour ago

      await expect(
        messageMarketplace.connect(creator).createMessage(messageId, price, expireAt)
      ).to.be.revertedWith("Expiration must be in the future");
    });
  });

  describe("Message Purchase", function () {
    it("Should purchase a message successfully without expiration", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const initialBuyerBalance = await usdc.balanceOf(buyerAddress);
      const initialCreatorBalance = await usdc.balanceOf(creatorAddress);
      const initialSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      const purchaseTx = await messageMarketplace.connect(buyer).purchaseMessage(messageId);
      const receipt = await purchaseTx.wait();

      // Get the timestamp from the event
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "MessagePurchased"
      );
      const purchaseTimestamp = event?.args[3];

      await expect(purchaseTx)
        .to.emit(messageMarketplace, "MessagePurchased")
        .withArgs(messageId, buyerAddress, price, purchaseTimestamp);

      const finalBuyerBalance = await usdc.balanceOf(buyerAddress);
      const finalCreatorBalance = await usdc.balanceOf(creatorAddress);
      const finalSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      expect(finalBuyerBalance).to.equal(initialBuyerBalance - price);
      expect(finalCreatorBalance).to.equal(initialCreatorBalance + (price * 90n) / 100n);
      expect(finalSystemBalance).to.equal(initialSystemBalance + (price * 10n) / 100n);

      // Check purchase details
      const purchaseDetails = await messageMarketplace.getPurchaseDetails(messageId, buyerAddress);
      expect(purchaseDetails.timestamp).to.equal(purchaseTimestamp);
      expect(purchaseDetails.price).to.equal(price);
    });

    it("Should purchase a message successfully before expiration", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      
      // Get current block timestamp and add 1 hour
      const currentBlock = await ethers.provider.getBlock("latest");
      const expireAt = BigInt(currentBlock!.timestamp + 3600); // 1 hour from now

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const initialBuyerBalance = await usdc.balanceOf(buyerAddress);
      const initialCreatorBalance = await usdc.balanceOf(creatorAddress);
      const initialSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      const purchaseTx = await messageMarketplace.connect(buyer).purchaseMessage(messageId);
      const receipt = await purchaseTx.wait();

      // Get the timestamp from the event
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "MessagePurchased"
      );
      const purchaseTimestamp = event?.args[3];

      await expect(purchaseTx)
        .to.emit(messageMarketplace, "MessagePurchased")
        .withArgs(messageId, buyerAddress, price, purchaseTimestamp);

      const finalBuyerBalance = await usdc.balanceOf(buyerAddress);
      const finalCreatorBalance = await usdc.balanceOf(creatorAddress);
      const finalSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      expect(finalBuyerBalance).to.equal(initialBuyerBalance - price);
      expect(finalCreatorBalance).to.equal(initialCreatorBalance + (price * 90n) / 100n);
      expect(finalSystemBalance).to.equal(initialSystemBalance + (price * 10n) / 100n);

      // Check purchase details
      const purchaseDetails = await messageMarketplace.getPurchaseDetails(messageId, buyerAddress);
      expect(purchaseDetails.timestamp).to.equal(purchaseTimestamp);
      expect(purchaseDetails.price).to.equal(price);
    });

    it("Should not allow purchasing an expired message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      
      // Get current block timestamp and add 3 seconds to ensure it's in the future
      const currentBlock = await ethers.provider.getBlock("latest");
      const expireAt = BigInt(currentBlock!.timestamp + 3);

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Advance EVM time by 4 seconds and mine a block
      await ethers.provider.send("evm_increaseTime", [4]);
      await ethers.provider.send("evm_mine");

      await expect(
        messageMarketplace.connect(buyer).purchaseMessage(messageId)
      ).to.be.revertedWith("Message has expired");
    });

    it("Should not allow duplicate purchases by the same buyer", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);
      
      // First purchase
      await messageMarketplace.connect(buyer).purchaseMessage(messageId);
      
      // Second purchase by the same buyer should fail
      await expect(
        messageMarketplace.connect(buyer).purchaseMessage(messageId)
      ).to.be.revertedWith("Message already purchased by this buyer");
    });

    it("Should allow multiple purchases by different buyers", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n;
      const [_, __, ___, buyer2] = await ethers.getSigners();
      const buyer2Address = await buyer2.getAddress();

      // Setup buyer2 with USDC
      await usdc.mint(buyer2Address, ethers.parseUnits("1000", 6));
      await usdc.connect(buyer2).approve(await messageMarketplace.getAddress(), ethers.parseUnits("1000", 6));

      // Create message
      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);
      
      // Initial state check
      const initialBuyer1Purchase = await messageMarketplace.hasPurchasedMessage(messageId, buyerAddress);
      const initialBuyer2Purchase = await messageMarketplace.hasPurchasedMessage(messageId, buyer2Address);

      expect(initialBuyer1Purchase).to.be.false;
      expect(initialBuyer2Purchase).to.be.false;
      
      // First buyer purchases
      await messageMarketplace.connect(buyer).purchaseMessage(messageId);
      
      // Check state after first purchase
      const afterFirstPurchaseBuyer1 = await messageMarketplace.hasPurchasedMessage(messageId, buyerAddress);
      const afterFirstPurchaseBuyer2 = await messageMarketplace.hasPurchasedMessage(messageId, buyer2Address);

      expect(afterFirstPurchaseBuyer1).to.be.true;
      expect(afterFirstPurchaseBuyer2).to.be.false;
      
      // Second buyer purchases
      await messageMarketplace.connect(buyer2).purchaseMessage(messageId);
      
      // Check final state
      const finalBuyer1Purchase = await messageMarketplace.hasPurchasedMessage(messageId, buyerAddress);
      const finalBuyer2Purchase = await messageMarketplace.hasPurchasedMessage(messageId, buyer2Address);

      expect(finalBuyer1Purchase).to.be.true;
      expect(finalBuyer2Purchase).to.be.true;

      // Check purchase details for both buyers
      const purchaseDetails1 = await messageMarketplace.getPurchaseDetails(messageId, buyerAddress);
      const purchaseDetails2 = await messageMarketplace.getPurchaseDetails(messageId, buyer2Address);

      expect(purchaseDetails1.timestamp).to.be.gt(0);
      expect(purchaseDetails1.price).to.equal(price);
      expect(purchaseDetails2.timestamp).to.be.gt(0);
      expect(purchaseDetails2.price).to.equal(price);
    });

    it("Should not allow creator to purchase their own message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      await expect(
        messageMarketplace.connect(creator).purchaseMessage(messageId)
      ).to.be.revertedWith("Creator cannot purchase their own message");
    });
  });

  describe("Expiration Functionality", function () {
    it("Should correctly identify expired messages", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("expiring message"));
      const price = ethers.parseUnits("10", 6);
      
      // Get current block timestamp and add 3 seconds to ensure it's in the future
      const currentBlock = await ethers.provider.getBlock("latest");
      const expireAt = BigInt(currentBlock!.timestamp + 3);

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Check before expiration
      let isExpired = await messageMarketplace.isMessageExpired(messageId);
      expect(isExpired).to.be.false;

      // Advance EVM time by 6 seconds and mine a block
      await ethers.provider.send("evm_increaseTime", [6]);
      await ethers.provider.send("evm_mine");

      // Check after expiration
      isExpired = await messageMarketplace.isMessageExpired(messageId);
      expect(isExpired).to.be.true;
    });

    it("Should correctly identify non-expiring messages", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("non-expiring message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n; // No expiration

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Check expiration status
      const isExpired = await messageMarketplace.isMessageExpired(messageId);
      expect(isExpired).to.be.false;
    });

    it("Should return false for non-existent messages", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("non-existent message"));

      const isExpired = await messageMarketplace.isMessageExpired(messageId);
      expect(isExpired).to.be.false;
    });

    it("Should allow purchasing non-expiring messages after time passes", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("non-expiring message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n; // No expiration

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Wait some time
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should still be able to purchase
      await expect(messageMarketplace.connect(buyer).purchaseMessage(messageId))
        .to.emit(messageMarketplace, "MessagePurchased");
    });
  });

  describe("Purchase Details", function () {
    it("Should return correct purchase details", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Get EVM block timestamp before purchase
      const beforeBlock = await ethers.provider.getBlock("latest");
      const beforePurchase = beforeBlock!.timestamp;

      // Purchase message
      const purchaseTx = await messageMarketplace.connect(buyer).purchaseMessage(messageId);
      await purchaseTx.wait();

      // Get EVM block timestamp after purchase
      const afterBlock = await ethers.provider.getBlock("latest");
      const afterPurchase = afterBlock!.timestamp;

      // Get purchase details
      const purchaseDetails = await messageMarketplace.getPurchaseDetails(messageId, buyerAddress);

      expect(purchaseDetails.timestamp).to.be.gte(beforePurchase);
      expect(purchaseDetails.timestamp).to.be.lte(afterPurchase);
      expect(purchaseDetails.price).to.equal(price);
    });

    it("Should return zero values for non-purchased messages", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Get purchase details for non-purchased message
      const purchaseDetails = await messageMarketplace.getPurchaseDetails(messageId, buyerAddress);

      expect(purchaseDetails.timestamp).to.equal(0);
      expect(purchaseDetails.price).to.equal(0);
    });

    it("Should return zero values for non-existent messages", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("non-existent message"));

      // Get purchase details for non-existent message
      const purchaseDetails = await messageMarketplace.getPurchaseDetails(messageId, buyerAddress);

      expect(purchaseDetails.timestamp).to.equal(0);
      expect(purchaseDetails.price).to.equal(0);
    });
  });

  describe("Fee Distribution", function () {
    it("Should correctly distribute fees for different price points", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("100", 6); // 100 USDC
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const initialBuyerBalance = await usdc.balanceOf(buyerAddress);
      const initialCreatorBalance = await usdc.balanceOf(creatorAddress);
      const initialSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      await messageMarketplace.connect(buyer).purchaseMessage(messageId);

      const finalBuyerBalance = await usdc.balanceOf(buyerAddress);
      const finalCreatorBalance = await usdc.balanceOf(creatorAddress);
      const finalSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      // 10% fee = 10 USDC
      const expectedFee = ethers.parseUnits("10", 6);
      // 90% to creator = 90 USDC
      const expectedCreatorAmount = ethers.parseUnits("90", 6);

      expect(finalSystemBalance - initialSystemBalance).to.equal(expectedFee);
      expect(finalCreatorBalance - initialCreatorBalance).to.equal(expectedCreatorAmount);
      expect(initialBuyerBalance - finalBuyerBalance).to.equal(price);
    });

    it("Should handle small amounts correctly", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("1", 6); // 1 USDC
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      const initialBuyerBalance = await usdc.balanceOf(buyerAddress);
      const initialCreatorBalance = await usdc.balanceOf(creatorAddress);
      const initialSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      await messageMarketplace.connect(buyer).purchaseMessage(messageId);

      const finalBuyerBalance = await usdc.balanceOf(buyerAddress);
      const finalCreatorBalance = await usdc.balanceOf(creatorAddress);
      const finalSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      // 10% fee = 0.1 USDC
      const expectedFee = ethers.parseUnits("0.1", 6);
      // 90% to creator = 0.9 USDC
      const expectedCreatorAmount = ethers.parseUnits("0.9", 6);

      expect(finalSystemBalance - initialSystemBalance).to.equal(expectedFee);
      expect(finalCreatorBalance - initialCreatorBalance).to.equal(expectedCreatorAmount);
      expect(initialBuyerBalance - finalBuyerBalance).to.equal(price);
    });
  });

  describe("System Fee Address Management", function () {
    it("Should allow owner to update system fee address", async function () {
      const [_, __, ___, ____, newFeeAddress] = await ethers.getSigners();
      const newFeeAddressString = await newFeeAddress.getAddress();

      await messageMarketplace.connect(owner).updateSystemFeeAddress(newFeeAddressString);
      expect(await messageMarketplace.systemFeeAddress()).to.equal(newFeeAddressString);
    });

    it("Should not allow non-owner to update system fee address", async function () {
      const [_, __, ___, ____, newFeeAddress] = await ethers.getSigners();
      const newFeeAddressString = await newFeeAddress.getAddress();

      await expect(
        messageMarketplace.connect(creator).updateSystemFeeAddress(newFeeAddressString)
      ).to.be.revertedWithCustomError(messageMarketplace, "OwnableUnauthorizedAccount");
    });

    it("Should not allow setting zero address as system fee address", async function () {
      await expect(
        messageMarketplace.connect(owner).updateSystemFeeAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee address");
    });
  });

  describe("Invalid Operations", function () {
    it("Should not allow purchasing non-existent message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("non-existent message"));

      await expect(
        messageMarketplace.connect(buyer).purchaseMessage(messageId)
      ).to.be.revertedWith("Message does not exist");
    });

    it("Should not allow purchasing message without USDC approval", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);
      
      // Revoke approval
      await usdc.connect(buyer).approve(await messageMarketplace.getAddress(), 0);

      await expect(
        messageMarketplace.connect(buyer).purchaseMessage(messageId)
      ).to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");
    });

    it("Should not allow purchasing message with insufficient USDC balance", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10000", 6); // 10000 USDC
      const expireAt = 0n;

      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Approve the contract to spend tokens
      await usdc.connect(buyer).approve(await messageMarketplace.getAddress(), price);

      // Now try to purchase with insufficient balance
      await expect(
        messageMarketplace.connect(buyer).purchaseMessage(messageId)
      ).to.be.revertedWithCustomError(usdc, "ERC20InsufficientBalance");
    });
  });

  describe("Fee Management", () => {
    it("Should allow owner to update fee percentage", async () => {
      const newFeePercentage = 750; // 7.5%
      const tx = await messageMarketplace.updateFeePercentage(newFeePercentage);
      await tx.wait();

      expect(await messageMarketplace.feePercentage()).to.equal(newFeePercentage);
    });

    it("Should emit FeePercentageUpdated event", async () => {
      const newFeePercentage = 600; // 6%
      const tx = await messageMarketplace.updateFeePercentage(newFeePercentage);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "FeePercentageUpdated"
      );
      expect(event).to.not.be.undefined;
      expect(event?.args[0]).to.equal(1000); // Old fee
      expect(event?.args[1]).to.equal(newFeePercentage); // New fee
    });

    it("Should not allow non-owner to update fee percentage", async () => {
      const newFeePercentage = 800;
      await expect(
        messageMarketplace.connect(buyer).updateFeePercentage(newFeePercentage)
      ).to.be.revertedWithCustomError(messageMarketplace, "OwnableUnauthorizedAccount");
    });

    it("Should not allow fee percentage above 100%", async () => {
      const tooHighFee = 10001; // 100.01%
      await expect(
        messageMarketplace.updateFeePercentage(tooHighFee)
      ).to.be.revertedWith("Fee percentage too high");
    });
  });

  describe("USDC Address Management", () => {
    it("Should allow owner to update USDC address", async () => {
      const newUSDCAddress = "0x1234567890123456789012345678901234567890";
      const tx = await messageMarketplace.updateUSDCAddress(newUSDCAddress);
      await tx.wait();

      expect(await messageMarketplace.usdc()).to.equal(newUSDCAddress);
    });

    it("Should emit USDCAddressUpdated event", async () => {
      const newUSDCAddress = "0x1234567890123456789012345678901234567890";
      const tx = await messageMarketplace.updateUSDCAddress(newUSDCAddress);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "USDCAddressUpdated"
      );
      expect(event).to.not.be.undefined;
      expect(event?.args[0]).to.equal(await usdc.getAddress()); // Old address
      expect(event?.args[1]).to.equal(newUSDCAddress); // New address
    });

    it("Should not allow non-owner to update USDC address", async () => {
      const newUSDCAddress = "0x1234567890123456789012345678901234567890";
      await expect(
        messageMarketplace.connect(buyer).updateUSDCAddress(newUSDCAddress)
      ).to.be.revertedWithCustomError(messageMarketplace, "OwnableUnauthorizedAccount");
    });

    it("Should not allow zero address for USDC", async () => {
      await expect(
        messageMarketplace.updateUSDCAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid USDC address");
    });
  });

  describe("System Fee Address Management", () => {
    it("Should allow owner to update system fee address", async () => {
      const newFeeAddress = "0x1234567890123456789012345678901234567890";
      const tx = await messageMarketplace.updateSystemFeeAddress(newFeeAddress);
      await tx.wait();

      expect(await messageMarketplace.systemFeeAddress()).to.equal(newFeeAddress);
    });

    it("Should emit SystemFeeAddressUpdated event", async () => {
      const newFeeAddress = "0x1234567890123456789012345678901234567890";
      const tx = await messageMarketplace.updateSystemFeeAddress(newFeeAddress);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "SystemFeeAddressUpdated"
      );
      expect(event).to.not.be.undefined;
      expect(event?.args[0]).to.equal(systemFeeAddressString); // Old address
      expect(event?.args[1]).to.equal(newFeeAddress); // New address
    });

    it("Should not allow non-owner to update system fee address", async () => {
      const newFeeAddress = "0x1234567890123456789012345678901234567890";
      await expect(
        messageMarketplace.connect(buyer).updateSystemFeeAddress(newFeeAddress)
      ).to.be.revertedWithCustomError(messageMarketplace, "OwnableUnauthorizedAccount");
    });

    it("Should not allow zero address for system fee", async () => {
      await expect(
        messageMarketplace.updateSystemFeeAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee address");
    });
  });

  describe("Fee Calculation with Different Percentages", () => {
    it("Should calculate fees correctly with 5% fee", async () => {
      // Update fee to 5%
      await messageMarketplace.updateFeePercentage(500);

      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message 5%"));
      const price = ethers.parseUnits("100", 6); // 100 USDC
      const expireAt = 0n;

      // Create message first
      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Get initial balances
      const initialCreatorBalance = await usdc.balanceOf(creator.address);
      const initialSystemBalance = await usdc.balanceOf(await messageMarketplace.systemFeeAddress());

      // Setup buyer
      await usdc.mint(buyer.address, price);
      await usdc.connect(buyer).approve(await messageMarketplace.getAddress(), price);

      // Purchase message
      const tx = await messageMarketplace.connect(buyer).purchaseMessage(messageId);
      const receipt = await tx.wait();

      // Get final balances
      const finalCreatorBalance = await usdc.balanceOf(creator.address);
      const finalSystemBalance = await usdc.balanceOf(await messageMarketplace.systemFeeAddress());

      // Calculate expected amounts using BASIS_POINTS (10000)
      const expectedSystemFee = (price * 500n) / 10000n; // 5% of price
      const expectedCreatorAmount = price - expectedSystemFee; // Remaining amount

      // Calculate actual changes
      const actualSystemFee = finalSystemBalance - initialSystemBalance;
      const actualCreatorAmount = finalCreatorBalance - initialCreatorBalance;

      // Verify balances
      expect(actualSystemFee).to.equal(expectedSystemFee);
      expect(actualCreatorAmount).to.equal(expectedCreatorAmount);
    });

    it("Should calculate fees correctly with 7.5% fee", async () => {
      // Update fee to 7.5%
      await messageMarketplace.updateFeePercentage(750);

      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message 7.5%"));
      const price = ethers.parseUnits("100", 6); // 100 USDC
      const expireAt = 0n;

      // Create message first
      await messageMarketplace.connect(creator).createMessage(messageId, price, expireAt);

      // Get initial balances
      const initialCreatorBalance = await usdc.balanceOf(creator.address);
      const initialSystemBalance = await usdc.balanceOf(await messageMarketplace.systemFeeAddress());

      // Setup buyer
      await usdc.mint(buyer.address, price);
      await usdc.connect(buyer).approve(await messageMarketplace.getAddress(), price);
      // Purchase message
      const tx = await messageMarketplace.connect(buyer).purchaseMessage(messageId);
      const receipt = await tx.wait();

      // Get final balances
      const finalCreatorBalance = await usdc.balanceOf(creator.address);
      const finalSystemBalance = await usdc.balanceOf(await messageMarketplace.systemFeeAddress());

      // Calculate expected amounts using BASIS_POINTS (10000)
      const expectedSystemFee = (price * 750n) / 10000n; // 7.5% of price
      const expectedCreatorAmount = price - expectedSystemFee; // Remaining amount

      // Calculate actual changes
      const actualSystemFee = finalSystemBalance - initialSystemBalance;
      const actualCreatorAmount = finalCreatorBalance - initialCreatorBalance;

      // Verify balances
      expect(actualSystemFee).to.equal(expectedSystemFee);
      expect(actualCreatorAmount).to.equal(expectedCreatorAmount);
    });
  });
}); 