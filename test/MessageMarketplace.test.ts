import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("MessageMarketplace", function () {
  let messageMarketplace: Contract;
  let usdc: Contract;
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

    // Deploy MessageMarketplace
    const MessageMarketplace = await ethers.getContractFactory("MessageMarketplace");
    const marketplace = await MessageMarketplace.deploy(
      await mockUSDC.getAddress(),
      await systemFeeAddress.getAddress(),
      1000 // 10% fee (1000 basis points)
    );
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
    it("Should create a message successfully", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6); // 10 USDC

      await expect(messageMarketplace.connect(creator).createMessage(messageId, price))
        .to.emit(messageMarketplace, "MessageCreated")
        .withArgs(messageId, creatorAddress, price);

      const message = await messageMarketplace.getMessage(messageId);
      expect(message.creator).to.equal(creatorAddress);
      expect(message.price).to.equal(price);
      expect(message.exists).to.be.true;
    });

    it("Should not allow creating a message with the same ID", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);

      await messageMarketplace.connect(creator).createMessage(messageId, price);

      await expect(
        messageMarketplace.connect(creator).createMessage(messageId, price)
      ).to.be.revertedWith("Message already exists");
    });

    it("Should not allow creating a message with zero price", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = 0;

      await expect(
        messageMarketplace.connect(creator).createMessage(messageId, price)
      ).to.be.revertedWith("Price must be greater than 0");
    });
  });

  describe("Message Purchase", function () {
    it("Should purchase a message successfully", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);

      await messageMarketplace.connect(creator).createMessage(messageId, price);

      const initialBuyerBalance = await usdc.balanceOf(buyerAddress);
      const initialCreatorBalance = await usdc.balanceOf(creatorAddress);
      const initialSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      await expect(messageMarketplace.connect(buyer).purchaseMessage(messageId))
        .to.emit(messageMarketplace, "MessagePurchased")
        .withArgs(messageId, buyerAddress, price);

      const finalBuyerBalance = await usdc.balanceOf(buyerAddress);
      const finalCreatorBalance = await usdc.balanceOf(creatorAddress);
      const finalSystemBalance = await usdc.balanceOf(systemFeeAddressString);

      expect(finalBuyerBalance).to.equal(initialBuyerBalance - price);
      expect(finalCreatorBalance).to.equal(initialCreatorBalance + (price * 90n) / 100n);
      expect(finalSystemBalance).to.equal(initialSystemBalance + (price * 10n) / 100n);
    });

    it("Should allow multiple purchases of the same message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);

      await messageMarketplace.connect(creator).createMessage(messageId, price);
      
      // First purchase
      await messageMarketplace.connect(buyer).purchaseMessage(messageId);
      
      // Second purchase by the same buyer
      await expect(messageMarketplace.connect(buyer).purchaseMessage(messageId))
        .to.emit(messageMarketplace, "MessagePurchased")
        .withArgs(messageId, buyerAddress, price);
    });

    it("Should track message purchases by specific buyers", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);
      const [_, __, ___, buyer2] = await ethers.getSigners();
      const buyer2Address = await buyer2.getAddress();

      // Setup buyer2 with USDC
      await usdc.mint(buyer2Address, ethers.parseUnits("1000", 6));
      await usdc.connect(buyer2).approve(await messageMarketplace.getAddress(), ethers.parseUnits("1000", 6));

      // Create message
      await messageMarketplace.connect(creator).createMessage(messageId, price);
      
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
    });

    it("Should not allow creator to purchase their own message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10", 6);

      await messageMarketplace.connect(creator).createMessage(messageId, price);

      await expect(
        messageMarketplace.connect(creator).purchaseMessage(messageId)
      ).to.be.revertedWith("Creator cannot purchase their own message");
    });
  });

  describe("Fee Distribution", function () {
    it("Should correctly distribute fees for different price points", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("100", 6); // 100 USDC

      await messageMarketplace.connect(creator).createMessage(messageId, price);

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

      await messageMarketplace.connect(creator).createMessage(messageId, price);

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

      await messageMarketplace.connect(creator).createMessage(messageId, price);
      
      // Revoke approval
      await usdc.connect(buyer).approve(await messageMarketplace.getAddress(), 0);

      await expect(
        messageMarketplace.connect(buyer).purchaseMessage(messageId)
      ).to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");
    });

    it("Should not allow purchasing message with insufficient USDC balance", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const price = ethers.parseUnits("10000", 6); // 10000 USDC

      await messageMarketplace.connect(creator).createMessage(messageId, price);

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

      // Create message first
      await messageMarketplace.connect(creator).createMessage(messageId, price);

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

      // Create message first
      await messageMarketplace.connect(creator).createMessage(messageId, price);

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