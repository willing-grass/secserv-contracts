import { ethers, upgrades } from "hardhat";
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

  // Deploy MessageMarketplace as upgradable proxy
  console.log("Deploying MessageMarketplace as upgradable proxy...");
  const messageMarketplace = await upgrades.deployProxy(MessageMarketplace, [
    mockUSDCAddress,
    systemFeeAddress,
    1000 // 10% fee (1000 basis points)
  ], { initializer: 'initialize' });
  await messageMarketplace.waitForDeployment();
  const messageMarketplaceAddress = await messageMarketplace.getAddress();
  console.log("MessageMarketplace deployed to:", messageMarketplaceAddress);

  // Get the implementation address for verification
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(messageMarketplaceAddress);
  console.log("Implementation address:", implementationAddress);

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

    // Verify the implementation contract
    await run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [],
    });
    console.log("MessageMarketplace implementation verified successfully");
  } catch (error) {
    console.log("Error verifying contracts:", error);
  }

  console.log("\nDeployment Summary:");
  console.log("Mock USDC:", mockUSDCAddress);
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