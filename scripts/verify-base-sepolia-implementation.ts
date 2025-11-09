import { run } from "hardhat";

async function main() {
  console.log("🔍 Verifying new V3 implementation contract on Base Sepolia...");

  const implementationAddress = "0x57e6E8C3c74C1fE4D9E4Db9b03db3c1F0db26AB5";
  const contractName = "MessageMarketplaceV3";

  console.log("Implementation address:", implementationAddress);
  console.log("Contract name:", contractName);

  try {
    console.log("Starting verification...");
    
    await run("verify:verify", {
      address: implementationAddress,
      contract: `contracts/${contractName}.sol:${contractName}`,
      constructorArguments: [], // No constructor arguments for implementation contract
    });

    console.log("✅ Contract verified successfully!");
    console.log(`View on BaseScan: https://sepolia.basescan.org/address/${implementationAddress}`);
    
  } catch (error) {
    console.error("❌ Verification failed:", error);
    
    // Check if it's already verified
    if (error.message && error.message.includes("Already Verified")) {
      console.log("ℹ️  Contract is already verified!");
      console.log(`View on BaseScan: https://sepolia.basescan.org/address/${implementationAddress}`);
    } else {
      throw error;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
