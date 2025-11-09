import { ethers, upgrades, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying MessageMarketplaceV3 to BSC Mainnet...");
  console.log("Deployer address:", deployer.address);
  console.log("Account balance:", (await deployer.provider?.getBalance(deployer.address)).toString());

  // Configuration for BSC Mainnet
  const USDC_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"; // BSC Mainnet USDT
  const SYSTEM_FEE_ADDRESS = deployer.address; // You can change this to your desired fee address
  const FEE_PERCENTAGE = 1000; // 10% fee (1000 basis points)

  console.log("\nConfiguration:");
  console.log("USDT Address:", USDC_ADDRESS);
  console.log("System Fee Address:", SYSTEM_FEE_ADDRESS);
  console.log("Fee Percentage:", FEE_PERCENTAGE, "basis points (", FEE_PERCENTAGE / 100, "%)");

  // Deploy the proxy with V3 implementation
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  
  console.log("\nDeploying proxy with V3 implementation...");
  const marketplace = await upgrades.deployProxy(MessageMarketplaceV3, [
    USDC_ADDRESS,
    SYSTEM_FEE_ADDRESS,
    FEE_PERCENTAGE
  ], {
    initializer: "initialize",
    kind: "uups"
  });

  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  console.log("MessageMarketplaceV3 deployed to:", marketplaceAddress);

  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(marketplaceAddress);
  console.log("Implementation address:", implementationAddress);

  // Wait for a few block confirmations
  console.log("\nWaiting for block confirmations...");
  await marketplace.deploymentTransaction()?.wait(5);

  // Verify the contract
  console.log("\nVerifying contract on BSCScan...");
  try {
    await run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [],
    });
    console.log("Contract verified successfully!");
  } catch (error) {
    console.log("Verification failed, but contract is deployed:", error);
  }

  // Test basic functionality
  console.log("\nTesting basic functionality...");
  
  // Test signer management
  console.log("Testing signer management...");
  const testSigner = "0x1234567890123456789012345678901234567890"; // Test address
  const addSignerTx = await marketplace.addSigner(testSigner);
  await addSignerTx.wait();
  console.log("Test signer added successfully!");

  // Remove test signer
  const removeSignerTx = await marketplace.removeSigner(testSigner);
  await removeSignerTx.wait();
  console.log("Test signer removed successfully!");

  // Display deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network: BSC Mainnet");
  console.log("Chain ID: 56");
  console.log("Proxy Address:", marketplaceAddress);
  console.log("Implementation Address:", implementationAddress);
  console.log("USDT Address:", USDC_ADDRESS);
  console.log("System Fee Address:", SYSTEM_FEE_ADDRESS);
  console.log("Fee Percentage:", FEE_PERCENTAGE, "basis points");
  console.log("Deployer:", deployer.address);
  console.log("\nV3 Features Available:");
  console.log("- Off-chain message purchasing with signature verification");
  console.log("- Signer management (add/remove authorized signers)");
  console.log("- purchaseOffchainMessage function");
  console.log("- purchaseMessageByFiat function (V3 implementation)");
  console.log("- Enhanced fiat purchase tracking");
  console.log("- Emergency token withdrawal");
  console.log("- V2 compatibility maintained");
  console.log("- Disabled old V2 functions (createMessage, purchaseMessage)");
  console.log("=".repeat(60));

  // Save deployment info
  const deploymentInfo = {
    network: "BSC Mainnet",
    chainId: 56,
    proxyAddress: marketplaceAddress,
    implementationAddress: implementationAddress,
    usdcAddress: USDC_ADDRESS,
    systemFeeAddress: SYSTEM_FEE_ADDRESS,
    feePercentage: FEE_PERCENTAGE,
    deployer: deployer.address,
    deployerBalance: (await deployer.provider?.getBalance(deployer.address)).toString(),
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment info saved to deployment-info-bsc-mainnet.json");
  const fs = require("fs");
  fs.writeFileSync(
    "deployment-info-bsc-mainnet.json", 
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
