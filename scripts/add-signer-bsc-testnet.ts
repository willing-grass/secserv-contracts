import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Adding deployer as signer on BSC Testnet...");
  console.log("Deployer address:", deployer.address);

  // Get the proxy address from deployment info
  const fs = require("fs");
  let deploymentInfo;
  
  try {
    deploymentInfo = JSON.parse(fs.readFileSync("deployment-info-bsc-testnet.json", "utf8"));
    console.log(`Found deployment info for ${deploymentInfo.network}`);
  } catch (error) {
    console.error("Error reading deployment info:", error);
    process.exit(1);
  }

  const PROXY_ADDRESS = deploymentInfo.proxyAddress;
  console.log("Proxy address:", PROXY_ADDRESS);

  // Connect to the upgraded contract
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  const marketplace = MessageMarketplaceV3.attach(PROXY_ADDRESS);

  // Check if deployer is already a signer
  console.log("\nChecking current signer status...");
  const isSigner = await marketplace.isSigner(deployer.address);
  console.log("Deployer is currently a signer:", isSigner);

  if (isSigner) {
    console.log("✅ Deployer is already a signer!");
    return;
  }

  // Add deployer as signer
  console.log("\nAdding deployer as signer...");
  try {
    const addSignerTx = await marketplace.addSigner(deployer.address);
    console.log("Transaction hash:", addSignerTx.hash);
    
    await addSignerTx.wait();
    console.log("✅ Deployer added as signer successfully!");
  } catch (error) {
    console.error("❌ Failed to add signer:", error);
    process.exit(1);
  }

  // Verify the signer was added
  console.log("\nVerifying signer status...");
  const isSignerAfter = await marketplace.isSigner(deployer.address);
  console.log("Deployer is now a signer:", isSignerAfter);

  if (isSignerAfter) {
    console.log("✅ Signer verification successful!");
  } else {
    console.log("❌ Signer verification failed!");
  }

  // Test other V3 functionality
  console.log("\nTesting V3 functionality...");
  
  // Test fee configuration
  const [feeAddress, feePercentage] = await marketplace.getFeeConfiguration();
  console.log("Fee address:", feeAddress);
  console.log("Fee percentage:", feePercentage.toString());

  console.log("\n" + "=".repeat(60));
  console.log("SIGNER ADDITION SUMMARY - BSC TESTNET");
  console.log("=".repeat(60));
  console.log("Network: BSC Testnet");
  console.log("Chain ID: 97");
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("Deployer:", deployer.address);
  console.log("Deployer is Signer:", isSignerAfter);
  console.log("Fee Address:", feeAddress);
  console.log("Fee Percentage:", feePercentage.toString());
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
