# Message Marketplace Smart Contract

This smart contract implements a marketplace for encrypted messages on the Base blockchain. Creators can create messages with a price in USDC, and buyers can purchase these messages. The contract handles the payment distribution (90% to creator, 10% to system).

## Features

- Create messages with a price in USDC
- Purchase messages using USDC
- Automatic fee distribution (90% to creator, 10% to system)
- Message purchase tracking
- Owner controls for system fee address updates

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Fill in your environment variables in `.env`:
- `PRIVATE_KEY`: Your wallet's private key for deployment
- `BASE_SEPOLIA_RPC_URL`: Base Sepolia RPC URL (default provided)
- `BASE_MAINNET_RPC_URL`: Base Mainnet RPC URL (default provided)
- `BASESCAN_API_KEY`: Your Basescan API key for contract verification

## Testing

Run the test suite:
```bash
npx hardhat test
```

## Deployment

### Deploy to Base Sepolia (Testnet)
```bash
npm run deploy:sepolia
```

### Deploy to Base Mainnet
```bash
npm run deploy:mainnet
```

Note: The Base mainnet deployment uses the actual USDC token contract (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) rather than deploying a mock token.

## Contract Usage

### Creating a Message
1. Generate a unique message ID (hash of your message content)
2. Call `createMessage(messageId, price)` with the message ID and price in USDC

### Purchasing a Message
1. Approve the contract to spend your USDC
2. Call `purchaseMessage(messageId)` with the message ID

### Checking Message Status
- Use `getMessage(messageId)` to get message details
- Use `isMessagePurchased(messageId)` to check if a message has been purchased

## Backend Integration

1. Store encrypted messages on your server with their corresponding message IDs
2. When a user attempts to access a message:
   - Check if they've purchased it using `isMessagePurchased(messageId)`
   - If purchased, provide the decryption key or decrypted content
   - If not purchased, prompt them to purchase first

## Security Considerations

- Always verify message purchases on-chain before providing access to content
- Use secure encryption for message content
- Implement rate limiting and other security measures on your backend
- Consider implementing additional access controls if needed

## License

MIT


Deploy:
Deploying Mock USDC...
Mock USDC deployed to: 0x8A7d4bbe0194C75356Ffdc44D1BFb2402cFa60c2
Deploying MessageMarketplace...
MessageMarketplace deployed to: 0x8ca18C41a57C406b948334f25B1A2c5266Df85a3
Waiting for block confirmations...
Verifying contracts...
Successfully submitted source code for contract
contracts/mocks/MockERC20.sol:MockERC20 at 0x8A7d4bbe0194C75356Ffdc44D1BFb2402cFa60c2
for verification on the block explorer. Waiting for verification result...

Successfully verified contract MockERC20 on the block explorer.
https://sepolia.basescan.org/address/0x8A7d4bbe0194C75356Ffdc44D1BFb2402cFa60c2#code

Mock USDC verified successfully
Successfully submitted source code for contract
contracts/MessageMarketplace.sol:MessageMarketplace at 0x8ca18C41a57C406b948334f25B1A2c5266Df85a3
for verification on the block explorer. Waiting for verification result...

Successfully verified contract MessageMarketplace on the block explorer.
https://sepolia.basescan.org/address/0x8ca18C41a57C406b948334f25B1A2c5266Df85a3#code

MessageMarketplace verified successfully
