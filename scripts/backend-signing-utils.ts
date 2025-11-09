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

export interface FiatPurchaseParams {
  messageId: string;
  creator: string;
  amount: bigint | string;
  web2UserId: string;
  validationHash: string;
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
 * Sign a fiat purchase
 * @param params Fiat purchase parameters
 * @param privateKey Backend signer private key
 * @returns EIP-191 signature
 */
export async function signFiatPurchase(
  params: FiatPurchaseParams,
  privateKey: string
): Promise<string> {
  const signer = new ethers.Wallet(privateKey);
  
  // Build hash exactly as contract does (including creator)
  const dataHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "uint256", "bytes32", "bytes32", "uint256"],
    [params.messageId, params.creator, params.amount, params.web2UserId, params.validationHash, params.deadline]
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
 * Validate fiat purchase parameters
 * @param params Fiat purchase parameters
 * @returns True if valid
 */
export function validateFiatPurchaseParams(params: FiatPurchaseParams): boolean {
  return (
    params.messageId !== "" &&
    ethers.isAddress(params.creator) &&
    BigInt(params.amount) > 0 &&
    params.web2UserId !== "" &&
    params.validationHash !== "" &&
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
  const signature = await signPurchase({
    messageId,
    seller,
    token: tokenAddress,
    amount,
    deadline
  }, privateKey);
  
  console.log("ERC-20 purchase signature:", signature);
  
  // Sign fiat purchase
  const fiatParams = {
    messageId,
    creator: "0x742d35Cc6634C0532925a3b8D0C4C4C4C4C4C4C4C",
    amount,
    web2UserId: ethers.keccak256(ethers.toUtf8Bytes("user-123")),
    validationHash: ethers.keccak256(ethers.toUtf8Bytes("validation-data")),
    deadline
  };
  
  const fiatSignature = await signFiatPurchase(fiatParams, privateKey);
  console.log("Fiat purchase signature:", fiatSignature);
  
  // Validate parameters
  console.log("ERC-20 parameters valid:", validatePurchaseParams({
    messageId,
    seller,
    token: tokenAddress,
    amount,
    deadline
  }));
  
  console.log("Fiat parameters valid:", validateFiatPurchaseParams(fiatParams));
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}
