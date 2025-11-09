import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Checking hasPurchasedOffchain for specific parameters...");

  // Load deployment info
  const deploymentInfo = require("../deployment-info-bsc-testnet.json");
  const proxyAddress = deploymentInfo.proxyAddress;

  console.log("Proxy address:", proxyAddress);

  // Connect to contract
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  const marketplace = MessageMarketplaceV3.attach(proxyAddress);

  // Your specific parameters
  const messageId = "0x83543f5cbffb840e45fc0463391b04e2c5e4969b7c4710fa87a9063caa538301";
  const seller = "0xb5C4f48D13D0824936250eb143E3073986600fFA";
  const token = "0x4C07B79C3D8954A51Efc342EdA5D08f8b1f9ceC4";
  const amount = BigInt("100000000000000000"); // 0.1 USDC
  const buyer = "0xB0057C641C089688b0A9Cb9c045bA88F084C036E";

  console.log("\n📝 Specific Parameters:");
  console.log("Message ID:", messageId);
  console.log("Seller:", seller);
  console.log("Token:", token);
  console.log("Amount:", ethers.formatEther(amount), "USDC");
  console.log("Buyer:", buyer);

  // Check hasPurchasedOffchain
  console.log("\n🔍 Checking hasPurchasedOffchain:");
  try {
    const hasPurchased = await marketplace.hasPurchasedOffchain(
      messageId,
      seller,
      token,
      amount,
      buyer
    );
    console.log("✅ hasPurchasedOffchain result:", hasPurchased);
    
    if (hasPurchased) {
      console.log("🎉 SUCCESS! The buyer has purchased this message offchain!");
    } else {
      console.log("❌ The buyer has NOT purchased this message offchain");
    }
  } catch (error) {
    console.log("❌ Error calling hasPurchasedOffchain:", error.message);
  }

  // Calculate the message hash
  const messageHash = ethers.solidityPackedKeccak256(
    ["bytes32", "address", "address", "uint256"],
    [messageId, seller, token, amount]
  );
  console.log("\n🔐 Message Hash:", messageHash);

  // Check the offchainPurchases mapping directly
  console.log("\n🔍 Direct mapping check:");
  try {
    const directCheck = await marketplace.offchainPurchases(messageHash, buyer);
    console.log("Direct offchainPurchases mapping:", directCheck);
  } catch (error) {
    console.log("Direct mapping error:", error.message);
  }

  // Also check V2 methods for comparison
  console.log("\n🔍 Checking V2 methods for comparison:");
  try {
    const v2Purchased = await marketplace.hasPurchasedMessage(messageId, buyer);
    console.log("V2 hasPurchasedMessage:", v2Purchased);
  } catch (error) {
    console.log("V2 method error:", error.message);
  }

  // Test with different parameters to make sure it's working correctly
  console.log("\n🧪 Testing with different parameters:");
  
  // Test 1: Different buyer
  const differentBuyer = "0x1234567890123456789012345678901234567890";
  try {
    const differentBuyerResult = await marketplace.hasPurchasedOffchain(
      messageId,
      seller,
      token,
      amount,
      differentBuyer
    );
    console.log("Different buyer result:", differentBuyerResult);
  } catch (error) {
    console.log("Different buyer error:", error.message);
  }

  // Test 2: Different amount
  const differentAmount = ethers.parseEther("0.2"); // 0.2 USDC instead of 0.1
  try {
    const differentAmountResult = await marketplace.hasPurchasedOffchain(
      messageId,
      seller,
      token,
      differentAmount,
      buyer
    );
    console.log("Different amount result:", differentAmountResult);
  } catch (error) {
    console.log("Different amount error:", error.message);
  }

  // Test 3: Different message ID
  const differentMessageId = ethers.keccak256(ethers.toUtf8Bytes("different-message"));
  try {
    const differentMessageResult = await marketplace.hasPurchasedOffchain(
      differentMessageId,
      seller,
      token,
      amount,
      buyer
    );
    console.log("Different message ID result:", differentMessageResult);
  } catch (error) {
    console.log("Different message ID error:", error.message);
  }

  console.log("\n✅ Specific parameters check completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
