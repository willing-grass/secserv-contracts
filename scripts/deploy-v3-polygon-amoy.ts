import { ethers, upgrades, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying MessageMarketplaceV3 to Polygon Amoy...");
  console.log("Deployer address:", deployer.address);
  console.log("Account balance:", (await deployer.provider?.getBalance(deployer.address)).toString());

  // Configuration for Polygon Amoy
  const SYSTEM_FEE_ADDRESS = deployer.address; // You can change this to your desired fee address
  const FEE_PERCENTAGE = 1000; // 10% fee (1000 basis points)

  console.log("\nConfiguration:");
  console.log("System Fee Address:", SYSTEM_FEE_ADDRESS);
  console.log("Fee Percentage:", FEE_PERCENTAGE, "basis points (", FEE_PERCENTAGE / 100, "%)");

  // Deploy the proxy with V3 implementation
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  
  console.log("\nDeploying proxy with V3 implementation...");
  const marketplace = await upgrades.deployProxy(MessageMarketplaceV3, [
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

  // Add deployer as initial signer
  console.log("\nAdding deployer as initial signer...");
  const addSignerTx = await marketplace.addSigner(deployer.address);
  await addSignerTx.wait();
  console.log("Deployer added as signer successfully!");

  // Wait for a few block confirmations
  console.log("\nWaiting for block confirmations...");
  await marketplace.deploymentTransaction()?.wait(5);

  // Verify the contract
  console.log("\nVerifying contract on Polygonscan...");
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
  
  // Test signer verification
  const isSigner = await marketplace.isSigner(deployer.address);
  console.log("Deployer is signer:", isSigner);

  // Test fee configuration
  const [feeAddress, feePercentage] = await marketplace.getFeeConfiguration();
  console.log("Fee address:", feeAddress);
  console.log("Fee percentage:", feePercentage.toString());

  // Display deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network: Polygon Amoy");
  console.log("Chain ID: 80002");
  console.log("Proxy Address:", marketplaceAddress);
  console.log("Implementation Address:", implementationAddress);
  console.log("System Fee Address:", SYSTEM_FEE_ADDRESS);
  console.log("Fee Percentage:", FEE_PERCENTAGE, "basis points");
  console.log("Deployer:", deployer.address);
  console.log("Initial Signer:", deployer.address);
  console.log("\nNew V3 Features Available:");
  console.log("- Off-chain message purchase flow");
  console.log("- EIP-191 signature verification");
  console.log("- Signer allowlist management");
  console.log("- ERC-20 token purchases only");
  console.log("- Cross-chain signature support");
  console.log("- Disabled old on-chain flow");
  console.log("- Emergency withdrawal functions");
  console.log("=".repeat(60));

  // Save deployment info
  const deploymentInfo = {
    network: "Polygon Amoy",
    chainId: 80002,
    proxyAddress: marketplaceAddress,
    implementationAddress: implementationAddress,
    systemFeeAddress: SYSTEM_FEE_ADDRESS,
    feePercentage: FEE_PERCENTAGE,
    deployer: deployer.address,
    initialSigner: deployer.address,
    deployerBalance: (await deployer.provider?.getBalance(deployer.address)).toString(),
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment info saved to deployment-info-v3-polygon-amoy.json");
  const fs = require("fs");
  fs.writeFileSync(
    "deployment-info-v3-polygon-amoy.json", 
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
