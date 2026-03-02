const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("=".repeat(60));
  console.log("GET Learning Passport - Deployment Script");
  console.log("=".repeat(60));
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network:  ${hre.network.name}`);
  console.log(`Balance:  ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH/MATIC`);
  console.log("=".repeat(60));

  // 1. Deploy LearningCredential (Soulbound NFT)
  console.log("\n[1/3] Deploying LearningCredential (Soulbound NFT)...");
  const LearningCredential = await hre.ethers.getContractFactory("LearningCredential");
  const credential = await LearningCredential.deploy();
  await credential.waitForDeployment();
  const credentialAddr = await credential.getAddress();
  console.log(`  ✅ LearningCredential deployed to: ${credentialAddr}`);

  // 2. Deploy ExplorerFund (Scholarship + Escrow)
  console.log("\n[2/3] Deploying ExplorerFund (Scholarship + Milestone Escrow)...");
  const ExplorerFund = await hre.ethers.getContractFactory("ExplorerFund");
  const fund = await ExplorerFund.deploy();
  await fund.waitForDeployment();
  const fundAddr = await fund.getAddress();
  console.log(`  ✅ ExplorerFund deployed to: ${fundAddr}`);

  // 3. Deploy CommissionDistributor
  console.log("\n[3/3] Deploying CommissionDistributor...");
  const CommissionDistributor = await hre.ethers.getContractFactory("CommissionDistributor");
  const distributor = await CommissionDistributor.deploy(
    deployer.address,  // GET's wallet (deployer for demo)
    fundAddr           // Explorer Fund receives scholarship %
  );
  await distributor.waitForDeployment();
  const distributorAddr = await distributor.getAddress();
  console.log(`  ✅ CommissionDistributor deployed to: ${distributorAddr}`);

  // =========== DEMO: Seed with sample data ===========
  console.log("\n" + "=".repeat(60));
  console.log("SEEDING DEMO DATA...");
  console.log("=".repeat(60));

  // Add a school partner
  console.log("\n  Adding school partner: CORONASCHOOLS (10% commission)...");
  await distributor.addSchoolPartner(
    "CORONASCHOOLS",
    "Corona Schools Lagos",
    deployer.address,  // Using deployer as school wallet for demo
    1000               // 10% = 1000 basis points
  );
  console.log("  ✅ School partner added");

  // Add a referrer
  console.log("  Adding referrer: REF-FUNMI (5% commission)...");
  await distributor.addReferrer(
    "REF-FUNMI",
    deployer.address,  // Using deployer as referrer wallet for demo
    500                // 5% = 500 basis points
  );
  console.log("  ✅ Referrer added");

  // Create milestones in ExplorerFund
  console.log("\n  Creating milestones in ExplorerFund...");
  const oneMonth = 30 * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);

  await fund.createMilestone(
    "Onboard 500 children from underserved communities",
    hre.ethers.parseEther("0.5"),   // 0.5 MATIC for demo
    now + oneMonth * 3
  );

  await fund.createMilestone(
    "Issue 1000 verifiable learning credentials",
    hre.ethers.parseEther("0.3"),
    now + oneMonth * 6
  );

  await fund.createMilestone(
    "Partner with 5 schools in underserved areas",
    hre.ethers.parseEther("0.2"),
    now + oneMonth * 9
  );
  console.log("  ✅ 3 milestones created");

  // Issue sample credentials
  console.log("\n  Issuing sample learning credentials...");

  const sampleChildren = [
    { name: "Explorer-001", achievement: "Winter Tour Completion" },
    { name: "Explorer-002", achievement: "Winter Tour Completion" },
    { name: "Explorer-003", achievement: "Globetrotter Badge" },
  ];

  // Generate some pseudo addresses for demo
  for (let i = 0; i < sampleChildren.length; i++) {
    const wallet = hre.ethers.Wallet.createRandom();
    const child = sampleChildren[i];

    await credential.issueCredential(
      wallet.address,
      0, // TOUR_COMPLETION
      "WINTER-2025-DEC",
      child.achievement,
      i === 2 ? 200 : 100,  // GXP earned
      `QmSampleHash${i}`,    // Fake IPFS hash for demo
      `ipfs://QmSampleURI${i}`
    );
    console.log(`  ✅ Credential issued to ${wallet.address.slice(0, 10)}... — ${child.achievement}`);
  }

  // =========== SUMMARY ===========
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`
  Contract Addresses:
  -------------------
  LearningCredential:    ${credentialAddr}
  ExplorerFund:          ${fundAddr}
  CommissionDistributor: ${distributorAddr}

  Network: ${hre.network.name}

  Next Steps:
  1. Save these addresses to your .env file
  2. Verify contracts on Polygonscan (for Amoy testnet)
  3. Open the frontend demo at frontend/index.html
  4. Update CONTRACT_ADDRESSES in the frontend
  `);

  // Save addresses to a file for the frontend
  const fs = require("fs");
  const addresses = {
    network: hre.network.name,
    LearningCredential: credentialAddr,
    ExplorerFund: fundAddr,
    CommissionDistributor: distributorAddr,
    deployer: deployer.address,
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("  📁 Addresses saved to deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
