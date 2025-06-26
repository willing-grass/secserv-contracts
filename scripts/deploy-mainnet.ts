import { ethers, upgrades } from "hardhat";
import { run } from "hardhat";

async function main() {
  console.log("Deploying to Base Mainnet...");
  
  // Get the contract factory
  const MessageMarketplace = await ethers.getContractFactory("MessageMarketplace");
  
  // For mainnet, we'll use real USDC instead of deploying a mock
  // Base Mainnet USDC address (Coinbase's wrapped USDC)
  const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  console.log("Using USDC at address:", usdcAddress);

  // Get the deployer's address to use as system fee address
  const [deployer] = await ethers.getSigners();
  const systemFeeAddress = deployer.address;
  
  // The fee percentage (1000 basis points = 10%)
  const feePercentage = 1000;

  // Deploy MessageMarketplace as upgradable proxy
  console.log("Deploying MessageMarketplace as upgradable proxy...");
  const messageMarketplace = await upgrades.deployProxy(MessageMarketplace, [
    usdcAddress,
    systemFeeAddress,
    feePercentage
  ], { initializer: 'initialize' });
  await messageMarketplace.waitForDeployment();
  const messageMarketplaceAddress = await messageMarketplace.getAddress();
  console.log("MessageMarketplace deployed to:", messageMarketplaceAddress);

  // Get the implementation address for verification
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(messageMarketplaceAddress);
  console.log("Implementation address:", implementationAddress);

  // Verify contract on Base Mainnet
  console.log("Waiting for block confirmations...");
  await messageMarketplace.deploymentTransaction()?.wait(5);

  console.log("Verifying contract...");
  try {
    // Verify the implementation contract
    await run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [],
    });
    console.log("MessageMarketplace implementation verified successfully");
  } catch (error) {
    console.log("Error verifying contract:", error);
  }

  console.log("\nDeployment Summary:");
  console.log("USDC Address:", usdcAddress);
  console.log("MessageMarketplace Proxy:", messageMarketplaceAddress);
  console.log("MessageMarketplace Implementation:", implementationAddress);
  console.log("System Fee Address:", systemFeeAddress);
  console.log("Fee Percentage: 10% (1000 basis points)");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 