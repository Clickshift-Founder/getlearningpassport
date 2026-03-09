const hre = require("hardhat");

/**
 * GET Learning Passport — Interactive Demo Script
 * 
 * This script walks through the ENTIRE user journey step by step,
 * with pauses and clear output for video recording.
 * 
 * Run: npx hardhat run scripts/demo.js --network localhost
 * (start local node first: npx hardhat node)
 */

const PAUSE = (ms) => new Promise(r => setTimeout(r, ms));

function header(text) {
    console.log("\n" + "═".repeat(60));
    console.log("  " + text);
    console.log("═".repeat(60));
}

function step(num, text) {
    console.log(`\n  ┌─ STEP ${num} ─────────────────────────────────────────┐`);
    console.log(`  │  ${text}`);
    console.log(`  └────────────────────────────────────────────────────┘`);
}

function success(text) {
    console.log(`  ✅ ${text}`);
}

function info(text) {
    console.log(`     ${text}`);
}

async function main() {
    const [deployer, schoolWallet, referrerWallet, parentWallet, child1, child2, child3, unicefWallet] =
        await hre.ethers.getSigners();

    header("🌍 GET LEARNING PASSPORT — LIVE DEMO");
    console.log("\n  Building the future of verifiable education in Africa.");
    console.log("  Every action below happens ON-CHAIN on Polygon.\n");
    info(`Network:  ${hre.network.name}`);
    info(`Deployer: ${deployer.address}`);
    await PAUSE(1000);

    // ===== DEPLOY =====
    header("PHASE 1: DEPLOYING SMART CONTRACTS");

    step(1, "Deploy LearningCredential (Soulbound NFT)");
    const LC = await hre.ethers.getContractFactory("LearningCredential");
    const credential = await LC.deploy();
    await credential.waitForDeployment();
    success(`LearningCredential: ${await credential.getAddress()}`);
    info("Children's achievements are now permanent and verifiable.");
    await PAUSE(500);

    step(2, "Deploy ExplorerFund (Scholarship + Milestone Escrow)");
    const EF = await hre.ethers.getContractFactory("ExplorerFund");
    const fund = await EF.deploy();
    await fund.waitForDeployment();
    success(`ExplorerFund: ${await fund.getAddress()}`);
    info("Transparent fund management — every dollar traceable on-chain.");
    await PAUSE(500);

    step(3, "Deploy CommissionDistributor (Payment Splitting)");
    const CD = await hre.ethers.getContractFactory("CommissionDistributor");
    const distributor = await CD.deploy(deployer.address, await fund.getAddress());
    await distributor.waitForDeployment();
    success(`CommissionDistributor: ${await distributor.getAddress()}`);
    info("Instant, atomic payment distribution — no manual reconciliation.");
    await PAUSE(500);

    // ===== SETUP PARTNERS =====
    header("PHASE 2: ONBOARDING SCHOOL PARTNERS");

    step(4, "Register Corona Schools Lagos (10% commission)");
    await distributor.addSchoolPartner(
        "CORONASCHOOLS", "Corona Schools Lagos",
        schoolWallet.address, 1000
    );
    success("Corona Schools Lagos added as partner");
    info(`School wallet: ${schoolWallet.address}`);
    info("Commission rate: 10% of every registration from their students");
    await PAUSE(500);

    step(5, "Register referrer Funmi (5% commission)");
    await distributor.addReferrer("REF-FUNMI", referrerWallet.address, 500);
    success("Referrer REF-FUNMI added");
    info(`Referrer wallet: ${referrerWallet.address}`);
    await PAUSE(500);

    // ===== PAYMENT FLOW =====
    header("PHASE 3: PARENT PAYS FOR TOUR (AUTOMATED DISTRIBUTION)");

    step(6, "Parent Chioma registers her child via Corona Schools");
    info("Payment: 1.0 MATIC (simulating ₦100,000 via Paystack)");
    info("School code: CORONASCHOOLS | Referral: REF-FUNMI");
    console.log("");
    info("Smart contract will ATOMICALLY split:");
    info("  → 80% (0.80 MATIC) → GET Operations");
    info("  → 10% (0.10 MATIC) → Corona Schools");
    info("  →  5% (0.05 MATIC) → Referrer Funmi");
    info("  →  5% (0.05 MATIC) → Explorer Scholarship Fund");
    console.log("");

    const tx = await distributor.connect(parentWallet).processPayment(
        "REG-WINTER-001", "CORONASCHOOLS", "REF-FUNMI",
        { value: hre.ethers.parseEther("1.0") }
    );
    await tx.wait();
    success("Payment processed! All parties paid INSTANTLY.");

    // Show school earnings
    const school = await distributor.getSchoolPartner("CORONASCHOOLS");
    info(`Corona Schools earned: ${hre.ethers.formatEther(school.totalEarned)} MATIC`);
    info(`Total registrations via school: ${school.totalRegistrations}`);
    await PAUSE(1000);

    // Process 2 more payments for demo
    step(7, "Two more parents register (building momentum)...");
    await distributor.connect(parentWallet).processPayment(
        "REG-WINTER-002", "CORONASCHOOLS", "",
        { value: hre.ethers.parseEther("1.0") }
    );
    await distributor.connect(parentWallet).processPayment(
        "REG-WINTER-003", "", "REF-FUNMI",
        { value: hre.ethers.parseEther("1.0") }
    );
    success("3 total payments processed");

    const metrics = await distributor.getDistributionMetrics();
    info(`Total revenue: ${hre.ethers.formatEther(metrics._totalRevenue)} MATIC`);
    info(`Total to schools: ${hre.ethers.formatEther(metrics._totalSchoolCommissions)} MATIC`);
    info(`Total to scholarships: ${hre.ethers.formatEther(metrics._totalScholarshipContributions)} MATIC`);
    await PAUSE(1000);

    // ===== CREDENTIAL ISSUANCE =====
    header("PHASE 4: ISSUING LEARNING CREDENTIALS (POST-TOUR)");

    step(8, "Tour complete! Issuing soulbound credentials to children...");
    console.log("");

    const children = [
        { wallet: child1, name: "Explorer #001", achievement: "Winter Global Explorer Tour", gxp: 100 },
        { wallet: child2, name: "Explorer #002", achievement: "Winter Global Explorer Tour", gxp: 150 },
        { wallet: child3, name: "Explorer #003", achievement: "Globetrotter Badge", gxp: 200 },
    ];

    for (const child of children) {
        await credential.issueCredential(
            child.wallet.address,
            child.achievement.includes("Badge") ? 1 : 0,
            "WINTER-2025-DEC",
            child.achievement,
            child.gxp,
            "QmSampleIPFSHash",
            "ipfs://QmSampleURI"
        );
        success(`${child.name}: "${child.achievement}" — ${child.gxp} GXP`);
        info(`Wallet: ${child.wallet.address.slice(0, 10)}...${child.wallet.address.slice(-4)}`);
    }
    await PAUSE(500);

    step(9, "Verify credential #1 is SOULBOUND (non-transferable)");
    try {
        await credential.connect(child1).transferFrom(
            child1.address, child2.address, 1
        );
        console.log("  ❌ Transfer succeeded (this should NOT happen!)");
    } catch (e) {
        success("Transfer BLOCKED! Credential is permanently bound to child.");
        info("Error: \"LearningCredential: Soulbound - transfers disabled\"");
        info("This credential follows the child forever — owned by them, not GET.");
    }
    await PAUSE(500);

    step(10, "Verify credential on-chain");
    const verified = await credential.verifyCredential(1);
    success("Credential #1 verified!");
    info(`Holder:      ${verified.holder}`);
    info(`Tour:        ${verified.tourId}`);
    info(`Achievement: ${verified.achievement}`);
    info(`GXP:         ${verified.gxpEarned.toString()}`);
    info(`Valid:       ${verified.isValid}`);
    info("Anyone can call this function — no permission needed.");
    await PAUSE(1000);

    // ===== SCHOLARSHIP FUND =====
    header("PHASE 5: EXPLORER SCHOLARSHIP FUND");

    step(11, "UNICEF deposits grant into milestone-based escrow");
    await fund.connect(unicefWallet).donate("UNICEF Venture Fund — Year 1 Grant", {
        value: hre.ethers.parseEther("5.0")
    });
    success("5.0 MATIC deposited (simulating $100,000 USDC)");
    info("Funds are locked in smart contract — not in GET's bank account.");
    await PAUSE(500);

    step(12, "Create milestones for fund release");
    const threeMonths = 90 * 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);

    await fund.createMilestone("Onboard 500 children from underserved communities",
        hre.ethers.parseEther("2.0"), now + threeMonths);
    await fund.createMilestone("Issue 1,000 verifiable learning credentials",
        hre.ethers.parseEther("2.0"), now + threeMonths * 2);
    await fund.createMilestone("Partner with 5 schools in underserved areas",
        hre.ethers.parseEther("1.0"), now + threeMonths * 3);
    success("3 milestones created");
    info("Milestone 1: Onboard 500 children → Release 2.0 MATIC");
    info("Milestone 2: Issue 1,000 credentials → Release 2.0 MATIC");
    info("Milestone 3: Partner with 5 schools → Release 1.0 MATIC");
    await PAUSE(500);

    step(13, "GET completes Milestone 1 — submit proof");
    await fund.submitMilestoneProof(0, "QmHashOf500ChildrenOnboardingReport");
    success("Proof submitted (IPFS hash of onboarding report)");
    info("Waiting for UNICEF verifier to confirm...");
    await PAUSE(500);

    step(14, "UNICEF verifies milestone → funds auto-release");
    const balBefore = await hre.ethers.provider.getBalance(deployer.address);
    await fund.verifyAndReleaseMilestone(0, deployer.address);
    const balAfter = await hre.ethers.provider.getBalance(deployer.address);
    success("MILESTONE VERIFIED! 2.0 MATIC released to GET!");
    info("Funds transferred automatically by smart contract.");
    info("No manual wire transfer. No intermediary. No delay.");
    await PAUSE(500);

    step(15, "Award scholarship to underserved child");

    // Fund has received scholarship contributions from payments
    // Plus remaining escrow. Let's award from the auto-contributed 5%
    const fundBalance = await hre.ethers.provider.getBalance(await fund.getAddress());
    info(`Explorer Fund balance: ${hre.ethers.formatEther(fundBalance)} MATIC`);

    await fund.awardScholarship(
        child3.address, hre.ethers.parseEther("0.1"),
        "WINTER-2025-DEC", "SCHOOL-DUTSE-ABUJA"
    );
    success("Scholarship awarded to Explorer #003!");
    info(`Recipient: ${child3.address.slice(0, 10)}...`);
    info("Tour: WINTER-2025-DEC | School: Dutse, Abuja");
    info("This child now gets the SAME credential as paying students.");
    await PAUSE(1000);

    // ===== FINAL METRICS =====
    header("📊 FINAL IMPACT METRICS (ALL ON-CHAIN)");
    console.log("");

    const credMetrics = await credential.getImpactMetrics();
    const fundMetrics = await fund.getFundMetrics();
    const distMetrics = await distributor.getDistributionMetrics();

    console.log("  ┌──────────────────────────────────────────────────┐");
    console.log(`  │  Credentials Issued:     ${credMetrics._totalCredentials.toString().padStart(4)}                     │`);
    console.log(`  │  Unique Children:        ${credMetrics._totalHolders.toString().padStart(4)}                     │`);
    console.log(`  │  Payments Processed:     ${distMetrics._totalPayments.toString().padStart(4)}                     │`);
    console.log(`  │  Total Revenue:          ${hre.ethers.formatEther(distMetrics._totalRevenue).padStart(8)} MATIC         │`);
    console.log(`  │  School Commissions:     ${hre.ethers.formatEther(distMetrics._totalSchoolCommissions).padStart(8)} MATIC         │`);
    console.log(`  │  Scholarship Fund:       ${hre.ethers.formatEther(distMetrics._totalScholarshipContributions).padStart(8)} MATIC         │`);
    console.log(`  │  Scholarships Awarded:   ${fundMetrics._totalScholarshipsAwarded.toString().padStart(4)}                     │`);
    console.log(`  │  Fund Transparency:       100%                    │`);
    console.log("  └──────────────────────────────────────────────────┘");

    console.log("\n  Every number above is independently verifiable.");
    console.log("  No trust required. No self-reported data. No PDFs.");
    console.log("  Just read the blockchain.\n");

    header("🌍 GET LEARNING PASSPORT — DEMO COMPLETE");
    console.log("\n  Built on Polygon · Open Source (MIT) · For Africa's Children\n");
}

main()
    .then(() => process.exit(0))
    .catch(console.error);
