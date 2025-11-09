import { ethers, upgrades, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Upgrading MessageMarketplace to V3 on Base Mainnet...");
  console.log("Deployer address:", deployer.address);
  console.log("Account balance:", (await deployer.provider?.getBalance(deployer.address)).toString());

  // Existing proxy address from your config
  const PROXY_ADDRESS = "0x3Dfb0f9e802528Dfff91bb6F893FC4FfB0362DBd";

  console.log("\nConfiguration:");
  console.log("Proxy Address:", PROXY_ADDRESS);

  // Get the current implementation
  const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current Implementation:", currentImpl);

  // Deploy new V3 implementation
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  
  console.log("\nDeploying new V3 implementation...");
  const newImpl = await MessageMarketplaceV3.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New V3 Implementation:", newImplAddress);

  // Upgrade the proxy
  console.log("\nUpgrading proxy to V3...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, MessageMarketplaceV3);
  await upgraded.waitForDeployment();

  // Verify the new implementation
  console.log("\nVerifying new implementation on BaseScan...");
  try {
    await run("verify:verify", {
      address: newImplAddress,
      constructorArguments: [],
    });
    console.log("New implementation verified successfully!");
  } catch (error) {
    console.log("Verification failed:", error);
  }

  // Test V3 functionality
  console.log("\nTesting V3 functionality...");
  const marketplace = await ethers.getContractAt("MessageMarketplaceV3", PROXY_ADDRESS);
  
  // Test signer management
  const testSigner = "0x1234567890123456789012345678901234567890";
  const addSignerTx = await marketplace.addSigner(testSigner);
  await addSignerTx.wait();
  console.log("✅ Signer added successfully!");

  const removeSignerTx = await marketplace.removeSigner(testSigner);
  await removeSignerTx.wait();
  console.log("✅ Signer removed successfully!");

  // Display upgrade summary
  console.log("\n" + "=".repeat(60));
  console.log("UPGRADE SUMMARY");
  console.log("=".repeat(60));
  console.log("Network: Base Mainnet");
  console.log("Chain ID: 8453");
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("Previous Implementation:", currentImpl);
  console.log("New V3 Implementation:", newImplAddress);
  console.log("Deployer:", deployer.address);
  console.log("\nV3 Features Now Available:");
  console.log("- Off-chain message purchasing with signature verification");
  console.log("- Signer management (add/remove authorized signers)");
  console.log("- purchaseOffchainMessage function");
  console.log("- Enhanced purchaseMessageByFiat function");
  console.log("- Emergency token withdrawal");
  console.log("- V2 compatibility maintained");
  console.log("- Old V2 functions disabled");
  console.log("=".repeat(60));

  // Update deployment info
  const deploymentInfo = {
    network: "Base Mainnet",
    chainId: 8453,
    proxyAddress: PROXY_ADDRESS,
    implementationAddress: newImplAddress,
    previousImplementation: currentImpl,
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    systemFeeAddress: await marketplace.systemFeeAddress(),
    feePercentage: (await marketplace.feePercentage()).toString(),
    deployer: deployer.address,
    deployerBalance: (await deployer.provider?.getBalance(deployer.address)).toString(),
    timestamp: new Date().toISOString(),
    upgrade: true
  };

  console.log("\nDeployment info updated in deployment-info-base-mainnet.json");
  const fs = require("fs");
  fs.writeFileSync(
    "deployment-info-base-mainnet.json", 
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
