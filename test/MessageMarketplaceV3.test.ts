import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
// import { MessageMarketplaceV3 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MockERC20 } from "../typechain-types";

describe("MessageMarketplaceV3", function () {
  let marketplace: any; // Will be typed after contract deployment
  let mockToken: MockERC20;
  let owner: SignerWithAddress;
  let signer: SignerWithAddress;
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const FEE_PERCENTAGE = 1000; // 10%
  const BASIS_POINTS = 10000;

  beforeEach(async function () {
    [owner, signer, buyer, seller, feeRecipient, unauthorized] = await ethers.getSigners();

    // Deploy MessageMarketplaceV3
    const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
    marketplace = await upgrades.deployProxy(MessageMarketplaceV3, [
      feeRecipient.address,
      FEE_PERCENTAGE
    ], {
      initializer: "initialize",
      kind: "uups"
    });

    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Test Token", "TEST", 18) as MockERC20;

    // Add signer
    await marketplace.addSigner(signer.address);

    // Mint tokens to buyer
    await mockToken.mint(buyer.address, ethers.parseEther("1000"));
  });

  describe("Initialization", function () {
    it("Should initialize with correct parameters", async function () {
      expect(await marketplace.systemFeeAddress()).to.equal(feeRecipient.address);
      expect(await marketplace.feePercentage()).to.equal(FEE_PERCENTAGE);
      expect(await marketplace.owner()).to.equal(owner.address);
    });

    it("Should not allow invalid fee percentage", async function () {
      const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
      await expect(
        upgrades.deployProxy(MessageMarketplaceV3, [
          feeRecipient.address,
          BASIS_POINTS + 1 // Invalid: > 100%
        ], {
          initializer: "initialize",
          kind: "uups"
        })
      ).to.be.revertedWith("Fee percentage too high");
    });
  });

  describe("Signer Management", function () {
    it("Should add signer successfully", async function () {
      await expect(marketplace.addSigner(unauthorized.address))
        .to.emit(marketplace, "SignerAdded")
        .withArgs(unauthorized.address);
      
      expect(await marketplace.isSigner(unauthorized.address)).to.be.true;
    });

    it("Should remove signer successfully", async function () {
      await expect(marketplace.removeSigner(signer.address))
        .to.emit(marketplace, "SignerRemoved")
        .withArgs(signer.address);
      
      expect(await marketplace.isSigner(signer.address)).to.be.false;
    });

    it("Should not allow non-owner to add signer", async function () {
      await expect(
        marketplace.connect(unauthorized).addSigner(unauthorized.address)
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });

    it("Should not allow adding zero address as signer", async function () {
      await expect(
        marketplace.addSigner(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid signer address");
    });

    it("Should not allow adding existing signer", async function () {
      await expect(
        marketplace.addSigner(signer.address)
      ).to.be.revertedWith("Signer already exists");
    });

    it("Should not allow removing non-existent signer", async function () {
      await expect(
        marketplace.removeSigner(unauthorized.address)
      ).to.be.revertedWith("Signer does not exist");
    });
  });


  describe("ERC-20 Token Purchase", function () {
    const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-erc20"));
    const amount = ethers.parseEther("100");
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    beforeEach(async function () {
      // Approve marketplace to spend tokens
      await mockToken.connect(buyer).approve(await marketplace.getAddress(), amount);
    });

    it("Should purchase message with ERC-20 token successfully", async function () {
      // Create signature
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      const initialSellerBalance = await mockToken.balanceOf(seller.address);
      const initialFeeBalance = await mockToken.balanceOf(feeRecipient.address);

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature
        )
      ).to.emit(marketplace, "MessagePurchased")
        .withArgs(messageId, buyer.address, seller.address, amount, await mockToken.getAddress(), 31337); // Hardhat default chainId

      const finalSellerBalance = await mockToken.balanceOf(seller.address);
      const finalFeeBalance = await mockToken.balanceOf(feeRecipient.address);

      const expectedSellerAmount = amount - (amount * BigInt(FEE_PERCENTAGE) / BigInt(BASIS_POINTS));
      const expectedFeeAmount = amount * BigInt(FEE_PERCENTAGE) / BigInt(BASIS_POINTS);

      expect(finalSellerBalance - initialSellerBalance).to.equal(expectedSellerAmount);
      expect(finalFeeBalance - initialFeeBalance).to.equal(expectedFeeAmount);
    });

    it("Should reject expired signature", async function () {
      const expiredDeadline = Math.floor(Date.now() / 1000) - 3600;
      
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), amount, expiredDeadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          expiredDeadline,
          signature
        )
      ).to.be.revertedWith("Signature expired");
    });

    it("Should reject invalid signature", async function () {
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature = await unauthorized.signMessage(ethers.getBytes(dataHash));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject zero token address", async function () {
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, ethers.ZeroAddress, amount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          ethers.ZeroAddress,
          amount,
          deadline,
          signature
        )
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should reject zero amount", async function () {
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), 0, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          0,
          deadline,
          signature
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should reject zero seller address", async function () {
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, ethers.ZeroAddress, await mockToken.getAddress(), amount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature
        )
      ).to.be.revertedWith("Invalid seller address");
    });

    it("Should handle insufficient token allowance", async function () {
      // Don't approve tokens
      await mockToken.connect(buyer).approve(await marketplace.getAddress(), 0);

      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature
        )
      ).to.be.revertedWithCustomError(mockToken, "ERC20InsufficientAllowance");
    });

    it("Should handle insufficient token balance", async function () {
      // Transfer all tokens away from buyer
      await mockToken.connect(buyer).transfer(owner.address, await mockToken.balanceOf(buyer.address));

      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature
        )
      ).to.be.revertedWithCustomError(mockToken, "ERC20InsufficientBalance");
    });

    it("Should handle zero fee percentage", async function () {
      // Set fee percentage to 0
      await marketplace.updateFeePercentage(0);

      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      const initialSellerBalance = await mockToken.balanceOf(seller.address);
      const initialFeeBalance = await mockToken.balanceOf(feeRecipient.address);

      await marketplace.connect(buyer).purchaseOffchainMessage(
        messageId,
        seller.address,
        await mockToken.getAddress(),
        amount,
        deadline,
        signature
      );

      const finalSellerBalance = await mockToken.balanceOf(seller.address);
      const finalFeeBalance = await mockToken.balanceOf(feeRecipient.address);

      // Seller should get full amount, fee recipient should get nothing
      expect(finalSellerBalance - initialSellerBalance).to.equal(amount);
      expect(finalFeeBalance - initialFeeBalance).to.equal(0);
    });

    it("Should handle maximum fee percentage", async function () {
      // Set fee percentage to 100%
      await marketplace.updateFeePercentage(BASIS_POINTS);

      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      const initialSellerBalance = await mockToken.balanceOf(seller.address);
      const initialFeeBalance = await mockToken.balanceOf(feeRecipient.address);

      await marketplace.connect(buyer).purchaseOffchainMessage(
        messageId,
        seller.address,
        await mockToken.getAddress(),
        amount,
        deadline,
        signature
      );

      const finalSellerBalance = await mockToken.balanceOf(seller.address);
      const finalFeeBalance = await mockToken.balanceOf(feeRecipient.address);

      // Seller should get nothing, fee recipient should get full amount
      expect(finalSellerBalance - initialSellerBalance).to.equal(0);
      expect(finalFeeBalance - initialFeeBalance).to.equal(amount);
    });

    it("Should work with different token amounts", async function () {
      const smallAmount = ethers.parseEther("0.001");
      const largeAmount = ethers.parseEther("10000");

      // Mint more tokens for large amount test
      await mockToken.mint(buyer.address, largeAmount);

      // Test small amount
      await mockToken.connect(buyer).approve(await marketplace.getAddress(), smallAmount);
      const smallDataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), smallAmount, deadline]
      ));
      const smallSignature = await signer.signMessage(ethers.getBytes(smallDataHash));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          smallAmount,
          deadline,
          smallSignature
        )
      ).to.emit(marketplace, "MessagePurchased");

      // Test large amount
      const largeMessageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-large"));
      await mockToken.connect(buyer).approve(await marketplace.getAddress(), largeAmount);
      const largeDataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [largeMessageId, seller.address, await mockToken.getAddress(), largeAmount, deadline]
      ));
      const largeSignature = await signer.signMessage(ethers.getBytes(largeDataHash));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          largeMessageId,
          seller.address,
          await mockToken.getAddress(),
          largeAmount,
          deadline,
          largeSignature
        )
      ).to.emit(marketplace, "MessagePurchased");
    });

    it("Should work with different sellers", async function () {
      const seller2 = unauthorized; // Use existing signer as seller2
      const amount2 = ethers.parseEther("50");

      const differentSellerMessageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-different-seller"));
      await mockToken.connect(buyer).approve(await marketplace.getAddress(), amount2);
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [differentSellerMessageId, seller2.address, await mockToken.getAddress(), amount2, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          differentSellerMessageId,
          seller2.address,
          await mockToken.getAddress(),
          amount2,
          deadline,
          signature
        )
      ).to.emit(marketplace, "MessagePurchased")
        .withArgs(differentSellerMessageId, buyer.address, seller2.address, amount2, await mockToken.getAddress(), 31337);
    });
  });

  describe("Fee Management", function () {
    it("Should update fee percentage", async function () {
      const newFeePercentage = 500; // 5%
      
      await expect(marketplace.updateFeePercentage(newFeePercentage))
        .to.emit(marketplace, "FeePercentageUpdated")
        .withArgs(FEE_PERCENTAGE, newFeePercentage);
      
      expect(await marketplace.feePercentage()).to.equal(newFeePercentage);
    });

    it("Should update system fee address", async function () {
      await expect(marketplace.updateSystemFeeAddress(unauthorized.address))
        .to.emit(marketplace, "SystemFeeAddressUpdated")
        .withArgs(feeRecipient.address, unauthorized.address);
      
      expect(await marketplace.systemFeeAddress()).to.equal(unauthorized.address);
    });

    it("Should not allow invalid fee percentage", async function () {
      await expect(
        marketplace.updateFeePercentage(BASIS_POINTS + 1)
      ).to.be.revertedWith("Fee percentage too high");
    });

    it("Should not allow zero fee address", async function () {
      await expect(
        marketplace.updateSystemFeeAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee address");
    });
  });

  describe("Old Flow Disabled", function () {
    it("Should reject old createMessage function", async function () {
      await expect(
        marketplace.createMessage(ethers.keccak256(ethers.toUtf8Bytes("test")), ethers.parseEther("1"), 0)
      ).to.be.revertedWith("V3: Old message creation flow disabled. Use off-chain flow.");
    });

    it("Should reject old purchaseMessage function", async function () {
      await expect(
        marketplace.purchaseMessage(ethers.keccak256(ethers.toUtf8Bytes("test")))
      ).to.be.revertedWith("V3: Old message purchase flow disabled. Use off-chain flow.");
    });

    it("Should reject old purchaseMessageByFiat function", async function () {
      await expect(
        marketplace.purchaseMessageByFiat(
          ethers.keccak256(ethers.toUtf8Bytes("test")),
          ethers.keccak256(ethers.toUtf8Bytes("hash")),
          ethers.keccak256(ethers.toUtf8Bytes("validation"))
        )
      ).to.be.revertedWith("V3: Old fiat purchase flow disabled. Use off-chain flow.");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to withdraw ERC-20 tokens", async function () {
      // Mint tokens to contract
      await mockToken.mint(await marketplace.getAddress(), ethers.parseEther("100"));

      const initialBalance = await mockToken.balanceOf(owner.address);
      
      await marketplace.emergencyWithdraw(await mockToken.getAddress(), ethers.parseEther("100"));
      
      const finalBalance = await mockToken.balanceOf(owner.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("100"));
    });

    it("Should reject zero token address for emergency withdrawal", async function () {
      await expect(
        marketplace.emergencyWithdraw(ethers.ZeroAddress, ethers.parseEther("100"))
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should not allow non-owner to withdraw", async function () {
      await expect(
        marketplace.connect(unauthorized).emergencyWithdraw(await mockToken.getAddress(), ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });

    it("Should handle withdrawal of zero amount", async function () {
      // Mint tokens to contract
      await mockToken.mint(await marketplace.getAddress(), ethers.parseEther("100"));

      const initialBalance = await mockToken.balanceOf(owner.address);
      
      await marketplace.emergencyWithdraw(await mockToken.getAddress(), 0);
      
      const finalBalance = await mockToken.balanceOf(owner.address);
      expect(finalBalance - initialBalance).to.equal(0);
    });
  });

  describe("View Functions", function () {
    it("Should return correct fee configuration", async function () {
      const [feeAddress, feePercentage] = await marketplace.getFeeConfiguration();
      expect(feeAddress).to.equal(feeRecipient.address);
      expect(feePercentage).to.equal(FEE_PERCENTAGE);
    });

    it("Should return correct signer status", async function () {
      expect(await marketplace.isSigner(signer.address)).to.be.true;
      expect(await marketplace.isSigner(unauthorized.address)).to.be.false;
    });
  });

  describe("Cross-chain Signature Compatibility", function () {
    it("Should work with same signature across different message parameters", async function () {
      const messageId1 = ethers.keccak256(ethers.toUtf8Bytes("message-1"));
      const messageId2 = ethers.keccak256(ethers.toUtf8Bytes("message-2"));
      const amount = ethers.parseEther("1.0");
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Approve tokens for both purchases
      await mockToken.connect(buyer).approve(await marketplace.getAddress(), amount * 2n);

      // Create signature for first message
      const dataHash1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId1, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature1 = await signer.signMessage(ethers.getBytes(dataHash1));

      // Create signature for second message (different messageId)
      const dataHash2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId2, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature2 = await signer.signMessage(ethers.getBytes(dataHash2));

      // Both should work independently
      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId1,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature1
        )
      ).to.emit(marketplace, "MessagePurchased");

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId2,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature2
        )
      ).to.emit(marketplace, "MessagePurchased");
    });

    it("Should work with different tokens for same message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("multi-token-message"));
      const amount = ethers.parseEther("100");
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Deploy second token
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const mockToken2 = await MockERC20.deploy("Test Token 2", "TEST2", 18) as MockERC20;
      await mockToken2.mint(buyer.address, ethers.parseEther("1000"));

      // Approve both tokens
      await mockToken.connect(buyer).approve(await marketplace.getAddress(), amount);
      await mockToken2.connect(buyer).approve(await marketplace.getAddress(), amount);

      // Create signatures for different tokens
      const dataHash1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature1 = await signer.signMessage(ethers.getBytes(dataHash1));

      const messageId2 = ethers.keccak256(ethers.toUtf8Bytes("multi-token-message-2"));
      const dataHash2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId2, seller.address, await mockToken2.getAddress(), amount, deadline]
      ));
      const signature2 = await signer.signMessage(ethers.getBytes(dataHash2));

      // Both should work
      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature1
        )
      ).to.emit(marketplace, "MessagePurchased");

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId2,
          seller.address,
          await mockToken2.getAddress(),
          amount,
          deadline,
          signature2
        )
      ).to.emit(marketplace, "MessagePurchased");
    });
  });

  describe("Advanced Signer Management", function () {
    it("Should handle multiple signers", async function () {
      const signer2 = unauthorized; // Use existing signer as signer2
      const signer3 = feeRecipient; // Use existing signer as signer3

      // Add multiple signers
      await marketplace.addSigner(signer2.address);
      await marketplace.addSigner(signer3.address);

      expect(await marketplace.isSigner(signer.address)).to.be.true;
      expect(await marketplace.isSigner(signer2.address)).to.be.true;
      expect(await marketplace.isSigner(signer3.address)).to.be.true;

      // All signers should be able to sign
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("multi-signer-test"));
      const amount = ethers.parseEther("50");
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await mockToken.connect(buyer).approve(await marketplace.getAddress(), amount * 3n);

      // Test with original signer
      const dataHash1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature1 = await signer.signMessage(ethers.getBytes(dataHash1));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature1
        )
      ).to.emit(marketplace, "MessagePurchased");

      // Test with second signer
      const messageId2 = ethers.keccak256(ethers.toUtf8Bytes("multi-signer-test-2"));
      const dataHash2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId2, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature2 = await signer2.signMessage(ethers.getBytes(dataHash2));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId2,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature2
        )
      ).to.emit(marketplace, "MessagePurchased");

      // Test with third signer
      const messageId3 = ethers.keccak256(ethers.toUtf8Bytes("multi-signer-test-3"));
      const dataHash3 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId3, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature3 = await signer3.signMessage(ethers.getBytes(dataHash3));

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId3,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature3
        )
      ).to.emit(marketplace, "MessagePurchased");
    });

    it("Should handle signer removal and re-addition", async function () {
      const newSigner = unauthorized; // Use existing signer as newSigner

      // Add signer
      await marketplace.addSigner(newSigner.address);
      expect(await marketplace.isSigner(newSigner.address)).to.be.true;

      // Remove signer
      await marketplace.removeSigner(newSigner.address);
      expect(await marketplace.isSigner(newSigner.address)).to.be.false;

      // Re-add signer
      await marketplace.addSigner(newSigner.address);
      expect(await marketplace.isSigner(newSigner.address)).to.be.true;
    });

    it("Should emit correct events for signer management", async function () {
      const newSigner = feeRecipient; // Use existing signer as newSigner

      // Test addSigner event
      await expect(marketplace.addSigner(newSigner.address))
        .to.emit(marketplace, "SignerAdded")
        .withArgs(newSigner.address);

      // Test removeSigner event
      await expect(marketplace.removeSigner(newSigner.address))
        .to.emit(marketplace, "SignerRemoved")
        .withArgs(newSigner.address);
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should handle signature with wrong messageId", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("correct-message"));
      const wrongMessageId = ethers.keccak256(ethers.toUtf8Bytes("wrong-message"));
      const amount = ethers.parseEther("100");
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await mockToken.connect(buyer).approve(await marketplace.getAddress(), amount);

      // Create signature with wrong messageId
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [wrongMessageId, seller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      // Should fail when using correct messageId with wrong signature
      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should handle signature with wrong seller", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("seller-test"));
      const amount = ethers.parseEther("100");
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const wrongSeller = feeRecipient; // Use existing signer as wrongSeller

      await mockToken.connect(buyer).approve(await marketplace.getAddress(), amount);

      // Create signature with wrong seller
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, wrongSeller.address, await mockToken.getAddress(), amount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      // Should fail when using correct seller with wrong signature
      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should handle signature with wrong token", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("token-test"));
      const amount = ethers.parseEther("100");
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const wrongToken = feeRecipient.address; // Use existing address as wrongToken

      await mockToken.connect(buyer).approve(await marketplace.getAddress(), amount);

      // Create signature with wrong token
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, wrongToken, amount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      // Should fail when using correct token with wrong signature
      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should handle signature with wrong amount", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("amount-test"));
      const amount = ethers.parseEther("100");
      const wrongAmount = ethers.parseEther("200");
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await mockToken.connect(buyer).approve(await marketplace.getAddress(), amount);

      // Create signature with wrong amount
      const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [messageId, seller.address, await mockToken.getAddress(), wrongAmount, deadline]
      ));
      const signature = await signer.signMessage(ethers.getBytes(dataHash));

      // Should fail when using correct amount with wrong signature
      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should handle malformed signature", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("malformed-test"));
      const amount = ethers.parseEther("100");
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await mockToken.connect(buyer).approve(await marketplace.getAddress(), amount);

      // Use malformed signature
      const malformedSignature = "0x1234";

      await expect(
        marketplace.connect(buyer).purchaseOffchainMessage(
          messageId,
          seller.address,
          await mockToken.getAddress(),
          amount,
          deadline,
          malformedSignature
        )
      ).to.be.reverted;
    });
  });
});
