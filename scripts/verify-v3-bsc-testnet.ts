import { run } from "hardhat";

async function main() {
  console.log("🔍 Verifying V3 implementation contract on BSC Testnet...");

  const implementationAddress = "0xeed252d7f748921aeadefb5bb925e619ca1d89d1";
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
    console.log(`View on BSCScan: https://testnet.bscscan.com/address/${implementationAddress}`);
    
  } catch (error) {
    console.error("❌ Verification failed:", error);
    
    // Check if it's already verified
    if (error.message && error.message.includes("Already Verified")) {
      console.log("ℹ️  Contract is already verified!");
      console.log(`View on BSCScan: https://testnet.bscscan.com/address/${implementationAddress}`);
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
