import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Analyzing new transaction on BSC Testnet...");

  const transactionHash = "0xde7299bef44daa73ebcb5e3bc7ba2ac44cd66a7cc51489e4e4f0af0d520071bd";
  
  // Load deployment info
  const deploymentInfo = require("../deployment-info-bsc-testnet.json");
  const proxyAddress = deploymentInfo.proxyAddress;

  console.log("Transaction hash:", transactionHash);
  console.log("Proxy address:", proxyAddress);

  try {
    // Get transaction details
    const provider = ethers.provider;
    const tx = await provider.getTransaction(transactionHash);
    
    if (!tx) {
      console.log("❌ Transaction not found");
      return;
    }

    console.log("\n📋 Transaction Details:");
    console.log("From:", tx.from);
    console.log("To:", tx.to);
    console.log("Value:", ethers.formatEther(tx.value), "BNB");
    console.log("Gas Limit:", tx.gasLimit.toString());

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(transactionHash);
    
    if (!receipt) {
      console.log("❌ Transaction receipt not found");
      return;
    }

    console.log("\n📋 Transaction Receipt:");
    console.log("Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Block Number:", receipt.blockNumber);

    // Decode the transaction data
    const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
    const contract = MessageMarketplaceV3.attach(proxyAddress);
    
    try {
      const decoded = contract.interface.parseTransaction({ data: tx.data });
      if (decoded) {
        console.log("\n📋 Decoded Transaction:");
        console.log("Function:", decoded.name);
        console.log("Args:", decoded.args);
        
        if (decoded.name === "purchaseOffchainMessage") {
          const [messageId, seller, token, amount, deadline, signature] = decoded.args;
          
          console.log("\n📝 Purchase Parameters:");
          console.log("Message ID:", messageId);
          console.log("Seller:", seller);
          console.log("Token:", token);
          console.log("Amount:", ethers.formatEther(amount), "USDC");
          console.log("Deadline:", new Date(Number(deadline) * 1000).toISOString());
          console.log("Signature:", signature);
          
          // Check if deadline has passed
          const currentTime = Math.floor(Date.now() / 1000);
          const deadlineTime = Number(deadline);
          console.log("Deadline passed?", currentTime > deadlineTime);
          
          // Calculate the hash that should have been signed
          const dataHash = ethers.solidityPackedKeccak256(
            ["bytes32", "address", "address", "uint256", "uint256"],
            [messageId, seller, token, amount, deadline]
          );
          console.log("Data Hash:", dataHash);
          
          // Try to recover the signer
          try {
            const ethHash = ethers.solidityPackedKeccak256(
              ["string", "bytes32"],
              ["\x19Ethereum Signed Message:\n32", dataHash]
            );
            
            const recoveredSigner = ethers.recoverAddress(ethHash, signature);
            console.log("Recovered Signer:", recoveredSigner);
            
            // Check if the recovered signer is authorized
            const isAuthorized = await contract.signers(recoveredSigner);
            console.log("Is Authorized Signer:", isAuthorized);
            
          } catch (sigError) {
            console.log("❌ Signature recovery failed:", sigError.message);
          }
          
          // Check if the purchase was recorded
          const buyerPurchased = await contract.hasPurchasedOffchain(
            messageId,
            seller,
            token,
            amount,
            tx.from
          );
          console.log("Purchase Recorded:", buyerPurchased);
        }
      }
    } catch (decodeError) {
      console.log("❌ Failed to decode transaction:", decodeError.message);
    }

    // Check for events
    if (receipt.logs && receipt.logs.length > 0) {
      console.log("\n📋 Events:");
      console.log("Number of events:", receipt.logs.length);
      
      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        try {
          const decoded = contract.interface.parseLog(log);
          if (decoded) {
            console.log(`Event ${i + 1}:`, decoded.name);
            console.log("  Args:", decoded.args);
          }
        } catch (e) {
          console.log(`Event ${i + 1}: Unknown event`);
        }
      }
    }

  } catch (error) {
    console.error("❌ Error analyzing transaction:", error);
  }

  // Now check the specific parameters you mentioned
  console.log("\n🔍 Checking your specific parameters:");
  
  const messageId = "0x859f7a8b68002bf5e16f0e01947794632876030cfa89288f425950c79c1ccb6b";
  const seller = "0x963a7dF5eB64B73E4012ECa5d08C1988C7346EC2";
  const token = "0x4C07B79C3D8954A51Efc342EdA5D08f8b1f9ceC4";
  const amount = BigInt("100000000000000000"); // 0.1 USDC
  const buyer = "0xB0057C641C089688b0A9Cb9c045bA88F084C036E";

  console.log("\n📝 Your Parameters:");
  console.log("Message ID:", messageId);
  console.log("Seller:", seller);
  console.log("Token:", token);
  console.log("Amount:", ethers.formatEther(amount), "USDC");
  console.log("Buyer:", buyer);

  // Check hasPurchasedOffchain
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  const marketplace = MessageMarketplaceV3.attach(proxyAddress);
  
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
  try {
    const directCheck = await marketplace.offchainPurchases(messageHash, buyer);
    console.log("Direct offchainPurchases mapping:", directCheck);
  } catch (error) {
    console.log("Direct mapping error:", error.message);
  }

  console.log("\n✅ Transaction analysis completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
