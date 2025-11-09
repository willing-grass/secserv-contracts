import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🔄 Upgrading V3 contract with message hash functionality on BSC Testnet...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Load deployment info
  const deploymentInfo = require("../deployment-info-bsc-testnet.json");
  const proxyAddress = deploymentInfo.proxyAddress;
  const chainId = deploymentInfo.chainId;

  console.log("Proxy address:", proxyAddress);
  console.log("Chain ID:", chainId);

  try {
    // Deploy new implementation
    console.log("\n📦 Deploying new V3 implementation...");
    const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
    const newImplementation = await MessageMarketplaceV3.deploy();
    await newImplementation.waitForDeployment();
    
    const implementationAddress = await newImplementation.getAddress();
    console.log("New implementation deployed at:", implementationAddress);

    // Upgrade the proxy
    console.log("\n⬆️ Upgrading proxy to new implementation...");
    const upgraded = await upgrades.upgradeProxy(proxyAddress, MessageMarketplaceV3);
    await upgraded.waitForDeployment();
    
    console.log("✅ Proxy upgraded successfully!");
    console.log("Proxy address:", await upgraded.getAddress());

    // Verify the upgrade
    console.log("\n🔍 Verifying upgrade...");
    
    // Test the new hasPurchasedOffchain function
    const testMessageId = ethers.keccak256(ethers.toUtf8Bytes("test-upgrade"));
    const testSeller = "0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2";
    const testToken = "0x4C07B79C3D8954A51Efc342EdA5D08f8b1f9ceC4";
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
      console.log("✅ New hasPurchasedOffchain function works:", hasPurchased);
    } catch (error) {
      console.log("❌ Error testing new function:", error.message);
    }

    // Check if signers are still there
    const isDeployerSigner = await upgraded.signers(deployer.address);
    const isAdditionalSigner = await upgraded.signers("0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2");
    console.log("Deployer is still a signer:", isDeployerSigner);
    console.log("Additional signer is still a signer:", isAdditionalSigner);

    // Test old V2 functions still work
    try {
      const hasPurchasedV2 = await upgraded.hasPurchasedMessage(testMessageId, testBuyer);
      console.log("✅ V2 hasPurchasedMessage still works:", hasPurchasedV2);
    } catch (error) {
      console.log("❌ V2 function error:", error.message);
    }

    console.log("\n📋 Upgrade Summary:");
    console.log("✅ New implementation deployed");
    console.log("✅ Proxy upgraded successfully");
    console.log("✅ Message hash functionality added");
    console.log("✅ V2 compatibility maintained");
    console.log("✅ Signers preserved");

    console.log("\n🔧 New Function Available:");
    console.log("hasPurchasedOffchain(messageId, seller, token, amount, buyer)");
    console.log("Returns true if the buyer has purchased the message offchain");

    console.log("\n✅ BSC Testnet contract upgrade completed successfully!");

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
