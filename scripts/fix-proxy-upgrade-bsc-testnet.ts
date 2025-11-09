import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🔧 Fixing proxy upgrade on BSC Testnet...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Load deployment info
  const deploymentInfo = require("../deployment-info-bsc-testnet.json");
  const proxyAddress = deploymentInfo.proxyAddress;

  console.log("Proxy address:", proxyAddress);

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

    // Test the new functionality
    console.log("\n🧪 Testing new functionality...");
    
    // Test hasPurchasedOffchain function
    const testMessageId = ethers.keccak256(ethers.toUtf8Bytes("test-upgrade"));
    const testSeller = "0xb5C4f48D13D0824936250eb143E3073986600fFA";
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
      console.log("✅ hasPurchasedOffchain function works:", hasPurchased);
    } catch (error) {
      console.log("❌ Error testing new function:", error.message);
    }

    // Check signers
    const isDeployerSigner = await upgraded.signers(deployer.address);
    const isAdditionalSigner = await upgraded.signers("0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2");
    console.log("Deployer is signer:", isDeployerSigner);
    console.log("Additional signer is signer:", isAdditionalSigner);

    console.log("\n✅ Proxy upgrade fix completed successfully!");

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
