import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Updating USDT address on Polygon Mainnet...");
  console.log("Deployer address:", deployer.address);
  console.log("Account balance:", (await deployer.provider?.getBalance(deployer.address)).toString());

  // Polygon Mainnet proxy address
  const PROXY_ADDRESS = "0x3Dfb0f9e802528Dfff91bb6F893FC4FfB0362DBd";
  const NEW_USDT_ADDRESS = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";

  console.log("\nConfiguration:");
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("New USDT Address:", NEW_USDT_ADDRESS);

  // Get the contract instance
  const marketplace = await ethers.getContractAt("MessageMarketplaceV3", PROXY_ADDRESS);
  
  // Check current USDC address
  const currentUsdcAddress = await marketplace.usdc();
  console.log("Current USDC Address:", currentUsdcAddress);
  
  if (currentUsdcAddress.toLowerCase() === NEW_USDT_ADDRESS.toLowerCase()) {
    console.log("✅ USDT address is already set correctly!");
    return;
  }

  // Update the USDC address to USDT
  console.log("\nUpdating USDC address to USDT...");
  try {
    const updateTx = await marketplace.updateUSDCAddress(NEW_USDT_ADDRESS);
    console.log("Transaction hash:", updateTx.hash);
    
    const receipt = await updateTx.wait();
    console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);
    
    // Verify the update
    const newUsdcAddress = await marketplace.usdc();
    console.log("New USDC Address:", newUsdcAddress);
    
    if (newUsdcAddress.toLowerCase() === NEW_USDT_ADDRESS.toLowerCase()) {
      console.log("✅ USDT address updated successfully!");
    } else {
      console.log("❌ USDT address update failed!");
    }
    
  } catch (error) {
    console.error("❌ Error updating USDT address:", error);
    
    // Check if the method exists
    try {
      await marketplace.updateUSDCAddress.staticCall(NEW_USDT_ADDRESS);
    } catch (methodError) {
      console.log("Method updateUSDCAddress may not exist in this contract version");
      console.log("You may need to upgrade the contract first or use a different approach");
    }
  }

  // Display summary
  console.log("\n" + "=".repeat(60));
  console.log("UPDATE SUMMARY");
  console.log("=".repeat(60));
  console.log("Network: Polygon Mainnet");
  console.log("Chain ID: 137");
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("Previous USDC Address:", currentUsdcAddress);
  console.log("New USDT Address:", NEW_USDT_ADDRESS);
  console.log("Deployer:", deployer.address);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
