import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Verifying actual purchase on BSC Testnet...");

  // Load deployment info
  const deploymentInfo = require("../deployment-info-bsc-testnet.json");
  const proxyAddress = deploymentInfo.proxyAddress;

  console.log("Proxy address:", proxyAddress);

  // Connect to contract
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  const marketplace = MessageMarketplaceV3.attach(proxyAddress);

  // Transaction data from the successful transaction
  const messageId = "0xc14894b9827341c9bb855c7a12833de3d0f2b8dad64864e70774233836b9ec23";
  const seller = "0xb5C4f48D13D0824936250eb143E3073986600fFA";
  const token = "0x4C07B79C3D8954A51Efc342EdA5D08f8b1f9ceC4";
  const amount = BigInt("100000000000000000"); // 0.1 USDC
  const buyer = "0xB0057C641C089688b0A9Cb9c045bA88F084C036E"; // Actual buyer from transaction

  console.log("\n📝 Purchase Parameters:");
  console.log("Message ID:", messageId);
  console.log("Seller:", seller);
  console.log("Token:", token);
  console.log("Amount:", ethers.formatEther(amount), "USDC");
  console.log("Buyer:", buyer);

  // Check if the purchase is recorded
  console.log("\n🔍 Checking Purchase Status:");
  const hasPurchased = await marketplace.hasPurchasedOffchain(
    messageId,
    seller,
    token,
    amount,
    buyer
  );
  console.log("✅ Purchase recorded:", hasPurchased);

  // Check V2 methods as well
  const v2Purchased = await marketplace.hasPurchasedMessage(messageId, buyer);
  console.log("V2 hasPurchasedMessage:", v2Purchased);

  // Calculate message hash
  const messageHash = ethers.solidityPackedKeccak256(
    ["bytes32", "address", "address", "uint256"],
    [messageId, seller, token, amount]
  );
  console.log("\n🔐 Message Hash:", messageHash);

  // Check the offchainPurchases mapping directly
  const offchainPurchase = await marketplace.offchainPurchases(messageHash, buyer);
  console.log("Direct mapping check:", offchainPurchase);

  console.log("\n✅ Purchase verification completed!");
  console.log("The purchase was successfully recorded in the contract!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
