import { ethers, upgrades, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying MessageMarketplaceV2 to Ethereum Mainnet...");
  console.log("Deployer address:", deployer.address);
  console.log("Account balance:", (await deployer.provider?.getBalance(deployer.address)).toString());

  // Configuration for Ethereum Mainnet
  const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // Ethereum Mainnet USDC
  const SYSTEM_FEE_ADDRESS = deployer.address; // You can change this to your desired fee address
  const FEE_PERCENTAGE = 1000; // 10% fee (1000 basis points)

  console.log("\nConfiguration:");
  console.log("USDC Address:", USDC_ADDRESS);
  console.log("System Fee Address:", SYSTEM_FEE_ADDRESS);
  console.log("Fee Percentage:", FEE_PERCENTAGE, "basis points (", FEE_PERCENTAGE / 100, "%)");

  // Deploy the proxy with V2 implementation
  const MessageMarketplaceV2 = await ethers.getContractFactory("MessageMarketplaceV2");
  
  console.log("\nDeploying proxy with V2 implementation...");
  const marketplace = await upgrades.deployProxy(MessageMarketplaceV2, [
    USDC_ADDRESS,
    SYSTEM_FEE_ADDRESS,
    FEE_PERCENTAGE
  ], {
    initializer: "initialize",
    kind: "uups"
  });

  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  console.log("MessageMarketplaceV2 deployed to:", marketplaceAddress);

  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(marketplaceAddress);
  console.log("Implementation address:", implementationAddress);

  // Wait for a few block confirmations
  console.log("\nWaiting for block confirmations...");
  await marketplace.deploymentTransaction()?.wait(5);

  // Verify the contract
  console.log("\nVerifying contract on Etherscan...");
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
  
  // Test message creation
  const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-ethereum-mainnet"));
  const price = ethers.parseEther("0.1"); // 0.1 USDC
  const expireAt = 0; // No expiration

  console.log("Creating test message...");
  const createTx = await marketplace.createMessage(messageId, price, expireAt);
  await createTx.wait();
  console.log("Test message created successfully!");

  // Display deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network: Ethereum Mainnet");
  console.log("Chain ID: 1");
  console.log("Proxy Address:", marketplaceAddress);
  console.log("Implementation Address:", implementationAddress);
  console.log("USDC Address:", USDC_ADDRESS);
  console.log("System Fee Address:", SYSTEM_FEE_ADDRESS);
  console.log("Fee Percentage:", FEE_PERCENTAGE, "basis points");
  console.log("Deployer:", deployer.address);
  console.log("\nNew Features Available:");
  console.log("- purchaseMessageByFiat function");
  console.log("- FiatPurchase struct and mapping");
  console.log("- hasPurchasedMessageByFiat function");
  console.log("- getFiatPurchaseDetails function");
  console.log("- MessagePurchasedByFiat event");
  console.log("- Combined messageId + web2UserId hash support");
  console.log("- Backend validation hash support");
  console.log("- Batch fiat purchase functionality");
  console.log("- Enhanced statistics tracking");
  console.log("=".repeat(60));

  // Save deployment info
  const deploymentInfo = {
    network: "Ethereum Mainnet",
    chainId: 1,
    proxyAddress: marketplaceAddress,
    implementationAddress: implementationAddress,
    usdcAddress: USDC_ADDRESS,
    systemFeeAddress: SYSTEM_FEE_ADDRESS,
    feePercentage: FEE_PERCENTAGE,
    deployer: deployer.address,
    deployerBalance: (await deployer.provider?.getBalance(deployer.address)).toString(),
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment info saved to deployment-info-ethereum-mainnet.json");
  const fs = require("fs");
  fs.writeFileSync(
    "deployment-info-ethereum-mainnet.json", 
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
