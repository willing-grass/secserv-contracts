# MessageMarketplace Contract Upgrade Tutorial

This tutorial will guide you through deploying and upgrading the MessageMarketplace contract using OpenZeppelin's upgradeable contracts pattern.

## Prerequisites

1. Install required dependencies:
```bash
npm install --save-dev @openzeppelin/contracts-upgradeable @openzeppelin/hardhat-upgrades hardhat
```

2. Configure your `hardhat.config.js`:
```javascript
require('@openzeppelin/hardhat-upgrades');

module.exports = {
  solidity: "0.8.20",
  networks: {
    // Your network configurations
  }
};
```

## Deployment Steps

1. Create a deployment script (`scripts/deploy.js`):
```javascript
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Deploy USDC mock for testing (replace with actual USDC address in production)
  const USDC = await ethers.getContractFactory("MockERC20");
  const usdc = await USDC.deploy("USD Coin", "USDC");
  await usdc.deployed();
  
  // Deploy MessageMarketplace
  const MessageMarketplace = await ethers.getContractFactory("MessageMarketplace");
  const marketplace = await upgrades.deployProxy(MessageMarketplace, [
    usdc.address,
    deployer.address, // system fee address
    500 // 5% fee (500 basis points)
  ], { initializer: 'initialize' });
  
  await marketplace.deployed();
  
  console.log("MessageMarketplace deployed to:", marketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

2. Deploy the contract:
```bash
npx hardhat run scripts/deploy.js --network <your-network>
```

## Upgrading the Contract

1. Create an upgrade script (`scripts/upgrade.js`):
```javascript
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Address of the proxy contract
  const proxyAddress = "YOUR_PROXY_ADDRESS";
  
  // Deploy the new implementation
  const MessageMarketplaceV2 = await ethers.getContractFactory("MessageMarketplaceV2");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, MessageMarketplaceV2);
  
  console.log("Contract upgraded at:", upgraded.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

2. Run the upgrade:
```bash
npx hardhat run scripts/upgrade.js --network <your-network>
```

## Important Notes

1. **Storage Layout**: When upgrading, you must maintain the same storage layout. You can only append new state variables to the end of the contract.

2. **Initialization**: The `initialize` function can only be called once during deployment. Use the `initializer` modifier to prevent multiple initializations.

3. **Proxy Pattern**: The contract uses the UUPS (Universal Upgradeable Proxy Standard) pattern, where the upgrade logic is in the implementation contract.

4. **Testing**: Always test upgrades on a testnet before deploying to mainnet.

## Example Upgrade Scenario

Let's say you want to add a new feature to track total sales. Here's how to create the upgraded contract:

```solidity
// MessageMarketplaceV2.sol
contract MessageMarketplaceV2 is MessageMarketplace {
    uint256 public totalSales;
    
    function purchaseMessage(bytes32 messageId) external nonReentrant {
        super.purchaseMessage(messageId);
        totalSales += 1;
    }
}
```

## Security Considerations

1. Always verify the new implementation contract on Etherscan after upgrading.
2. Use a timelock for upgrades in production to allow users to react to changes.
3. Consider using a multi-sig wallet for the owner address.
4. Test upgrades thoroughly on testnets before mainnet deployment.

## Common Issues and Solutions

1. **Storage Collision**: If you get a storage collision error, ensure you're not modifying the order of existing state variables.

2. **Initialization Error**: If you get an initialization error, check that you're not trying to initialize the contract twice.

3. **Upgrade Authorization**: Make sure the account running the upgrade is the owner of the contract.

## Best Practices

1. Keep track of all deployed proxy addresses and their implementations.
2. Document all upgrades and changes made to the contract.
3. Consider implementing a timelock for upgrades in production.
4. Always test upgrades on a testnet first.
5. Keep the upgrade logic simple and focused. 