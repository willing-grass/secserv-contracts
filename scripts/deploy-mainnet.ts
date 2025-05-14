import { ethers } from "hardhat";
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

  // Deploy MessageMarketplace
  console.log("Deploying MessageMarketplace...");
  const messageMarketplace = await MessageMarketplace.deploy(
    usdcAddress,
    systemFeeAddress,
    feePercentage
  );
  await messageMarketplace.waitForDeployment();
  const messageMarketplaceAddress = await messageMarketplace.getAddress();
  console.log("MessageMarketplace deployed to:", messageMarketplaceAddress);

  // Verify contract on Base Mainnet
  console.log("Waiting for block confirmations...");
  await messageMarketplace.deploymentTransaction()?.wait(5);

  console.log("Verifying contract...");
  try {
    await run("verify:verify", {
      address: messageMarketplaceAddress,
      constructorArguments: [usdcAddress, systemFeeAddress, feePercentage],
    });
    console.log("MessageMarketplace verified successfully");
  } catch (error) {
    console.log("Error verifying contract:", error);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 