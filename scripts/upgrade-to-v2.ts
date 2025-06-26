import { ethers, upgrades } from "hardhat";
import { run } from "hardhat";

async function main() {
  console.log("Upgrading MessageMarketplace to V2...");
  
  // Get the contract factory for V2
  const MessageMarketplaceV2 = await ethers.getContractFactory("MessageMarketplaceV2");
  
  // You need to provide the proxy address that was deployed
  // Replace this with your actual deployed proxy address
  const proxyAddress = process.env.PROXY_ADDRESS;
  
  if (!proxyAddress) {
    throw new Error("Please set PROXY_ADDRESS environment variable with your deployed proxy address");
  }
  
  console.log("Proxy address:", proxyAddress);
  
  // Get the current implementation address before upgrade
  const currentImplementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Current implementation address:", currentImplementation);
  
  // Upgrade the proxy to V2
  console.log("Upgrading proxy to V2...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, MessageMarketplaceV2);
  await upgraded.waitForDeployment();
  
  const upgradedAddress = await upgraded.getAddress();
  console.log("Upgrade completed! Proxy address:", upgradedAddress);
  
  // Get the new implementation address
  const newImplementation = await upgrades.erc1967.getImplementationAddress(upgradedAddress);
  console.log("New implementation address:", newImplementation);
  
  // Verify the new implementation contract
  console.log("Waiting for block confirmations...");
  await upgraded.deploymentTransaction()?.wait(5);
  
  console.log("Verifying new implementation...");
  try {
    await run("verify:verify", {
      address: newImplementation,
      constructorArguments: [],
    });
    console.log("MessageMarketplaceV2 implementation verified successfully");
  } catch (error) {
    console.log("Error verifying contract:", error);
  }
  
  // Test the new V2 functionality
  console.log("\nTesting V2 functionality...");
  
  // Get the total sales (should be 0 initially)
  const totalSales = await upgraded.totalSales();
  console.log("Total sales:", totalSales.toString());
  
  // Get the total volume (should be 0 initially)
  const totalVolume = await upgraded.totalVolume();
  console.log("Total volume:", totalVolume.toString());
  
  // Test the new getMarketplaceStats function
  const stats = await upgraded.getMarketplaceStats();
  console.log("Marketplace stats - Sales:", stats[0].toString(), "Volume:", stats[1].toString());
  
  console.log("\n🎉 Upgrade to V2 completed successfully!");
  console.log("\nSummary:");
  console.log("Proxy Address:", upgradedAddress);
  console.log("New Implementation:", newImplementation);
  console.log("Previous Implementation:", currentImplementation);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 