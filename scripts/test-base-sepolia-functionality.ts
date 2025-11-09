import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Testing Base Sepolia V3 functionality...");

  // Get accounts
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  console.log("Deployer address:", deployer.address);

  // Load deployment info
  const deploymentInfo = require("../deployment-info-base-sepolia.json");
  const proxyAddress = deploymentInfo.proxyAddress;
  const usdcAddress = deploymentInfo.usdcAddress;

  console.log("Proxy address:", proxyAddress);
  console.log("USDC address:", usdcAddress);

  // Connect to contracts
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  const marketplace = MessageMarketplaceV3.attach(proxyAddress);

  // Test data
  const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-base-sepolia-" + Date.now()));
  const seller = "0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2"; // The additional signer
  const price = ethers.parseEther("1.0"); // 1 USDC (assuming 18 decimals)
  const deadline = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now

  console.log("\n📝 Test Parameters:");
  console.log("Message ID:", messageId);
  console.log("Seller:", seller);
  console.log("Price:", ethers.formatEther(price), "USDC");
  console.log("Deadline:", new Date(deadline * 1000).toISOString());

  // Check if seller is a signer
  const isSigner = await marketplace.signers(seller);
  console.log(`Is seller a signer? ${isSigner}`);

  // Check initial purchase status
  console.log("\n🔍 Initial purchase status:");
  const initialStatus = await marketplace.hasPurchasedOffchain(
    messageId,
    seller,
    usdcAddress,
    price,
    deployer.address
  );
  console.log(`Has purchased offchain: ${initialStatus}`);

  // Generate the hash using the CORRECT method (abi.encode)
  const abiEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "address", "uint256", "uint256"],
    [messageId, seller, usdcAddress, price, deadline]
  );
  const dataHash = ethers.keccak256(abiEncoded);
  console.log("\n🔐 Hash to be signed:", dataHash);

  // Generate signature using deployer (who is a signer)
  const signature = await deployer.signMessage(ethers.getBytes(dataHash));
  console.log("Signature:", signature);

  // Test with different parameters to make sure it's working correctly
  console.log("\n🧪 Testing with different parameters:");
  
  // Test 1: Different buyer
  const differentBuyer = "0x1234567890123456789012345678901234567890";
  try {
    const differentBuyerResult = await marketplace.hasPurchasedOffchain(
      messageId,
      seller,
      usdcAddress,
      price,
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
      usdcAddress,
      differentAmount,
      deployer.address
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
      usdcAddress,
      price,
      deployer.address
    );
    console.log("Different message ID result:", differentMessageResult);
  } catch (error) {
    console.log("Different message ID error:", error.message);
  }

  // Check signers
  console.log("\n🔍 Current Signers:");
  const deployerSigner = "0xeEf4566F8eBC599F84854e14456cBE7BA9EB1471";
  const additionalSigner = "0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2";
  
  const isDeployerSigner = await marketplace.signers(deployerSigner);
  const isAdditionalSigner = await marketplace.signers(additionalSigner);
  
  console.log(`Deployer (${deployerSigner}):`, isDeployerSigner);
  console.log(`Additional (${additionalSigner}):`, isAdditionalSigner);

  console.log("\n📋 Frontend Integration:");
  console.log(`
// Check if a user has purchased a message offchain on Base Sepolia
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

  console.log("\n✅ Base Sepolia V3 functionality test completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
