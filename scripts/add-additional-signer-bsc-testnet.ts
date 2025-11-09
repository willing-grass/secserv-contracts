import { ethers } from "hardhat";

async function main() {
  console.log("🔧 Adding additional signer to BSC Testnet V3 contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Load deployment info
  const deploymentInfo = require("../deployment-info-bsc-testnet.json");
  const proxyAddress = deploymentInfo.proxyAddress;
  const chainId = deploymentInfo.chainId;

  console.log("Proxy address:", proxyAddress);
  console.log("Chain ID:", chainId);

  // Connect to the proxy contract
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  const marketplace = MessageMarketplaceV3.attach(proxyAddress);

  // Additional signer to add
  const additionalSigner = "0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2";

  try {
    // Check if the additional signer is already a signer
    const isAlreadySigner = await marketplace.signers(additionalSigner);
    console.log(`Is ${additionalSigner} already a signer?`, isAlreadySigner);

    if (isAlreadySigner) {
      console.log("✅ Additional signer is already added!");
      return;
    }

    // Add the additional signer
    console.log(`Adding additional signer: ${additionalSigner}`);
    const tx = await marketplace.addSigner(additionalSigner);
    console.log("Transaction hash:", tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt?.blockNumber);

    // Verify the signer was added
    const isSigner = await marketplace.signers(additionalSigner);
    console.log(`Is ${additionalSigner} now a signer?`, isSigner);

    if (isSigner) {
      console.log("✅ Additional signer successfully added!");
    } else {
      console.log("❌ Failed to add additional signer");
    }

  } catch (error) {
    console.error("❌ Error adding additional signer:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
