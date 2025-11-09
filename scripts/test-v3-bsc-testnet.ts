import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Testing V3 functionality on BSC Testnet...");

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
  const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-bsc-" + Date.now()));
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

  // Note: USDC minting requires owner privileges
  console.log("\n💰 Note: USDC minting requires owner privileges");
  console.log("You'll need to manually fund the buyer account with USDC tokens");

  // Generate the hash using the CORRECT method (abi.encode)
  const abiEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "address", "uint256", "uint256"],
    [messageId, seller, usdcAddress, price, deadline]
  );
  const dataHash = ethers.keccak256(abiEncoded);
  console.log("\n🔐 Hash to be signed by backend:", dataHash);

  // Generate curl commands for backend API
  console.log("\n🌐 Backend API Calls:");
  console.log("\n1. Create message (POST /api/message/create):");
  console.log(`curl -X POST https://secserv.test/api/message/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "messageId": "${messageId}",
    "seller": "${seller}",
    "contentId": "test-content-${Date.now()}",
    "status": "active"
  }'`);

  console.log("\n2. Read message (GET /api/message/read):");
  console.log(`curl -X GET "https://secserv.test/api/message/read?messageId=${messageId}&chainId=97&token=${usdcAddress}"`);

  console.log("\n3. Expected response format:");
  console.log(`{
  "messageId": "${messageId}",
  "seller": "${seller}",
  "token": "${usdcAddress}",
  "amount": "${price.toString()}",
  "deadline": ${deadline},
  "signature": "0x..."
}`);

  console.log("\n4. Backend should sign this hash using abi.encode:");
  console.log(`Hash: ${dataHash}`);
  console.log(`Backend code:`);
  console.log(`
const abiEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
  ["bytes32", "address", "address", "uint256", "uint256"],
  [messageId, seller, token, amount, deadline]
);
const dataHash = ethers.keccak256(abiEncoded);
const signature = await signerWallet.signMessage(ethers.getBytes(dataHash));
  `);

  console.log("\n5. After getting signature, test purchase:");
  console.log(`// Use the signature from the backend response`);
  console.log(`// Call marketplace.purchaseOffchainMessage(messageId, seller, usdcAddress, price, deadline, signature)`);

  console.log("\n✅ Test setup complete! Use the curl commands above to test with your backend.");
  console.log("🔑 Key: Backend must use abi.encode (NOT solidityPackedKeccak256) for hash generation!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });