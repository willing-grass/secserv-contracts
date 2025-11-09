import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Testing offchain message purchase on BSC Testnet...");

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
  const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-purchase-" + Date.now()));
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

  if (!isSigner) {
    console.log("❌ Seller is not a signer! Cannot proceed with test.");
    return;
  }

  // Generate the hash using the EXACT same method as the contract
  // Contract uses: keccak256(abi.encode(messageId, seller, token, amount, deadline))
  const abiEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "address", "uint256", "uint256"],
    [messageId, seller, usdcAddress, price, deadline]
  );
  const dataHash = ethers.keccak256(abiEncoded);
  console.log("\n🔐 Hash to be signed:", dataHash);

  // Generate EIP-191 hash (what the contract expects)
  const ethHash = ethers.solidityPackedKeccak256(
    ["string", "bytes32"],
    ["\x19Ethereum Signed Message:\n32", dataHash]
  );
  console.log("EIP-191 hash:", ethHash);

  // Try to mint USDC to buyer (might fail if not owner)
  try {
    console.log("\n💰 Attempting to mint USDC to buyer...");
    const mintTx = await usdc.mint(buyer.address, price);
    await mintTx.wait();
    console.log("✅ USDC minted to buyer");
  } catch (error) {
    console.log("❌ Cannot mint USDC (not owner):", error.message);
    console.log("You'll need to manually fund the buyer account with USDC tokens");
    return;
  }

  // Check buyer's USDC balance
  const balance = await usdc.balanceOf(buyer.address);
  console.log("Buyer USDC balance:", ethers.formatEther(balance));

  if (balance < price) {
    console.log("❌ Insufficient USDC balance. Need:", ethers.formatEther(price));
    return;
  }

  // Approve marketplace to spend USDC
  console.log("\n🔐 Approving marketplace to spend USDC...");
  const approveTx = await usdc.connect(buyer).approve(proxyAddress, price);
  await approveTx.wait();
  console.log("✅ USDC approved");

  // Check allowance
  const allowance = await usdc.allowance(buyer.address, proxyAddress);
  console.log("Allowance:", ethers.formatEther(allowance));

  // Generate a test signature using the deployer (who is a signer)
  console.log("\n🔐 Generating test signature...");
  const testSignature = await deployer.signMessage(ethers.getBytes(dataHash));
  console.log("Test signature:", testSignature);

  // Verify the signature manually
  const recoveredAddress = ethers.verifyMessage(ethers.getBytes(dataHash), testSignature);
  console.log("Recovered address:", recoveredAddress);
  console.log("Deployer address:", deployer.address);
  console.log("Signature valid?", recoveredAddress.toLowerCase() === deployer.address.toLowerCase());

  // Try the purchase with the test signature
  try {
    console.log("\n🛒 Attempting purchase with test signature...");
    const purchaseTx = await marketplace.connect(buyer).purchaseOffchainMessage(
      messageId,
      seller,
      usdcAddress,
      price,
      deadline,
      testSignature
    );
    
    const receipt = await purchaseTx.wait();
    console.log("✅ Purchase successful!");
    console.log("Transaction hash:", purchaseTx.hash);
    console.log("Gas used:", receipt?.gasUsed.toString());
    
    // Check final balances
    const finalBuyerBalance = await usdc.balanceOf(buyer.address);
    const finalContractBalance = await usdc.balanceOf(proxyAddress);
    const finalSellerBalance = await usdc.balanceOf(seller);
    
    console.log("\n💰 Final balances:");
    console.log("Buyer balance:", ethers.formatEther(finalBuyerBalance));
    console.log("Contract balance:", ethers.formatEther(finalContractBalance));
    console.log("Seller balance:", ethers.formatEther(finalSellerBalance));
    
  } catch (error) {
    console.log("❌ Purchase failed:", error.message);
    
    // Try to decode the error
    if (error.message.includes("Invalid signature")) {
      console.log("\n🔍 Debugging signature issue:");
      console.log("1. Check if the signer is in the allowlist");
      console.log("2. Verify the hash calculation matches the contract");
      console.log("3. Ensure EIP-191 format is used");
      
      // Test with different hash formats
      console.log("\n🧪 Testing different hash formats:");
      
      // Test 1: Direct hash (no EIP-191)
      try {
        const directHash = ethers.solidityPackedKeccak256(
          ["bytes32", "address", "address", "uint256", "uint256"],
          [messageId, seller, usdcAddress, price, deadline]
        );
        const directSig = await deployer.signMessage(ethers.getBytes(directHash));
        console.log("Direct hash signature:", directSig);
      } catch (e) {
        console.log("Direct hash test failed:", e.message);
      }
      
      // Test 2: EIP-191 hash
      try {
        const eip191Hash = ethers.solidityPackedKeccak256(
          ["string", "bytes32"],
          ["\x19Ethereum Signed Message:\n32", dataHash]
        );
        const eip191Sig = await deployer.signMessage(ethers.getBytes(eip191Hash));
        console.log("EIP-191 hash signature:", eip191Sig);
      } catch (e) {
        console.log("EIP-191 hash test failed:", e.message);
      }
    }
  }

  console.log("\n✅ Test completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
