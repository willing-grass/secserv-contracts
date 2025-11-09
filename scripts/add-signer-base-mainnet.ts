import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Adding signer to Base Mainnet...");
  console.log("Deployer address:", deployer.address);
  console.log("Account balance:", (await deployer.provider?.getBalance(deployer.address)).toString());

  // Base Mainnet proxy address
  const PROXY_ADDRESS = "0x3Dfb0f9e802528Dfff91bb6F893FC4FfB0362DBd";
  const NEW_SIGNER_ADDRESS = "0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2";

  console.log("\nConfiguration:");
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("New Signer Address:", NEW_SIGNER_ADDRESS);

  // Get the contract instance
  const marketplace = await ethers.getContractAt("MessageMarketplaceV3", PROXY_ADDRESS);
  
  // Check if signer already exists
  const isAlreadySigner = await marketplace.isSigner(NEW_SIGNER_ADDRESS);
  console.log("Is already a signer:", isAlreadySigner);
  
  if (isAlreadySigner) {
    console.log("✅ Signer is already added!");
    return;
  }

  // Add the signer
  console.log("\nAdding new signer...");
  try {
    const addSignerTx = await marketplace.addSigner(NEW_SIGNER_ADDRESS);
    console.log("Transaction hash:", addSignerTx.hash);
    
    const receipt = await addSignerTx.wait();
    console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);
    
    // Verify the signer was added
    const isNowSigner = await marketplace.isSigner(NEW_SIGNER_ADDRESS);
    console.log("Is now a signer:", isNowSigner);
    
    if (isNowSigner) {
      console.log("✅ Signer added successfully!");
    } else {
      console.log("❌ Signer addition failed!");
    }
    
  } catch (error) {
    console.error("❌ Error adding signer:", error);
  }

  // Display summary
  console.log("\n" + "=".repeat(60));
  console.log("SIGNER ADDITION SUMMARY");
  console.log("=".repeat(60));
  console.log("Network: Base Mainnet");
  console.log("Chain ID: 8453");
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("New Signer Address:", NEW_SIGNER_ADDRESS);
  console.log("Deployer:", deployer.address);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
