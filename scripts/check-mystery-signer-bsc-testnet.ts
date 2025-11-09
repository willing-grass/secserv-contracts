import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Checking mystery signer on BSC Testnet...");

  // Load deployment info
  const deploymentInfo = require("../deployment-info-bsc-testnet.json");
  const proxyAddress = deploymentInfo.proxyAddress;

  console.log("Proxy address:", proxyAddress);

  // Connect to contract
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  const marketplace = MessageMarketplaceV3.attach(proxyAddress);

  const mysterySigner = "0x384746098586D499e8932c51B37238A2D3871dBb";

  console.log("\n🔍 Checking Mystery Signer:");
  console.log("Address:", mysterySigner);

  // Check if this address is a signer
  const isSigner = await marketplace.signers(mysterySigner);
  console.log("Is authorized signer:", isSigner);

  // Check all current signers
  console.log("\n📋 Current Authorized Signers:");
  const deployerSigner = "0xeEf4566F8eBC599F84854e14456cBE7BA9EB1471";
  const additionalSigner = "0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2";
  
  const isDeployerSigner = await marketplace.signers(deployerSigner);
  const isAdditionalSigner = await marketplace.signers(additionalSigner);
  
  console.log(`Deployer (${deployerSigner}):`, isDeployerSigner);
  console.log(`Additional (${additionalSigner}):`, isAdditionalSigner);
  console.log(`Mystery (${mysterySigner}):`, isSigner);

  // Let's also check if this address was added during the upgrade process
  console.log("\n🔍 Possible Explanations:");
  
  if (isSigner) {
    console.log("✅ This address IS an authorized signer!");
    console.log("The transaction succeeded because the signature was valid.");
  } else {
    console.log("❌ This address is NOT an authorized signer!");
    console.log("This suggests there might be a bug in the signature validation.");
    
    // Let's check the contract code to see if there's an issue
    console.log("\n🔍 Debugging Signature Validation:");
    
    // Recreate the signature validation process
    const messageId = "0xc14894b9827341c9bb855c7a12833de3d0f2b8dad64864e70774233836b9ec23";
    const seller = "0xb5C4f48D13D0824936250eb143E3073986600fFA";
    const token = "0x4C07B79C3D8954A51Efc342EdA5D08f8b1f9ceC4";
    const amount = BigInt("100000000000000000");
    const deadline = 1757951173;
    const signature = "0x0e7112bd861f1172e79db055bf9112e75396d7d758ebcededa1ee08b59c0afec3f8d56245c602ca5c7b6bd878b992c8c081f13988b07b4905e8b89b6ad4cf2291b";
    
    // Step 1: Calculate data hash (same as contract)
    const dataHash = ethers.solidityPackedKeccak256(
      ["bytes32", "address", "address", "uint256", "uint256"],
      [messageId, seller, token, amount, deadline]
    );
    console.log("Data hash:", dataHash);
    
    // Step 2: Calculate EIP-191 hash (same as contract)
    const ethHash = ethers.solidityPackedKeccak256(
      ["string", "bytes32"],
      ["\x19Ethereum Signed Message:\n32", dataHash]
    );
    console.log("EIP-191 hash:", ethHash);
    
    // Step 3: Recover address
    const recoveredAddress = ethers.recoverAddress(ethHash, signature);
    console.log("Recovered address:", recoveredAddress);
    console.log("Matches mystery signer:", recoveredAddress.toLowerCase() === mysterySigner.toLowerCase());
    
    // Step 4: Check if recovered address is a signer
    const isRecoveredSigner = await marketplace.signers(recoveredAddress);
    console.log("Is recovered address a signer:", isRecoveredSigner);
    
    if (!isRecoveredSigner) {
      console.log("\n🚨 POTENTIAL BUG FOUND!");
      console.log("The signature validation should have failed but didn't.");
      console.log("This suggests there might be an issue with the contract logic.");
    }
  }

  console.log("\n✅ Mystery signer investigation completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
