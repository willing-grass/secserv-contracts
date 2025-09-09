import { ethers, upgrades } from "hardhat";
import { run } from "hardhat";

async function main() {
  // Get the current network
  const network = await ethers.provider.getNetwork();
  console.log(`Upgrading on network: ${network.name} (Chain ID: ${network.chainId})`);

  // Your deployed proxy address
  const proxyAddress = "0x0DD6017dE44f82a54553941A85A66C87b085E0d1";
  console.log("Upgrading MessageMarketplace proxy at:", proxyAddress);

  // Get the contract factory for the new implementation
  const MessageMarketplaceV2 = await ethers.getContractFactory("MessageMarketplaceV2");

  // Upgrade the proxy to the new implementation
  const upgraded = await upgrades.upgradeProxy(proxyAddress, MessageMarketplaceV2);
  await upgraded.waitForDeployment();

  console.log("MessageMarketplace upgraded successfully!");

  // Get the new implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("New implementation address:", implementationAddress);

  // Update USDC address to the new address
  const newUsdcAddress = "0x3bE123Ff0ec7c0717D6C05C8957EA7880e2FfDcb";
  console.log("Updating USDC address to:", newUsdcAddress);
  
  const tx = await upgraded.updateUSDCAddress(newUsdcAddress);
  await tx.wait();
  console.log("USDC address updated successfully!");

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
  console.log("New USDC Address:", newUsdcAddress);
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