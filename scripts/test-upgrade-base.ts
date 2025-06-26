import { ethers, upgrades } from "hardhat";
import { MessageMarketplace, MessageMarketplaceV2 } from "../typechain-types";

interface Message {
    creator: string;
    price: bigint;
    expireAt: bigint;
}

interface Purchase {
    timestamp: bigint;
    price: bigint;
}

async function main() {
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    
    console.log("Deploying contracts with the account:", deployer.address);

    // Check if we have a second account for testing purchases
    const hasSecondAccount = signers.length > 1;
    const buyer = hasSecondAccount ? signers[1] : null;
    
    if (hasSecondAccount) {
        console.log("✅ Using second account for buyer:", buyer!.address);
    } else {
        console.log("⚠️  No second account available - will test upgrade without purchase");
        console.log("   Add PRIVATE_KEY_2 to .env file to test full purchase flow");
    }

    const MockERC20 = await ethers.getContractFactory("MockERC20");

    // Deploy Mock USDC first
    console.log("Deploying Mock USDC...");
    const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    await mockUSDC.waitForDeployment();
    const mockUSDCAddress = await mockUSDC.getAddress();
    console.log("Mock USDC deployed to:", mockUSDCAddress);

    // Deploy initial version
    console.log("Deploying MessageMarketplace V1...");
    const MessageMarketplace = await ethers.getContractFactory("MessageMarketplace");
    const marketplace = await upgrades.deployProxy(MessageMarketplace, [
        mockUSDCAddress,
        deployer.address, // system fee address
        500 // 5% fee (500 basis points)
    ], { initializer: 'initialize' }) as unknown as MessageMarketplace;
    
    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();
    console.log("MessageMarketplace V1 deployed to:", marketplaceAddress);

    // Create a test message with expiration (1 hour from now)
    const messageId = ethers.keccak256(ethers.toUtf8Bytes("Test Message"));
    const price = ethers.parseUnits("1", 6); // 1 USDC (6 decimals)
    const expireAt = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
    
    console.log("Creating test message with expiration...");
    const tx = await (marketplace as any).createMessage(messageId, price, expireAt);
    await tx.wait();
    console.log("Test message created with expiration at:", new Date(Number(expireAt) * 1000).toISOString());

    // Deploy V2
    console.log("\nDeploying MessageMarketplace V2...");
    const MessageMarketplaceV2 = await ethers.getContractFactory("MessageMarketplaceV2");
    const upgraded = await upgrades.upgradeProxy(marketplaceAddress, MessageMarketplaceV2) as unknown as MessageMarketplaceV2;
    const upgradedAddress = await upgraded.getAddress();
    console.log("MessageMarketplace upgraded to V2 at:", upgradedAddress);

    // Verify V2 functionality
    console.log("\nVerifying V2 functionality...");
    const totalSales = await upgraded.totalSales();
    console.log("Total sales before purchase:", totalSales.toString());

    // Test purchase logic based on available accounts
    if (hasSecondAccount && buyer) {
        // We have a second account - test full purchase flow
        console.log("\nTesting full purchase flow with second account...");
        
        // Mint USDC to buyer account
        console.log("Minting USDC to buyer account...");
        const mintAmount = ethers.parseUnits("100", 6); // 100 USDC
        const mintTx = await mockUSDC.mint(buyer.address, mintAmount);
        await mintTx.wait();
        console.log("Minted", ethers.formatUnits(mintAmount, 6), "USDC to buyer");
        
        // Approve USDC spending for buyer
        console.log("Approving USDC spending...");
        const approveTx = await mockUSDC.connect(buyer).approve(upgradedAddress, price);
        await approveTx.wait();
        console.log("USDC approval successful");

        // Purchase the message with buyer account
        try {
            console.log("Attempting to purchase message...");
            const purchaseTx = await upgraded.connect(buyer).purchaseMessage(messageId);
            await purchaseTx.wait();
            console.log("✅ Message purchased successfully!");
            
            const newTotalSales = await upgraded.totalSales();
            console.log("Total sales after purchase:", newTotalSales.toString());
            
            // Check if buyer has purchased the message
            const hasPurchased = await upgraded.hasPurchasedMessage(messageId, buyer.address);
            console.log("Buyer has purchased message:", hasPurchased);
            
            // Get purchase details
            const purchaseDetails = await (upgraded as any).getPurchaseDetails(messageId, buyer.address);
            console.log("Purchase timestamp:", new Date(Number(purchaseDetails.timestamp) * 1000).toISOString());
            console.log("Purchase price:", ethers.formatUnits(purchaseDetails.price, 6), "USDC");
            
            // Test duplicate purchase prevention
            console.log("Testing duplicate purchase prevention...");
            try {
                const duplicateTx = await upgraded.connect(buyer).purchaseMessage(messageId);
                await duplicateTx.wait();
                console.log("❌ ERROR: Should not have been able to purchase same message twice!");
            } catch (error) {
                console.log("✅ Correctly prevented duplicate purchase");
            }
            
        } catch (error) {
            console.log("❌ Purchase failed:", error instanceof Error ? error.message : String(error));
        }
        
        // Check balances
        const deployerBalance = await mockUSDC.balanceOf(deployer.address);
        const buyerBalance = await mockUSDC.balanceOf(buyer.address);
        console.log("\nBalances after purchase:");
        console.log("Deployer (creator) balance:", ethers.formatUnits(deployerBalance, 6), "USDC");
        console.log("Buyer balance:", ethers.formatUnits(buyerBalance, 6), "USDC");
        
    } else {
        // No second account - just test upgrade functionality
        console.log("\nTesting upgrade functionality (no purchase test)...");
        
        // Test that creator can't buy own message
        try {
            console.log("Testing purchase of own message (should fail)...");
            const purchaseTx = await upgraded.purchaseMessage(messageId);
            await purchaseTx.wait();
            console.log("❌ ERROR: Should not have been able to purchase own message!");
        } catch (error) {
            console.log("✅ Correctly prevented purchase of own message");
        }
    }

    // Verify the message still exists and data is preserved
    const message = await upgraded.getMessage(messageId);
    console.log("\nVerifying message data after upgrade:");
    console.log("Message creator:", message.creator);
    console.log("Message price:", ethers.formatUnits(message.price, 6), "USDC");
    console.log("Message expiration:", new Date(Number((message as any).expireAt) * 1000).toISOString());
    
    // Test the new messageExists function
    const messageExists = await marketplace.messageExists(messageId);
    console.log("Message exists:", messageExists);
    
    // Test expiration check
    const isExpired = await (upgraded as any).isMessageExpired(messageId);
    console.log("Message is expired:", isExpired);

    // Get marketplace statistics
    const stats = await upgraded.getMarketplaceStats();
    console.log("\nMarketplace Statistics:");
    console.log("Total Sales:", stats[0].toString());
    console.log("Total Volume:", ethers.formatUnits(stats[1], 6), "USDC");
    
    console.log("\n🎉 Upgrade test completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 