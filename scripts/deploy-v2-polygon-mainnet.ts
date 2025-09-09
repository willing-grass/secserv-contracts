import { ethers, upgrades, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying MessageMarketplaceV2 to Polygon Mainnet...");
  console.log("Deployer address:", deployer.address);
  console.log("Account balance:", (await deployer.provider?.getBalance(deployer.address)).toString());

  // Configuration for Polygon Mainnet
  const STABLE_TOKEN_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Polygon Mainnet USDC
  const SYSTEM_FEE_ADDRESS = deployer.address; // You can change this to your desired fee address
  const FEE_PERCENTAGE = 1000; // 10% fee (1000 basis points)

  console.log("\nConfiguration:");
  console.log("Stable Token Address:", STABLE_TOKEN_ADDRESS);
  console.log("Token Type: USDC (6 decimals)");
  console.log("System Fee Address:", SYSTEM_FEE_ADDRESS);
  console.log("Fee Percentage:", FEE_PERCENTAGE, "basis points (", FEE_PERCENTAGE / 100, "%)");

  // Deploy the proxy with V2 implementation
  const MessageMarketplaceV2 = await ethers.getContractFactory("MessageMarketplaceV2");
  
  console.log("\nDeploying proxy with V2 implementation...");
  const marketplace = await upgrades.deployProxy(MessageMarketplaceV2, [
    STABLE_TOKEN_ADDRESS,
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
  console.log("\nVerifying contract on PolygonScan...");
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
  const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-polygon-mainnet"));
  const price = ethers.parseUnits("0.1", 6); // 0.1 USDC (6 decimals for Polygon)
  const expireAt = 0; // No expiration

  console.log("Creating test message...");
  console.log("Price in 6 decimals:", price.toString());
  console.log("Price in USDC:", ethers.formatUnits(price, 6));
  const createTx = await marketplace.createMessage(messageId, price, expireAt);
  await createTx.wait();
  console.log("Test message created successfully!");

  // Note: The contract will automatically handle decimal conversion
  console.log("✅ Contract deployed with automatic decimal handling");
  console.log("✅ USDC 6-decimal prices will be automatically converted to 18 decimals internally");

  // Display deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network: Polygon Mainnet");
  console.log("Chain ID: 137");
  console.log("Proxy Address:", marketplaceAddress);
  console.log("Implementation Address:", implementationAddress);
  console.log("Stable Token Address:", STABLE_TOKEN_ADDRESS);
  console.log("Token Type: USDC (6 decimals)");
  console.log("System Fee Address:", SYSTEM_FEE_ADDRESS);
  console.log("Fee Percentage:", FEE_PERCENTAGE, "basis points");
  console.log("Deployer:", deployer.address);
  console.log("\nNew Features Available:");
  console.log("- Universal stable token support (USDC, USDT, DAI, etc.)");
  console.log("- Automatic decimal detection and conversion");
  console.log("- purchaseMessageByFiat function");
  console.log("- FiatPurchase struct and mapping");
  console.log("- hasPurchasedMessageByFiat function");
  console.log("- getFiatPurchaseDetails function");
  console.log("- MessagePurchasedByFiat event");
  console.log("- Combined messageId + web2UserId hash support");
  console.log("- Backend validation hash support");
  console.log("- Enhanced statistics tracking");
  console.log("- Network-independent deployment");
  console.log("=".repeat(60));

  // Save deployment info
  const deploymentInfo = {
    network: "Polygon Mainnet",
    chainId: 137,
    proxyAddress: marketplaceAddress,
    implementationAddress: implementationAddress,
    stableTokenAddress: STABLE_TOKEN_ADDRESS,
    tokenType: "USDC (6 decimals)",
    systemFeeAddress: SYSTEM_FEE_ADDRESS,
    feePercentage: FEE_PERCENTAGE,
    deployer: deployer.address,
    deployerBalance: (await deployer.provider?.getBalance(deployer.address)).toString(),
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment info saved to deployment-info-polygon-mainnet.json");
  const fs = require("fs");
  fs.writeFileSync(
    "deployment-info-polygon-mainnet.json", 
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
