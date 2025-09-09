import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Upgrading MessageMarketplace to V3...");
  console.log("Deployer address:", deployer.address);

  // Get the existing proxy address from deployment info
  const fs = require("fs");
  let deploymentInfo;
  
  try {
    // Try to read from the most recent deployment info
    const files = [
      "deployment-info-sepolia.json",
      "deployment-info-polygon-amoy.json", 
      "deployment-info-bsc-testnet.json"
    ];
    
    for (const file of files) {
      if (fs.existsSync(file)) {
        deploymentInfo = JSON.parse(fs.readFileSync(file, "utf8"));
        console.log(`Found deployment info in ${file}`);
        break;
      }
    }
    
    if (!deploymentInfo) {
      throw new Error("No deployment info found. Please provide proxy address manually.");
    }
  } catch (error) {
    console.error("Error reading deployment info:", error);
    console.log("Please provide the proxy address manually:");
    console.log("const PROXY_ADDRESS = '0x...';");
    process.exit(1);
  }

  const PROXY_ADDRESS = deploymentInfo.proxyAddress;
  console.log("Proxy address:", PROXY_ADDRESS);

  // Deploy V3 implementation
  const MessageMarketplaceV3 = await ethers.getContractFactory("MessageMarketplaceV3");
  
  console.log("\nUpgrading proxy to V3 implementation...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, MessageMarketplaceV3);
  
  await upgraded.waitForDeployment();
  console.log("Upgrade completed!");

  // Get the new implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New implementation address:", implementationAddress);

  // Add deployer as signer (if not already added)
  console.log("\nAdding deployer as signer...");
  try {
    const addSignerTx = await upgraded.addSigner(deployer.address);
    await addSignerTx.wait();
    console.log("Deployer added as signer successfully!");
  } catch (error) {
    console.log("Deployer might already be a signer or error occurred:", error);
  }

  // Test basic functionality
  console.log("\nTesting V3 functionality...");
  
  // Test signer verification
  const isSigner = await upgraded.isSigner(deployer.address);
  console.log("Deployer is signer:", isSigner);

  // Test fee configuration
  const [feeAddress, feePercentage] = await upgraded.getFeeConfiguration();
  console.log("Fee address:", feeAddress);
  console.log("Fee percentage:", feePercentage.toString());

  // Test that old functions are disabled
  console.log("\nTesting that old functions are disabled...");
  try {
    await upgraded.createMessage(ethers.keccak256(ethers.toUtf8Bytes("test")), ethers.parseEther("1"), 0);
    console.log("ERROR: Old createMessage function should be disabled!");
  } catch (error) {
    console.log("✓ Old createMessage function properly disabled");
  }

  try {
    await upgraded.purchaseMessage(ethers.keccak256(ethers.toUtf8Bytes("test")));
    console.log("ERROR: Old purchaseMessage function should be disabled!");
  } catch (error) {
    console.log("✓ Old purchaseMessage function properly disabled");
  }

  // Display upgrade summary
  console.log("\n" + "=".repeat(60));
  console.log("UPGRADE SUMMARY");
  console.log("=".repeat(60));
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("New Implementation Address:", implementationAddress);
  console.log("Deployer:", deployer.address);
  console.log("Deployer is Signer:", isSigner);
  console.log("\nV3 Features Now Available:");
  console.log("- Off-chain message purchase flow");
  console.log("- EIP-191 signature verification");
  console.log("- Signer allowlist management");
  console.log("- Native coin purchases");
  console.log("- ERC-20 token purchases");
  console.log("- Cross-chain signature support");
  console.log("- Old flow disabled");
  console.log("- Emergency withdrawal functions");
  console.log("\nIMPORTANT NOTES:");
  console.log("- Old message creation/purchase functions are now disabled");
  console.log("- Backend integration required for new flow");
  console.log("- Existing V2 data is preserved but inaccessible");
  console.log("- New signers must be added via addSigner() function");
  console.log("=".repeat(60));

  // Save upgrade info
  const upgradeInfo = {
    ...deploymentInfo,
    upgradedTo: "V3",
    newImplementationAddress: implementationAddress,
    upgradeTimestamp: new Date().toISOString(),
    deployerIsSigner: isSigner
  };

  const outputFile = `upgrade-info-v3-${deploymentInfo.network?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(upgradeInfo, null, 2));
  console.log(`\nUpgrade info saved to ${outputFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
