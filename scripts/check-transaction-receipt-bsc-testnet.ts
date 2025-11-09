import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Checking transaction receipt on BSC Testnet...");

  // Transaction hash from your transaction (you'll need to provide this)
  // For now, let's check recent transactions
  const provider = ethers.provider;
  
  try {
    // Get the latest block
    const latestBlock = await provider.getBlockNumber();
    console.log("Latest block:", latestBlock);
    
    // Get the last few blocks to find the transaction
    console.log("\n🔍 Searching for purchaseOffchainMessage transactions...");
    
    for (let i = 0; i < 5; i++) {
      const blockNumber = latestBlock - i;
      const block = await provider.getBlock(blockNumber, true);
      
      if (block && block.transactions) {
        for (const txHash of block.transactions) {
          try {
            const tx = await provider.getTransaction(txHash);
            if (tx && tx.data.startsWith("0xa2808f68")) { // Method ID for purchaseOffchainMessage
              console.log(`\n📋 Found purchaseOffchainMessage transaction:`);
              console.log("Transaction hash:", txHash);
              console.log("From:", tx.from);
              console.log("To:", tx.to);
              console.log("Block:", blockNumber);
              
              // Get transaction receipt
              const receipt = await provider.getTransactionReceipt(txHash);
              if (receipt) {
                console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
                console.log("Gas used:", receipt.gasUsed.toString());
                
                // Check for events
                if (receipt.logs && receipt.logs.length > 0) {
                  console.log("Events emitted:", receipt.logs.length);
                  
                  // Try to decode events
                  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
                  const contract = MessageMarketplaceV3.attach(tx.to);
                  
                  for (const log of receipt.logs) {
                    try {
                      const decoded = contract.interface.parseLog(log);
                      if (decoded) {
                        console.log("Event:", decoded.name, decoded.args);
                      }
                    } catch (e) {
                      // Not our contract event
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Skip invalid transactions
          }
        }
      }
    }
    
  } catch (error) {
    console.error("Error:", error);
  }

  console.log("\n✅ Transaction analysis completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
