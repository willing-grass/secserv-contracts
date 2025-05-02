import { ethers } from "hardhat";
import { run } from "hardhat";

async function main() {
  // Get the contract factory
  const MessageMarketplace = await ethers.getContractFactory("MessageMarketplace");
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  // Deploy Mock USDC first
  console.log("Deploying Mock USDC...");
  const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("Mock USDC deployed to:", mockUSDCAddress);

  // Get the deployer's address to use as system fee address
  const [deployer] = await ethers.getSigners();
  const systemFeeAddress = deployer.address;

  // Deploy MessageMarketplace
  console.log("Deploying MessageMarketplace...");
  const messageMarketplace = await MessageMarketplace.deploy(
    mockUSDCAddress,
    systemFeeAddress,
    1000 // 10% fee (1000 basis points)
  );
  await messageMarketplace.waitForDeployment();
  const messageMarketplaceAddress = await messageMarketplace.getAddress();
  console.log("MessageMarketplace deployed to:", messageMarketplaceAddress);

  // Verify contracts on Base Sepolia
  console.log("Waiting for block confirmations...");
  await messageMarketplace.deploymentTransaction()?.wait(5);
  await mockUSDC.deploymentTransaction()?.wait(5);

  console.log("Verifying contracts...");
  try {
    await run("verify:verify", {
      address: mockUSDCAddress,
      constructorArguments: ["USD Coin", "USDC", 6],
    });
    console.log("Mock USDC verified successfully");

    await run("verify:verify", {
      address: messageMarketplaceAddress,
      constructorArguments: [mockUSDCAddress, systemFeeAddress, 1000],
    });
    console.log("MessageMarketplace verified successfully");
  } catch (error) {
    console.log("Error verifying contracts:", error);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 