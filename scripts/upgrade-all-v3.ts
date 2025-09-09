import { execSync } from 'child_process';
import { ethers } from 'hardhat';

async function main() {
  console.log("🚀 Starting V3 upgrade process for all 4 testnets...\n");

  const networks = [
    { name: "Ethereum Sepolia", script: "upgrade-v3-sepolia.ts", network: "sepolia" },
    { name: "Polygon Amoy", script: "upgrade-v3-polygon-amoy.ts", network: "polygonAmoy" },
    { name: "BSC Testnet", script: "upgrade-v3-bsc-testnet.ts", network: "bscTestnet" },
    { name: "Base Sepolia", script: "upgrade-v3-base-sepolia.ts", network: "baseSepolia" }
  ];

  const results = [];

  for (const network of networks) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Upgrading ${network.name}...`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Run the upgrade
      console.log(`⬆️  Running V3 upgrade for ${network.name}...`);
      execSync(`npx hardhat run scripts/${network.script} --network ${network.network}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      console.log(`✅ Successfully upgraded ${network.name} to V3`);
      results.push({ network: network.name, status: 'success', error: null });

    } catch (error) {
      console.error(`❌ Failed to upgrade ${network.name}:`, error.message);
      results.push({ network: network.name, status: 'failed', error: error.message });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log("📊 UPGRADE SUMMARY");
  console.log(`${'='.repeat(60)}`);

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log(`✅ Successful upgrades: ${successful}`);
  console.log(`❌ Failed upgrades: ${failed}`);
  console.log(`📈 Success rate: ${Math.round((successful / results.length) * 100)}%`);

  console.log("\nDetailed Results:");
  results.forEach(result => {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(`${status} ${result.network}: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  if (failed > 0) {
    console.log(`\n⚠️  ${failed} upgrade(s) failed. Please check the errors above and retry manually.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All upgrades completed successfully!`);
    console.log("\nNext steps:");
    console.log("1. Add backend signers to all contracts using addSigner() function");
    console.log("2. Test the new V3 functionality on each network");
    console.log("3. Update your backend to use the new V3 flow");
    console.log("4. Deploy to mainnets when ready");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
