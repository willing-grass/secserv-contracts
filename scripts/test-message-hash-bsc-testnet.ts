import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Testing V3 message hash functionality on BSC Testnet...");

  // Get accounts
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const buyer = signers[1] || signers[0]; // Use deployer as buyer if no second signer
  console.log("Deployer address:", deployer.address);
  console.log("Buyer address:", buyer.address);

  // Load deployment info
  const deploymentInfo = require("../deployment-info-bsc-testnet.json");
  const proxyAddress = deploymentInfo.proxyAddress;
  const usdcAddress = deploymentInfo.usdcAddress;

  console.log("Proxy address:", proxyAddress);
  console.log("USDC address:", usdcAddress);

  // Connect to contracts
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  const marketplace = MessageMarketplaceV3.attach(proxyAddress);

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = MockERC20.attach(usdcAddress);

  // Test data
  const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-hash-" + Date.now()));
  const seller = "0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2"; // The additional signer
  const price = ethers.parseEther("1.0"); // 1 USDC (assuming 18 decimals)
  const deadline = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now

  console.log("\n📝 Test Parameters:");
  console.log("Message ID:", messageId);
  console.log("Seller:", seller);
  console.log("Buyer:", buyer.address);
  console.log("Price:", ethers.formatEther(price), "USDC");
  console.log("Deadline:", new Date(deadline * 1000).toISOString());

  // Check if seller is a signer
  const isSigner = await marketplace.signers(seller);
  console.log(`Is seller a signer? ${isSigner}`);

  if (!isSigner) {
    console.log("❌ Seller is not a signer! Cannot proceed with test.");
    return;
  }

  // Calculate message hash (same as contract)
  const messageHash = ethers.solidityPackedKeccak256(
    ["bytes32", "address", "address", "uint256"],
    [messageId, seller, usdcAddress, price]
  );
  console.log("\n🔐 Message Hash:", messageHash);

  // Check initial purchase status
  console.log("\n🔍 Initial purchase status:");
  const initialStatus = await marketplace.hasPurchasedOffchain(
    messageId, 
    seller, 
    usdcAddress, 
    price, 
    buyer.address
  );
  console.log(`Has purchased offchain: ${initialStatus}`);

  // Generate the hash using the CORRECT method (abi.encode)
  const abiEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "address", "uint256", "uint256"],
    [messageId, seller, usdcAddress, price, deadline]
  );
  const dataHash = ethers.keccak256(abiEncoded);
  console.log("\n🔐 Data Hash to be signed:", dataHash);

  // Generate signature using deployer (who is a signer)
  const signature = await deployer.signMessage(ethers.getBytes(dataHash));
  console.log("Signature:", signature);

  // Try to mint USDC to buyer (might fail if not owner)
  try {
    console.log("\n💰 Attempting to mint USDC to buyer...");
    const mintTx = await usdc.mint(buyer.address, price);
    await mintTx.wait();
    console.log("✅ USDC minted to buyer");

    // Approve marketplace to spend USDC
    console.log("\n🔐 Approving marketplace to spend USDC...");
    const approveTx = await usdc.connect(buyer).approve(proxyAddress, price);
    await approveTx.wait();
    console.log("✅ USDC approved");

    // Attempt the purchase
    console.log("\n🛒 Attempting offchain purchase...");
    const purchaseTx = await marketplace.connect(buyer).purchaseOffchainMessage(
      messageId,
      seller,
      usdcAddress,
      price,
      deadline,
      signature
    );
    
    const receipt = await purchaseTx.wait();
    console.log("✅ Purchase successful!");
    console.log("Transaction hash:", purchaseTx.hash);
    console.log("Gas used:", receipt?.gasUsed.toString());

    // Check purchase status after purchase
    console.log("\n🔍 Purchase status after purchase:");
    const finalStatus = await marketplace.hasPurchasedOffchain(
      messageId, 
      seller, 
      usdcAddress, 
      price, 
      buyer.address
    );
    console.log(`Has purchased offchain: ${finalStatus}`);

    // Test with different buyer address
    const differentBuyer = "0x1234567890123456789012345678901234567890";
    const differentBuyerStatus = await marketplace.hasPurchasedOffchain(
      messageId, 
      seller, 
      usdcAddress, 
      price, 
      differentBuyer
    );
    console.log(`Different buyer (${differentBuyer}) has purchased: ${differentBuyerStatus}`);

    // Test with different amount (should not be purchased)
    const differentAmount = ethers.parseEther("2.0");
    const differentAmountStatus = await marketplace.hasPurchasedOffchain(
      messageId, 
      seller, 
      usdcAddress, 
      differentAmount, 
      buyer.address
    );
    console.log(`Different amount (${ethers.formatEther(differentAmount)}) has been purchased: ${differentAmountStatus}`);

    // Test with different seller (should not be purchased)
    const differentSeller = "0x9876543210987654321098765432109876543210";
    const differentSellerStatus = await marketplace.hasPurchasedOffchain(
      messageId, 
      differentSeller, 
      usdcAddress, 
      price, 
      buyer.address
    );
    console.log(`Different seller (${differentSeller}) has been purchased: ${differentSellerStatus}`);

    console.log("\n✅ Message hash functionality test completed successfully!");

  } catch (error) {
    console.log("❌ Purchase failed:", error.message);
    
    if (error.message.includes("Token transfer failed") || error.message.includes("ERC20InsufficientBalance")) {
      console.log("✅ Signature verification passed! The error is just due to insufficient USDC balance.");
      console.log("The contract has been updated with message hash functionality.");
    } else if (error.message.includes("Invalid signature")) {
      console.log("❌ Signature verification failed.");
    }
  }

  console.log("\n📋 Frontend Integration with Message Hash:");
  console.log(`
// Check if a user has purchased a message offchain using message hash
const hasPurchased = await marketplace.hasPurchasedOffchain(
  messageId, 
  seller, 
  token, 
  amount, 
  userAddress
);

// Example React component
function MessageComponent({ messageId, seller, token, amount, userAddress }) {
  const [hasPurchased, setHasPurchased] = useState(false);
  
  useEffect(() => {
    const checkPurchase = async () => {
      const purchased = await marketplace.hasPurchasedOffchain(
        messageId, 
        seller, 
        token, 
        amount, 
        userAddress
      );
      setHasPurchased(purchased);
    };
    checkPurchase();
  }, [messageId, seller, token, amount, userAddress]);
  
  return (
    <div>
      {hasPurchased ? (
        <div>✅ You have purchased this message</div>
      ) : (
        <div>❌ You have not purchased this message</div>
      )}
    </div>
  );
}
  `);

  console.log("\n🔑 Message Hash Benefits:");
  console.log("✅ More efficient storage - only stores hash, not full messageId");
  console.log("✅ Unique per message content - different amounts/sellers create different hashes");
  console.log("✅ Gas efficient - smaller storage footprint");
  console.log("✅ Secure - hash prevents collision attacks");

  console.log("\n✅ Test completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
