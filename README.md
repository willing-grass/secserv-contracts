# Message Marketplace Contracts

A decentralized marketplace for purchasing messages using USDC, with support for both direct purchases and fiat gateway purchases.

## Features

### V1 (Base Contract)
- Create messages with pricing and expiration
- Purchase messages with USDC
- Fee distribution system
- Upgradeable contract architecture (UUPS)

### V2 (Enhanced Features)
- **Fiat Purchase Support**: Purchase messages through external fiat providers
- **Hash-based Validation**: Support for `purchaseHash` (messageId + web2UserId) and `backendValidationHash`
- **Batch Operations**: Efficient batch processing for multiple fiat purchases
- **Enhanced Statistics**: Track total sales and volume
- **Gas Optimizations**: Storage packing, unchecked math, and internal functions

## Networks Supported

- **Base Sepolia** (Chain ID: 84532)
- **Base Mainnet** (Chain ID: 8453)
- **Ethereum Sepolia** (Chain ID: 11155111)
- **Polygon Amoy** (Chain ID: 80002)
- **BSC Testnet** (Chain ID: 97)

## Quick Start

### 1. Environment Setup

Create a `.env` file:

```bash
# Private Keys
PRIVATE_KEY=your_private_key_here

# RPC URLs
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_MAINNET_RPC_URL=https://mainnet.base.org
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-project-id
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# API Keys
BASESCAN_API_KEY=your_basescan_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
BSCSCAN_API_KEY=your_bscscan_api_key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Compile Contracts

```bash
npx hardhat compile
```

### 4. Run Tests

```bash
npx hardhat test
```

## Deployment

### Deploy V2 to Ethereum Sepolia

```bash
npx hardhat run scripts/deploy-v2-sepolia.ts --network sepolia
```

This will:
- Deploy `MessageMarketplaceV2` as an upgradeable proxy
- Use Ethereum Sepolia test USDC: `0x42D8BCf255125BB186459AF66bB74EEF8b8cC391`
- Set 5% fee (500 basis points)
- Verify the contract on Etherscan
- Save deployment info to `deployment-info-sepolia.json`

### Deploy V2 to Polygon Amoy

```bash
npx hardhat run scripts/deploy-v2-polygon-amoy.ts --network polygonAmoy
```

This will:
- Deploy `MessageMarketplaceV2` as an upgradeable proxy
- Use Polygon Amoy test USDC: `0x834bBE71a0a5C91A4Aff10Df400A963D95AD4775`
- Set 5% fee (500 basis points)
- Verify the contract on Polygonscan
- Save deployment info to `deployment-info-polygon-amoy.json`

### Deploy V2 to BSC Testnet

```bash
npx hardhat run scripts/deploy-v2-bsc-testnet.ts --network bscTestnet
```

This will:
- Deploy `MessageMarketplaceV2` as an upgradeable proxy
- Use BSC Testnet test USDC: `0x4C07B79C3D8954A51Efc342EdA5D08f8b1f9ceC4`
- Set 5% fee (500 basis points)
- Verify the contract on BSCScan
- Save deployment info to `deployment-info-bsc-testnet.json`

### Test Deployed Contracts

```bash
# Test Ethereum Sepolia deployment
npx hardhat run scripts/test-sepolia-deployment.ts --network sepolia

# Test Polygon Amoy deployment
npx hardhat run scripts/test-polygon-amoy-deployment.ts --network polygonAmoy

# Test BSC Testnet deployment
npx hardhat run scripts/test-bsc-testnet-deployment.ts --network bscTestnet
```

### Upgrade Existing V1 Contract

For Base Sepolia:
```bash
npx hardhat run scripts/upgrade-fiat-purchase.ts --network baseSepolia
```

## Contract Functions

### V1 Functions
- `createMessage(bytes32 messageId, uint256 price, uint256 expireAt)`
- `purchaseMessage(bytes32 messageId)`
- `getMessage(bytes32 messageId)`
- `hasPurchasedMessage(bytes32 messageId, address buyer)`

### V2 Additional Functions
- `purchaseMessageByFiat(bytes32 messageId, bytes32 purchaseHash, bytes32 backendValidationHash)`
- `purchaseMessagesByFiatBatch(bytes32[] messageIds, bytes32[] purchaseHashes, bytes32[] backendValidationHashes)`
- `hasPurchasedMessageByFiat(bytes32 purchaseHash)`
- `getFiatPurchaseDetails(bytes32 purchaseHash)`
- `getMarketplaceStats()`

## Fiat Purchase Flow

1. **Frontend**: User initiates fiat payment
2. **Backend**: Validates payment and generates hashes:
   ```javascript
   const purchaseHash = keccak256(abi.encodePacked(messageId, web2UserId));
   const backendValidationHash = keccak256(abi.encodePacked(purchaseHash, paymentDetails, secret));
   ```
3. **Contract**: Receives hashes and processes USDC transfer
4. **Event**: `MessagePurchasedByFiat` emitted with purchase details

## Gas Optimization Features

- **Storage Packing**: `uint128` for timestamp and price in structs
- **Unchecked Math**: Safe subtraction where overflow is impossible
- **Internal Functions**: `_hasPurchasedMessageByFiat` for gas efficiency
- **Batch Operations**: Single transaction for multiple purchases
- **Storage Read Caching**: Cache frequently accessed storage variables

## Testing

Run comprehensive tests:

```bash
# Run all tests
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run specific test file
npx hardhat test test/MessageMarketplaceV2.test.ts
```

## Contract Addresses

### Ethereum Sepolia
- **USDC Test Token**: `0x42D8BCf255125BB186459AF66bB74EEF8b8cC391`
- **Proxy**: `0xe0EeD4CFCaA5aEE9CC6Cdbe37029da710cE72c65`
- **Implementation**: `0x8ca18C41a57C406b948334f25B1A2c5266Df85a3`

### Polygon Amoy
- **USDC Test Token**: `0x834bBE71a0a5C91A4Aff10Df400A963D95AD4775`
- **Proxy**: (Deployed address will be shown after deployment)
- **Implementation**: (Deployed address will be shown after deployment)

### BSC Testnet
- **USDC Test Token**: `0x4C07B79C3D8954A51Efc342EdA5D08f8b1f9ceC4`
- **Proxy**: (Deployed address will be shown after deployment)
- **Implementation**: (Deployed address will be shown after deployment)

### Base Sepolia
- **Proxy**: `0x0DD6017dE44f82a54553941A85A66C87b085E0d1`
- **USDC**: `0x3bE123Ff0ec7c0717D6C05C8957EA7880e2FfDcb`

## Development

### Adding New Networks

1. Add network configuration to `hardhat.config.ts`
2. Add corresponding Etherscan API key
3. Create deployment script for the new network

### Upgrading Contracts

1. Create new contract version inheriting from base
2. Update deployment/upgrade scripts
3. Test thoroughly before deployment
4. Use UUPS upgrade pattern for seamless upgrades

## License

MIT
