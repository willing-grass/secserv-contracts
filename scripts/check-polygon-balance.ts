import { ethers } from "hardhat";

async function main() {
  console.log("💰 Checking Polygon Amoy balance...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  try {
    // Check balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Current balance:", ethers.formatEther(balance), "MATIC");
    
    // Estimate gas for deployment
    const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
    const gasEstimate = await MessageMarketplaceV3.getDeployTransaction().then(tx => 
      ethers.provider.estimateGas(tx)
    );
    
    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits("1", "gwei");
    const estimatedCost = gasEstimate * gasPrice;
    
    console.log("Estimated deployment cost:", ethers.formatEther(estimatedCost), "MATIC");
    console.log("Gas estimate:", gasEstimate.toString());
    console.log("Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
    
    if (balance < estimatedCost) {
      console.log("\n❌ Insufficient funds!");
      console.log(`Need: ${ethers.formatEther(estimatedCost)} MATIC`);
      console.log(`Have: ${ethers.formatEther(balance)} MATIC`);
      console.log(`Shortfall: ${ethers.formatEther(estimatedCost - balance)} MATIC`);
      
      console.log("\n🔧 To fund the account:");
      console.log("1. Go to Polygon Amoy Faucet: https://faucet.polygon.technology/");
      console.log("2. Enter your address:", deployer.address);
      console.log("3. Request MATIC tokens");
      console.log("4. Wait for confirmation");
      console.log("5. Run the upgrade script again");
    } else {
      console.log("\n✅ Sufficient funds available!");
    }

  } catch (error) {
    console.error("❌ Error checking balance:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
