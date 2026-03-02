const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GET Learning Passport — Full Test Suite", function () {

  let credential, fund, distributor;
  let owner, school, referrer, parent, child1, child2, verifier;

  beforeEach(async function () {
    [owner, school, referrer, parent, child1, child2, verifier] = await ethers.getSigners();

    // Deploy LearningCredential
    const LC = await ethers.getContractFactory("LearningCredential");
    credential = await LC.deploy();
    await credential.waitForDeployment();

    // Deploy ExplorerFund
    const EF = await ethers.getContractFactory("ExplorerFund");
    fund = await EF.deploy();
    await fund.waitForDeployment();

    // Deploy CommissionDistributor
    const CD = await ethers.getContractFactory("CommissionDistributor");
    distributor = await CD.deploy(
      owner.address,
      await fund.getAddress()
    );
    await distributor.waitForDeployment();
  });

  // ==========================================
  // LEARNING CREDENTIAL TESTS
  // ==========================================
  describe("LearningCredential (Soulbound NFT)", function () {

    it("Should issue a credential and store on-chain data", async function () {
      const tx = await credential.issueCredential(
        child1.address,
        0, // TOUR_COMPLETION
        "WINTER-2025-DEC",
        "Winter Global Explorer Tour Completion",
        100,
        "QmTestHash123",
        "ipfs://QmTestURI123"
      );

      await tx.wait();

      // Verify credential data
      const cred = await credential.credentials(1);
      expect(cred.tourId).to.equal("WINTER-2025-DEC");
      expect(cred.achievement).to.equal("Winter Global Explorer Tour Completion");
      expect(cred.gxpEarned).to.equal(100);

      // Verify ownership
      expect(await credential.ownerOf(1)).to.equal(child1.address);

      // Verify metrics
      expect(await credential.totalCredentialsIssued()).to.equal(1);
      expect(await credential.totalUniqueHolders()).to.equal(1);
    });

    it("Should prevent duplicate credentials for same child+tour+type", async function () {
      await credential.issueCredential(
        child1.address, 0, "WINTER-2025-DEC",
        "Tour Completion", 100, "hash1", "uri1"
      );

      await expect(
        credential.issueCredential(
          child1.address, 0, "WINTER-2025-DEC",
          "Tour Completion", 100, "hash2", "uri2"
        )
      ).to.be.revertedWith("Credential already issued");
    });

    it("Should be SOULBOUND (non-transferable)", async function () {
      await credential.issueCredential(
        child1.address, 0, "WINTER-2025-DEC",
        "Tour Completion", 100, "hash1", "uri1"
      );

      // Attempt transfer should fail
      await expect(
        credential.connect(child1).transferFrom(child1.address, child2.address, 1)
      ).to.be.revertedWith("LearningCredential: Soulbound - transfers disabled");
    });

    it("Should batch issue credentials efficiently", async function () {
      const recipients = [child1.address, child2.address];
      const gxpAmounts = [100, 150];
      const hashes = ["hash1", "hash2"];
      const uris = ["uri1", "uri2"];

      await credential.batchIssueCredentials(
        recipients, 0, "WINTER-2025-DEC",
        "Tour Completion", gxpAmounts, hashes, uris
      );

      expect(await credential.totalCredentialsIssued()).to.equal(2);
      expect(await credential.totalUniqueHolders()).to.equal(2);
      expect(await credential.ownerOf(1)).to.equal(child1.address);
      expect(await credential.ownerOf(2)).to.equal(child2.address);
    });

    it("Should verify credentials correctly", async function () {
      await credential.issueCredential(
        child1.address, 0, "WINTER-2025-DEC",
        "Tour Completion", 100, "hash1", "uri1"
      );

      const [holder, credType, tourId, achievement, gxp, issuedAt, isValid] =
        await credential.verifyCredential(1);

      expect(holder).to.equal(child1.address);
      expect(tourId).to.equal("WINTER-2025-DEC");
      expect(isValid).to.be.true;
    });

    it("Should track per-tour credential counts", async function () {
      await credential.issueCredential(
        child1.address, 0, "WINTER-2025-DEC",
        "Tour Completion", 100, "h1", "u1"
      );
      await credential.issueCredential(
        child2.address, 0, "WINTER-2025-DEC",
        "Tour Completion", 100, "h2", "u2"
      );
      await credential.issueCredential(
        child1.address, 0, "SUMMER-2026-JUN",
        "Tour Completion", 150, "h3", "u3"
      );

      expect(await credential.credentialsByTour("WINTER-2025-DEC")).to.equal(2);
      expect(await credential.credentialsByTour("SUMMER-2026-JUN")).to.equal(1);
    });

    it("Should only allow ISSUER_ROLE to issue credentials", async function () {
      await expect(
        credential.connect(parent).issueCredential(
          child1.address, 0, "WINTER-2025-DEC",
          "Tour", 100, "hash", "uri"
        )
      ).to.be.reverted;
    });
  });

  // ==========================================
  // EXPLORER FUND TESTS
  // ==========================================
  describe("ExplorerFund (Scholarship + Milestone Escrow)", function () {

    it("Should accept donations with tracking", async function () {
      await fund.connect(parent).donate("For the children!", {
        value: ethers.parseEther("1.0")
      });

      expect(await fund.totalDonations()).to.equal(ethers.parseEther("1.0"));
      expect(await fund.donorTotalContributions(parent.address))
        .to.equal(ethers.parseEther("1.0"));
    });

    it("Should create and manage milestones", async function () {
      const futureDate = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

      await fund.createMilestone(
        "Onboard 500 children", ethers.parseEther("0.5"), futureDate
      );

      const milestone = await fund.getMilestone(0);
      expect(milestone.description).to.equal("Onboard 500 children");
      expect(milestone.status).to.equal(0); // PENDING
    });

    it("Should execute full milestone lifecycle: create → submit → verify → release", async function () {
      // Fund the contract
      await fund.connect(parent).donate("Grant funding", {
        value: ethers.parseEther("2.0")
      });

      // Create milestone
      const futureDate = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
      await fund.createMilestone(
        "Onboard 500 children", ethers.parseEther("0.5"), futureDate
      );

      // Submit proof
      await fund.submitMilestoneProof(0, "QmProofHash_500Children");
      let milestone = await fund.getMilestone(0);
      expect(milestone.status).to.equal(1); // SUBMITTED

      // Verify and release
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      await fund.verifyAndReleaseMilestone(0, owner.address);

      milestone = await fund.getMilestone(0);
      expect(milestone.status).to.equal(3); // RELEASED
      expect(await fund.totalReleased()).to.equal(ethers.parseEther("0.5"));
    });

    it("Should award and redeem scholarships", async function () {
      // Fund the scholarship pool
      await fund.connect(parent).donate("Scholarship donation", {
        value: ethers.parseEther("1.0")
      });

      // Award scholarship
      await fund.awardScholarship(
        child1.address,
        ethers.parseEther("0.1"),
        "WINTER-2025-DEC",
        "SCHOOL-ABUJA-001"
      );

      expect(await fund.totalScholarshipsAwarded()).to.equal(1);

      const scholarship = await fund.getScholarship(0);
      expect(scholarship.recipient).to.equal(child1.address);
      expect(scholarship.status).to.equal(1); // AWARDED

      // Redeem scholarship (GET receives the payment)
      await fund.redeemScholarship(0, owner.address);
      const redeemed = await fund.getScholarship(0);
      expect(redeemed.status).to.equal(2); // REDEEMED
    });

    it("Should prevent over-awarding from scholarship pool", async function () {
      await fund.connect(parent).donate("Small donation", {
        value: ethers.parseEther("0.05")
      });

      await expect(
        fund.awardScholarship(
          child1.address, ethers.parseEther("0.1"),
          "TOUR", "SCHOOL"
        )
      ).to.be.revertedWith("Insufficient scholarship pool");
    });

    it("Should return accurate fund metrics", async function () {
      await fund.connect(parent).donate("Test", { value: ethers.parseEther("1.0") });

      const metrics = await fund.getFundMetrics();
      expect(metrics._totalDonations).to.equal(ethers.parseEther("1.0"));
      expect(metrics._currentBalance).to.equal(ethers.parseEther("1.0"));
    });
  });

  // ==========================================
  // COMMISSION DISTRIBUTOR TESTS
  // ==========================================
  describe("CommissionDistributor (Automated Payment Splitting)", function () {

    it("Should process payment with correct distribution (no school/referral)", async function () {
      const fundAddr = await fund.getAddress();
      const amount = ethers.parseEther("1.0");

      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const fundBefore = await ethers.provider.getBalance(fundAddr);

      await distributor.connect(parent).processPayment(
        "REG-001", "", "", { value: amount }
      );

      // 5% should go to scholarship fund
      const fundAfter = await ethers.provider.getBalance(fundAddr);
      const scholarshipAmount = ethers.parseEther("0.05"); // 5%
      expect(fundAfter - fundBefore).to.equal(scholarshipAmount);

      // Check metrics
      expect(await distributor.totalPaymentsProcessed()).to.equal(1);
      expect(await distributor.totalRevenue()).to.equal(amount);
    });

    it("Should distribute to school partner correctly", async function () {
      // Add school partner (10% commission)
      await distributor.addSchoolPartner(
        "CORONA", "Corona Schools", school.address, 1000
      );

      const amount = ethers.parseEther("1.0");
      const schoolBefore = await ethers.provider.getBalance(school.address);

      await distributor.connect(parent).processPayment(
        "REG-002", "CORONA", "", { value: amount }
      );

      const schoolAfter = await ethers.provider.getBalance(school.address);
      const expectedCommission = ethers.parseEther("0.1"); // 10%
      expect(schoolAfter - schoolBefore).to.equal(expectedCommission);

      // Verify school partner tracking
      const partner = await distributor.getSchoolPartner("CORONA");
      expect(partner.totalEarned).to.equal(expectedCommission);
      expect(partner.totalRegistrations).to.equal(1);
    });

    it("Should distribute to both school AND referrer correctly", async function () {
      await distributor.addSchoolPartner(
        "CORONA", "Corona Schools", school.address, 1000  // 10%
      );
      await distributor.addReferrer(
        "REF-FUNMI", referrer.address, 500  // 5%
      );

      const amount = ethers.parseEther("1.0");
      const schoolBefore = await ethers.provider.getBalance(school.address);
      const referrerBefore = await ethers.provider.getBalance(referrer.address);

      await distributor.connect(parent).processPayment(
        "REG-003", "CORONA", "REF-FUNMI", { value: amount }
      );

      // School gets 10%
      expect(
        (await ethers.provider.getBalance(school.address)) - schoolBefore
      ).to.equal(ethers.parseEther("0.1"));

      // Referrer gets 5%
      expect(
        (await ethers.provider.getBalance(referrer.address)) - referrerBefore
      ).to.equal(ethers.parseEther("0.05"));

      // Scholarship fund gets 5%
      expect(await distributor.totalScholarshipContributions())
        .to.equal(ethers.parseEther("0.05"));

      // GET gets remaining 80%
      const record = await distributor.getPaymentRecord(0);
      expect(record.getShare).to.equal(ethers.parseEther("0.8"));
    });

    it("Should emit correct events for transparency tracking", async function () {
      await distributor.addSchoolPartner(
        "CORONA", "Corona Schools", school.address, 1000
      );

      await expect(
        distributor.connect(parent).processPayment(
          "REG-004", "CORONA", "", { value: ethers.parseEther("1.0") }
        )
      ).to.emit(distributor, "PaymentProcessed")
       .and.to.emit(distributor, "SchoolCommissionPaid");
    });

    it("Should return accurate distribution metrics", async function () {
      await distributor.addSchoolPartner("S1", "School 1", school.address, 1000);

      await distributor.connect(parent).processPayment(
        "R1", "S1", "", { value: ethers.parseEther("1.0") }
      );
      await distributor.connect(parent).processPayment(
        "R2", "S1", "", { value: ethers.parseEther("2.0") }
      );

      const metrics = await distributor.getDistributionMetrics();
      expect(metrics._totalPayments).to.equal(2);
      expect(metrics._totalRevenue).to.equal(ethers.parseEther("3.0"));
      expect(metrics._totalSchoolCommissions).to.equal(ethers.parseEther("0.3"));
      expect(metrics._totalScholarshipContributions).to.equal(ethers.parseEther("0.15"));
    });
  });

  // ==========================================
  // INTEGRATION TESTS
  // ==========================================
  describe("Integration: Full User Journey", function () {

    it("Complete journey: Payment → Credential → Scholarship → Impact Metrics", async function () {
      // Step 1: Parent pays via CommissionDistributor
      await distributor.addSchoolPartner("CORONA", "Corona Schools", school.address, 1000);

      await distributor.connect(parent).processPayment(
        "REG-WINTER-001", "CORONA", "", { value: ethers.parseEther("1.0") }
      );

      // Step 2: After tour, issue credential to child
      await credential.issueCredential(
        child1.address,
        0, // TOUR_COMPLETION
        "WINTER-2025-DEC",
        "Winter Global Explorer Tour",
        100,
        "QmProofOfCompletion",
        "ipfs://QmCredentialMetadata"
      );

      // Step 3: Donor contributes to scholarship fund
      await fund.connect(parent).donate("Help underserved children!", {
        value: ethers.parseEther("0.5")
      });

      // Step 4: Award scholarship to underserved child
      await fund.awardScholarship(
        child2.address,
        ethers.parseEther("0.1"),
        "WINTER-2025-DEC",
        "SCHOOL-DUTSE-ABUJA"
      );

      // Step 5: Verify all impact metrics
      const credMetrics = await credential.getImpactMetrics();
      expect(credMetrics._totalCredentials).to.equal(1);

      const fundMetrics = await fund.getFundMetrics();
      expect(fundMetrics._totalScholarshipsAwarded).to.equal(1);

      const distMetrics = await distributor.getDistributionMetrics();
      expect(distMetrics._totalPayments).to.equal(1);

      // Step 6: Verify credential is permanent and verifiable
      const verified = await credential.verifyCredential(1);
      expect(verified.isValid).to.be.true;
      expect(verified.holder).to.equal(child1.address);

      console.log("\n  ✅ FULL JOURNEY COMPLETE:");
      console.log("     - Parent paid: 1.0 MATIC");
      console.log("     - School earned: 0.1 MATIC (10%)");
      console.log("     - Scholarship fund: 0.05 MATIC (5%)");
      console.log("     - Credential issued to child");
      console.log("     - Scholarship awarded to underserved child");
      console.log("     - All metrics verifiable on-chain");
    });
  });
});
