import { ethers } from "ethers";

/**
 * Backend signing utilities for MessageMarketplaceV3
 * These functions match the signature verification in the smart contract
 */

export interface PurchaseParams {
  messageId: string;
  seller: string;
  token: string;
  amount: bigint | string;
  deadline: number;
}

/**
 * Sign an ERC-20 token purchase
 * @param params Purchase parameters including token address
 * @param privateKey Backend signer private key
 * @returns EIP-191 signature
 */
export async function signPurchase(
  params: PurchaseParams,
  privateKey: string
): Promise<string> {
  const signer = new ethers.Wallet(privateKey);
  
  // Build hash exactly as contract does (including token)
  const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "address", "uint256", "uint256"],
    [params.messageId, params.seller, params.token, params.amount, params.deadline]
  ));
  
  // Sign with EIP-191 (Ethereum Signed Message)
  const signature = await signer.signMessage(ethers.getBytes(dataHash));
  return signature;
}

/**
 * Generate a message ID from content ID, seller, and optional salt
 * @param contentId Content identifier
 * @param seller Seller address
 * @param salt Optional salt (default: empty string)
 * @returns Message ID (bytes32)
 */
export function generateMessageId(
  contentId: string,
  seller: string,
  salt: string = ""
): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "address", "string"],
      [contentId, seller, salt]
    )
  );
}

/**
 * Create deadline timestamp (current time + TTL)
 * @param ttlSeconds Time to live in seconds (default: 15 minutes)
 * @returns Unix timestamp
 */
export function createDeadline(ttlSeconds: number = 900): number {
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

/**
 * Validate signature parameters
 * @param params Purchase parameters
 * @returns True if valid
 */
export function validatePurchaseParams(params: PurchaseParams): boolean {
  return (
    params.messageId !== "" &&
    ethers.isAddress(params.seller) &&
    ethers.isAddress(params.token) &&
    BigInt(params.amount) > 0 &&
    params.deadline > Math.floor(Date.now() / 1000)
  );
}

/**
 * Example usage and testing
 */
export async function exampleUsage() {
  // Example private key (DO NOT USE IN PRODUCTION)
  const privateKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  
  // Example parameters
  const messageId = generateMessageId("content-123", "0x742d35Cc6634C0532925a3b8D0C4C4C4C4C4C4C4C");
  const seller = "0x742d35Cc6634C0532925a3b8D0C4C4C4C4C4C4C4C";
  const tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC
  const amount = ethers.parseEther("1.0");
  const deadline = createDeadline(900); // 15 minutes
  
  // Sign ERC-20 purchase
  const signature = signPurchase({
    messageId,
    seller,
    token: tokenAddress,
    amount,
    deadline
  }, privateKey);
  
  console.log("ERC-20 purchase signature:", signature);
  
  // Validate parameters
  console.log("Parameters valid:", validatePurchaseParams({
    messageId,
    seller,
    token: tokenAddress,
    amount,
    deadline
  }));
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}
