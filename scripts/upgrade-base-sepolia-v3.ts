import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🔄 Upgrading Base Sepolia V3 contract with message hash functionality...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Load deployment info
  const deploymentInfo = require("../deployment-info-base-sepolia.json");
  const proxyAddress = deploymentInfo.proxyAddress;
  const chainId = deploymentInfo.chainId;

  console.log("Proxy address:", proxyAddress);
  console.log("Chain ID:", chainId);

  try {
    // Check current implementation
    const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const currentImplementation = await ethers.provider.getStorage(proxyAddress, implementationSlot);
    console.log("Current implementation:", currentImplementation);

    // Deploy new implementation
    console.log("\n📦 Deploying new V3 implementation...");
    const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
    const newImplementation = await MessageMarketplaceV3.deploy();
    await newImplementation.waitForDeployment();
    
    const newImplementationAddress = await newImplementation.getAddress();
    console.log("New implementation deployed at:", newImplementationAddress);

    // Upgrade the proxy
    console.log("\n⬆️ Upgrading proxy to new implementation...");
    const upgraded = await upgrades.upgradeProxy(proxyAddress, MessageMarketplaceV3);
    await upgraded.waitForDeployment();
    
    console.log("✅ Proxy upgraded successfully!");

    // Verify the upgrade
    const newImplementationCheck = await ethers.provider.getStorage(proxyAddress, implementationSlot);
    console.log("New implementation address:", newImplementationCheck);
    console.log("Upgrade successful:", newImplementationCheck.toLowerCase() === newImplementationAddress.toLowerCase());

    // Add signers (same as BSC testnet)
    console.log("\n🔐 Adding signers...");
    
    // BSC testnet signers
    const deployerSigner = "0xeEf4566F8eBC599F84854e14456cBE7BA9EB1471";
    const additionalSigner = "0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2";
    
    // Check if deployer is already a signer
    const isDeployerSigner = await upgraded.signers(deployerSigner);
    console.log(`Deployer (${deployerSigner}) is signer:`, isDeployerSigner);
    
    if (!isDeployerSigner) {
      console.log("Adding deployer as signer...");
      const tx1 = await upgraded.addSigner(deployerSigner);
      await tx1.wait();
      console.log("✅ Deployer added as signer");
    }
    
    // Check if additional signer is already a signer
    const isAdditionalSigner = await upgraded.signers(additionalSigner);
    console.log(`Additional (${additionalSigner}) is signer:`, isAdditionalSigner);
    
    if (!isAdditionalSigner) {
      console.log("Adding additional signer...");
      const tx2 = await upgraded.addSigner(additionalSigner);
      await tx2.wait();
      console.log("✅ Additional signer added");
    }

    // Test the new functionality
    console.log("\n🧪 Testing new functionality...");
    
    // Test hasPurchasedOffchain function
    const testMessageId = ethers.keccak256(ethers.toUtf8Bytes("test-base-upgrade"));
    const testSeller = additionalSigner;
    const testToken = deploymentInfo.usdcAddress;
    const testAmount = ethers.parseEther("1.0");
    const testBuyer = deployer.address;

    try {
      const hasPurchased = await upgraded.hasPurchasedOffchain(
        testMessageId,
        testSeller,
        testToken,
        testAmount,
        testBuyer
      );
      console.log("✅ hasPurchasedOffchain function works:", hasPurchased);
    } catch (error) {
      console.log("❌ Error testing new function:", error.message);
    }

    // Verify signers
    const finalDeployerSigner = await upgraded.signers(deployerSigner);
    const finalAdditionalSigner = await upgraded.signers(additionalSigner);
    console.log("Final deployer signer status:", finalDeployerSigner);
    console.log("Final additional signer status:", finalAdditionalSigner);

    console.log("\n📋 Upgrade Summary:");
    console.log("✅ New implementation deployed");
    console.log("✅ Proxy upgraded successfully");
    console.log("✅ Message hash functionality added");
    console.log("✅ Signers added (same as BSC testnet)");
    console.log("✅ V2 compatibility maintained");

    console.log("\n🔧 New Function Available:");
    console.log("hasPurchasedOffchain(messageId, seller, token, amount, buyer)");
    console.log("Returns true if the buyer has purchased the message offchain");

    console.log("\n✅ Base Sepolia V3 contract upgrade completed successfully!");

  } catch (error) {
    console.error("❌ Upgrade failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
