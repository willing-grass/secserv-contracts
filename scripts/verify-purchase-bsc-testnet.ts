import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Verifying purchase transaction on BSC Testnet...");

  // Get accounts
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Load deployment info
  const deploymentInfo = require("../deployment-info-bsc-testnet.json");
  const proxyAddress = deploymentInfo.proxyAddress;

  console.log("Proxy address:", proxyAddress);

  // Connect to contract
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  const marketplace = MessageMarketplaceV3.attach(proxyAddress);

  // Transaction data from your transaction
  const messageId = "0xc14894b9827341c9bb855c7a12833de3d0f2b8dad64864e70774233836b9ec23";
  const seller = "0xb5C4f48D13D0824936250eb143E3073986600fFA";
  const token = "0x4C07B79C3D8954A51Efc342EdA5D08f8b1f9ceC4";
  const amount = BigInt("0x016345785d8a0000"); // 100000000000000000
  const deadline = parseInt("0x68c834c5", 16); // 1757951173

  console.log("\n📝 Transaction Parameters:");
  console.log("Message ID:", messageId);
  console.log("Seller:", seller);
  console.log("Token:", token);
  console.log("Amount:", ethers.formatEther(amount), "USDC");
  console.log("Deadline:", new Date(deadline * 1000).toISOString());

  // Calculate message hash (same as contract)
  const messageHash = ethers.solidityPackedKeccak256(
    ["bytes32", "address", "address", "uint256"],
    [messageId, seller, token, amount]
  );
  console.log("\n🔐 Calculated Message Hash:", messageHash);

  // We need to find the buyer address from the transaction
  // Let's check if the deployer was the buyer
  console.log("\n🔍 Checking purchase status for deployer:");
  const deployerPurchased = await marketplace.hasPurchasedOffchain(
    messageId,
    seller,
    token,
    amount,
    deployer.address
  );
  console.log("Deployer purchased:", deployerPurchased);

  // Check if seller is a signer
  const isSellerSigner = await marketplace.signers(seller);
  console.log("Seller is signer:", isSellerSigner);

  // Check V2 methods as well
  console.log("\n🔍 Checking V2 methods:");
  const v2Purchased = await marketplace.hasPurchasedMessage(messageId, deployer.address);
  console.log("V2 hasPurchasedMessage:", v2Purchased);

  // Let's also check the transaction receipt to get the buyer address
  console.log("\n🔍 Transaction Analysis:");
  console.log("This transaction shows a successful purchaseOffchainMessage call");
  console.log("The purchase should now be recorded in the offchainPurchases mapping");

  // Test with different buyer addresses to see if we can find the actual buyer
  console.log("\n🧪 Testing different buyer addresses:");
  
  const testBuyers = [
    "0xb5C4f48D13D0824936250eb143E3073986600fFA", // seller
    "0x4C07B79C3D8954A51Efc342EdA5D08f8b1f9ceC4", // token
    deployer.address, // deployer
  ];

  for (const buyer of testBuyers) {
    try {
      const purchased = await marketplace.hasPurchasedOffchain(
        messageId,
        seller,
        token,
        amount,
        buyer
      );
      console.log(`Buyer ${buyer}: ${purchased}`);
    } catch (error) {
      console.log(`Buyer ${buyer}: Error - ${error.message}`);
    }
  }

  console.log("\n✅ Purchase verification completed!");
  console.log("If the transaction was successful, the purchase should be recorded in the contract");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
