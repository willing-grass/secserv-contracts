import { ethers, upgrades } from "hardhat";

async function main() {
  // You need to provide the proxy address
  const proxyAddress = process.env.PROXY_ADDRESS;
  
  if (!proxyAddress) {
    throw new Error("Please set PROXY_ADDRESS environment variable with your deployed proxy address");
  }
  
  console.log("Checking proxy status for:", proxyAddress);
  
  try {
    // Get the current implementation address
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Current implementation address:", implementationAddress);
    
    // Get the admin address
    const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    console.log("Proxy admin address:", adminAddress);
    
    // Try to get the beacon address (if using beacon proxy)
    try {
      const beaconAddress = await upgrades.erc1967.getBeaconAddress(proxyAddress);
      console.log("Beacon address:", beaconAddress);
    } catch (error) {
      console.log("Not a beacon proxy (this is normal for UUPS proxy)");
    }
    
    // Connect to the proxy contract
    const MessageMarketplace = await ethers.getContractFactory("MessageMarketplace");
    const proxyContract = MessageMarketplace.attach(proxyAddress) as any;
    
    // Get some basic contract info
    try {
      const usdcAddress = await proxyContract.usdc();
      console.log("USDC address:", usdcAddress);
      
      const systemFeeAddress = await proxyContract.systemFeeAddress();
      console.log("System fee address:", systemFeeAddress);
      
      const feePercentage = await proxyContract.feePercentage();
      console.log("Fee percentage:", feePercentage.toString(), "basis points");
      
      // Check if it's V2 by trying to call V2-specific functions
      try {
        const totalSales = await proxyContract.totalSales();
        console.log("Total sales:", totalSales.toString());
        console.log("✅ This appears to be V2 implementation");
      } catch (error) {
        console.log("❌ This appears to be V1 implementation (no totalSales function)");
      }
      
    } catch (error) {
      console.log("Error getting contract info:", error);
    }
    
  } catch (error) {
    console.log("Error checking proxy status:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 