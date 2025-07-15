import { ethers, upgrades } from "hardhat";
import { run } from "hardhat";

async function main() {
  // Get the current network
  const network = await ethers.provider.getNetwork();
  console.log(`Upgrading on network: ${network.name} (Chain ID: ${network.chainId})`);

  // Get the contract factory for the new implementation
  const MessageMarketplaceV2 = await ethers.getContractFactory("MessageMarketplaceV2");

  // Get the proxy address - you'll need to replace this with your actual proxy address
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error("Please set PROXY_ADDRESS environment variable");
  }

  console.log("Upgrading MessageMarketplace proxy at:", proxyAddress);

  // Upgrade the proxy to the new implementation
  const upgraded = await upgrades.upgradeProxy(proxyAddress, MessageMarketplaceV2);
  await upgraded.waitForDeployment();

  console.log("MessageMarketplace upgraded successfully!");

  // Get the new implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("New implementation address:", implementationAddress);

  // Verify the new implementation contract
  console.log("Waiting for block confirmations...");
  await upgraded.deploymentTransaction()?.wait(5);

  console.log("Verifying new implementation...");
  try {
    await run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [],
    });
    console.log("New MessageMarketplaceV2 implementation verified successfully");
  } catch (error) {
    console.log("Error verifying new implementation:", error);
  }

  console.log("\nUpgrade Summary:");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
  console.log("Proxy Address:", proxyAddress);
  console.log("New Implementation Address:", implementationAddress);
  console.log("New Features Added:");
  console.log("- purchaseMessageByFiat function");
  console.log("- FiatPurchase struct and mapping");
  console.log("- hasPurchasedMessageByFiat function");
  console.log("- getFiatPurchaseDetails function");
  console.log("- MessagePurchasedByFiat event");
  console.log("- Combined messageId + web2UserId hash support");
  console.log("- Backend validation hash support");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 