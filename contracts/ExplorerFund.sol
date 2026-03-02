// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ExplorerFund
 * @author Global Exchange Tour
 * @notice Transparent scholarship fund for underserved children.
 *         Manages donations, milestone-based grant releases, and
 *         scholarship disbursements — all publicly auditable on-chain.
 *
 *         UNICEF Alignment: Milestone-based escrow, transparent fund
 *         management, impact tokenization, verifiable proof of impact,
 *         financial inclusion for underserved communities.
 *
 *         How it works:
 *         1. Donors (UNICEF, individuals, corporates) deposit funds
 *         2. GET defines milestones (e.g., "onboard 500 children")
 *         3. Verifiers confirm milestones are met
 *         4. Funds release automatically per milestone schedule
 *         5. Scholarships are awarded to verified recipients
 *         6. Everything is publicly auditable
 */
contract ExplorerFund is AccessControl, ReentrancyGuard {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // =========== Milestone System ===========
    enum MilestoneStatus { PENDING, SUBMITTED, VERIFIED, RELEASED, REJECTED }

    struct Milestone {
        string description;        // e.g., "Onboard 500 children from underserved communities"
        uint256 fundAmount;         // Amount to release upon completion (in wei)
        MilestoneStatus status;
        uint256 targetDate;         // Expected completion date
        uint256 completedDate;      // Actual completion date
        string proofHash;           // IPFS hash of proof documentation
        address verifiedBy;         // Address of the verifier who approved
    }

    // =========== Scholarship System ===========
    enum ScholarshipStatus { AVAILABLE, AWARDED, REDEEMED, EXPIRED }

    struct Scholarship {
        address recipient;          // Child's wallet (pseudonymous)
        uint256 amount;             // Scholarship value in wei
        string tourId;              // Which tour this scholarship is for
        string schoolId;            // School identifier
        ScholarshipStatus status;
        uint256 awardedAt;
        uint256 redeemedAt;
    }

    // =========== Storage ===========
    Milestone[] public milestones;
    Scholarship[] public scholarships;

    // Fund tracking
    uint256 public totalDonations;
    uint256 public totalReleased;
    uint256 public totalScholarshipsAwarded;
    uint256 public totalScholarshipsRedeemed;
    uint256 public scholarshipPoolBalance;

    // Donor tracking (for transparency)
    struct Donation {
        address donor;
        uint256 amount;
        uint256 timestamp;
        string message;  // Optional donation message
    }
    Donation[] public donations;
    mapping(address => uint256) public donorTotalContributions;

    // =========== Events ===========
    event DonationReceived(
        address indexed donor,
        uint256 amount,
        uint256 totalDonations,
        string message,
        uint256 timestamp
    );

    event MilestoneCreated(
        uint256 indexed milestoneId,
        string description,
        uint256 fundAmount,
        uint256 targetDate
    );

    event MilestoneSubmitted(
        uint256 indexed milestoneId,
        string proofHash,
        uint256 timestamp
    );

    event MilestoneVerified(
        uint256 indexed milestoneId,
        address indexed verifier,
        uint256 fundAmount,
        uint256 timestamp
    );

    event FundsReleased(
        uint256 indexed milestoneId,
        uint256 amount,
        address indexed recipient,
        uint256 timestamp
    );

    event ScholarshipAwarded(
        uint256 indexed scholarshipId,
        address indexed recipient,
        uint256 amount,
        string tourId,
        string schoolId,
        uint256 timestamp
    );

    event ScholarshipRedeemed(
        uint256 indexed scholarshipId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    // =========== Constructor ===========
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // =========== Donation Functions ===========

    /**
     * @notice Donate to the Explorer Fund
     * @param message Optional message from the donor
     */
    function donate(string calldata message) external payable nonReentrant {
        require(msg.value > 0, "Donation must be greater than 0");

        donations.push(Donation({
            donor: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            message: message
        }));

        totalDonations += msg.value;
        donorTotalContributions[msg.sender] += msg.value;
        scholarshipPoolBalance += msg.value;

        emit DonationReceived(
            msg.sender,
            msg.value,
            totalDonations,
            message,
            block.timestamp
        );
    }

    /**
     * @notice Receive direct ETH/MATIC transfers as donations
     */
    receive() external payable {
        totalDonations += msg.value;
        donorTotalContributions[msg.sender] += msg.value;
        scholarshipPoolBalance += msg.value;

        donations.push(Donation({
            donor: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            message: ""
        }));

        emit DonationReceived(msg.sender, msg.value, totalDonations, "", block.timestamp);
    }

    // =========== Milestone Functions ===========

    /**
     * @notice Create a new milestone for fund release
     * @param description What needs to be achieved
     * @param fundAmount How much to release on completion
     * @param targetDate When the milestone should be completed
     */
    function createMilestone(
        string calldata description,
        uint256 fundAmount,
        uint256 targetDate
    ) external onlyRole(ADMIN_ROLE) {
        uint256 milestoneId = milestones.length;

        milestones.push(Milestone({
            description: description,
            fundAmount: fundAmount,
            status: MilestoneStatus.PENDING,
            targetDate: targetDate,
            completedDate: 0,
            proofHash: "",
            verifiedBy: address(0)
        }));

        emit MilestoneCreated(milestoneId, description, fundAmount, targetDate);
    }

    /**
     * @notice Submit proof that a milestone has been completed
     * @param milestoneId The milestone to submit proof for
     * @param proofHash IPFS hash of the proof documentation
     */
    function submitMilestoneProof(
        uint256 milestoneId,
        string calldata proofHash
    ) external onlyRole(ADMIN_ROLE) {
        require(milestoneId < milestones.length, "Invalid milestone");
        Milestone storage m = milestones[milestoneId];
        require(m.status == MilestoneStatus.PENDING, "Milestone not pending");

        m.status = MilestoneStatus.SUBMITTED;
        m.proofHash = proofHash;
        m.completedDate = block.timestamp;

        emit MilestoneSubmitted(milestoneId, proofHash, block.timestamp);
    }

    /**
     * @notice Verify a milestone and release funds (UNICEF/verifier role)
     * @param milestoneId The milestone to verify
     * @param recipient Where to send the released funds
     */
    function verifyAndReleaseMilestone(
        uint256 milestoneId,
        address payable recipient
    ) external onlyRole(VERIFIER_ROLE) nonReentrant {
        require(milestoneId < milestones.length, "Invalid milestone");
        Milestone storage m = milestones[milestoneId];
        require(m.status == MilestoneStatus.SUBMITTED, "Milestone not submitted");
        require(address(this).balance >= m.fundAmount, "Insufficient fund balance");

        m.status = MilestoneStatus.VERIFIED;
        m.verifiedBy = msg.sender;
        totalReleased += m.fundAmount;

        // Release funds
        (bool success, ) = recipient.call{value: m.fundAmount}("");
        require(success, "Fund transfer failed");

        m.status = MilestoneStatus.RELEASED;

        emit MilestoneVerified(milestoneId, msg.sender, m.fundAmount, block.timestamp);
        emit FundsReleased(milestoneId, m.fundAmount, recipient, block.timestamp);
    }

    // =========== Scholarship Functions ===========

    /**
     * @notice Award a scholarship to a child
     * @param recipient Child's wallet address
     * @param amount Scholarship amount in wei
     * @param tourId Tour the scholarship is for
     * @param schoolId School identifier
     */
    function awardScholarship(
        address recipient,
        uint256 amount,
        string calldata tourId,
        string calldata schoolId
    ) external onlyRole(ADMIN_ROLE) {
        require(scholarshipPoolBalance >= amount, "Insufficient scholarship pool");
        require(recipient != address(0), "Invalid recipient");

        uint256 scholarshipId = scholarships.length;
        scholarshipPoolBalance -= amount;

        scholarships.push(Scholarship({
            recipient: recipient,
            amount: amount,
            tourId: tourId,
            schoolId: schoolId,
            status: ScholarshipStatus.AWARDED,
            awardedAt: block.timestamp,
            redeemedAt: 0
        }));

        totalScholarshipsAwarded++;

        emit ScholarshipAwarded(
            scholarshipId, recipient, amount,
            tourId, schoolId, block.timestamp
        );
    }

    /**
     * @notice Redeem a scholarship (GET receives payment, child gets access)
     * @param scholarshipId The scholarship to redeem
     * @param getWallet GET's operational wallet to receive the funds
     */
    function redeemScholarship(
        uint256 scholarshipId,
        address payable getWallet
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(scholarshipId < scholarships.length, "Invalid scholarship");
        Scholarship storage s = scholarships[scholarshipId];
        require(s.status == ScholarshipStatus.AWARDED, "Not redeemable");
        require(address(this).balance >= s.amount, "Insufficient balance");

        s.status = ScholarshipStatus.REDEEMED;
        s.redeemedAt = block.timestamp;
        totalScholarshipsRedeemed++;

        // Pay GET for the child's tour access
        (bool success, ) = getWallet.call{value: s.amount}("");
        require(success, "Redemption transfer failed");

        emit ScholarshipRedeemed(scholarshipId, s.recipient, s.amount, block.timestamp);
    }

    // =========== View Functions (Transparency Dashboard) ===========

    /**
     * @notice Get complete fund transparency metrics
     */
    function getFundMetrics() external view returns (
        uint256 _totalDonations,
        uint256 _totalReleased,
        uint256 _currentBalance,
        uint256 _scholarshipPool,
        uint256 _totalScholarshipsAwarded,
        uint256 _totalScholarshipsRedeemed,
        uint256 _totalMilestones,
        uint256 _totalDonors
    ) {
        return (
            totalDonations,
            totalReleased,
            address(this).balance,
            scholarshipPoolBalance,
            totalScholarshipsAwarded,
            totalScholarshipsRedeemed,
            milestones.length,
            donations.length
        );
    }

    /**
     * @notice Get milestone details
     */
    function getMilestone(uint256 milestoneId) external view returns (Milestone memory) {
        require(milestoneId < milestones.length, "Invalid milestone");
        return milestones[milestoneId];
    }

    /**
     * @notice Get total milestone count
     */
    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    /**
     * @notice Get scholarship details
     */
    function getScholarship(uint256 scholarshipId) external view returns (Scholarship memory) {
        require(scholarshipId < scholarships.length, "Invalid scholarship");
        return scholarships[scholarshipId];
    }

    /**
     * @notice Get total scholarship count
     */
    function getScholarshipCount() external view returns (uint256) {
        return scholarships.length;
    }

    /**
     * @notice Get donation history (paginated)
     */
    function getDonations(uint256 offset, uint256 limit)
        external view returns (Donation[] memory)
    {
        uint256 end = offset + limit;
        if (end > donations.length) end = donations.length;
        if (offset >= donations.length) return new Donation[](0);

        Donation[] memory result = new Donation[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = donations[i];
        }
        return result;
    }
}
