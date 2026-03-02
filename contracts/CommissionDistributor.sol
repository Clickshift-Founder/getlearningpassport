// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CommissionDistributor
 * @author Global Exchange Tour
 * @notice Automates transparent payment splitting between GET, schools,
 *         referrers, and the Explorer Scholarship Fund.
 *
 *         When a parent pays, the smart contract instantly and atomically
 *         distributes funds according to pre-set rules — eliminating manual
 *         commission tracking, reconciliation errors, and payment delays.
 *
 *         UNICEF Alignment: Reducing operational costs through automation,
 *         transparent financial flows, disintermediation of manual processes.
 */
contract CommissionDistributor is AccessControl, ReentrancyGuard {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // =========== Configuration ===========
    address payable public getWallet;          // GET's operational wallet
    address payable public explorerFundWallet;  // Explorer Scholarship Fund

    uint256 public scholarshipBps = 500;        // 5% to scholarship (basis points)
    uint256 public constant MAX_BPS = 10000;

    // =========== School Partners ===========
    struct SchoolPartner {
        string name;
        address payable wallet;
        uint256 commissionBps;       // Commission rate in basis points (1000 = 10%)
        bool isActive;
        uint256 totalEarned;
        uint256 totalRegistrations;
    }

    mapping(string => SchoolPartner) public schoolPartners;   // schoolCode => SchoolPartner
    string[] public schoolCodes;

    // =========== Referrer Partners ===========
    struct Referrer {
        address payable wallet;
        uint256 commissionBps;       // Default: 500 (5%)
        uint256 totalEarned;
        uint256 totalReferrals;
    }

    mapping(string => Referrer) public referrers;   // referralCode => Referrer
    string[] public referralCodes;

    // =========== Payment Records ===========
    struct PaymentRecord {
        address payer;
        uint256 totalAmount;
        uint256 getShare;
        uint256 schoolShare;
        uint256 referrerShare;
        uint256 scholarshipShare;
        string schoolCode;
        string referralCode;
        string registrationId;
        uint256 timestamp;
    }

    PaymentRecord[] public paymentRecords;

    // =========== Metrics ===========
    uint256 public totalPaymentsProcessed;
    uint256 public totalRevenue;
    uint256 public totalSchoolCommissions;
    uint256 public totalReferrerCommissions;
    uint256 public totalScholarshipContributions;

    // =========== Events ===========
    event PaymentProcessed(
        uint256 indexed paymentId,
        address indexed payer,
        uint256 totalAmount,
        uint256 getShare,
        uint256 schoolShare,
        uint256 referrerShare,
        uint256 scholarshipShare,
        string registrationId,
        uint256 timestamp
    );

    event SchoolPartnerAdded(string indexed schoolCode, string name, address wallet, uint256 commissionBps);
    event ReferrerAdded(string indexed referralCode, address wallet, uint256 commissionBps);
    event SchoolCommissionPaid(string indexed schoolCode, uint256 amount, uint256 timestamp);
    event ReferrerCommissionPaid(string indexed referralCode, uint256 amount, uint256 timestamp);

    // =========== Constructor ===========
    constructor(address payable _getWallet, address payable _explorerFundWallet) {
        require(_getWallet != address(0), "Invalid GET wallet");
        require(_explorerFundWallet != address(0), "Invalid fund wallet");

        getWallet = _getWallet;
        explorerFundWallet = _explorerFundWallet;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // =========== Partner Management ===========

    /**
     * @notice Register a school partner
     * @param schoolCode Unique code for the school (e.g., "CORONASCHOOLS")
     * @param name Display name of the school
     * @param wallet School's payment wallet
     * @param commissionBps Commission rate in basis points (1000 = 10%)
     */
    function addSchoolPartner(
        string calldata schoolCode,
        string calldata name,
        address payable wallet,
        uint256 commissionBps
    ) external onlyRole(ADMIN_ROLE) {
        require(wallet != address(0), "Invalid wallet");
        require(commissionBps <= 2000, "Commission too high (max 20%)");
        require(!schoolPartners[schoolCode].isActive, "School already exists");

        schoolPartners[schoolCode] = SchoolPartner({
            name: name,
            wallet: wallet,
            commissionBps: commissionBps,
            isActive: true,
            totalEarned: 0,
            totalRegistrations: 0
        });

        schoolCodes.push(schoolCode);
        emit SchoolPartnerAdded(schoolCode, name, wallet, commissionBps);
    }

    /**
     * @notice Register a referrer
     * @param referralCode Unique referral code
     * @param wallet Referrer's payment wallet
     * @param commissionBps Commission rate in basis points (500 = 5%)
     */
    function addReferrer(
        string calldata referralCode,
        address payable wallet,
        uint256 commissionBps
    ) external onlyRole(ADMIN_ROLE) {
        require(wallet != address(0), "Invalid wallet");
        require(commissionBps <= 1000, "Commission too high (max 10%)");

        referrers[referralCode] = Referrer({
            wallet: wallet,
            commissionBps: commissionBps,
            totalEarned: 0,
            totalReferrals: 0
        });

        referralCodes.push(referralCode);
        emit ReferrerAdded(referralCode, wallet, commissionBps);
    }

    // =========== Payment Processing ===========

    /**
     * @notice Process a registration payment with automatic commission distribution
     * @dev Called by GET's backend after successful Paystack payment
     *      OR directly by the payer via crypto payment
     *
     * @param registrationId Unique registration identifier
     * @param schoolCode School code (empty string if no school)
     * @param referralCode Referral code (empty string if no referral)
     */
    function processPayment(
        string calldata registrationId,
        string calldata schoolCode,
        string calldata referralCode
    ) external payable nonReentrant {
        require(msg.value > 0, "Payment must be greater than 0");

        uint256 totalAmount = msg.value;
        uint256 schoolShare = 0;
        uint256 referrerShare = 0;
        uint256 scholarshipShare = (totalAmount * scholarshipBps) / MAX_BPS;
        uint256 getShare = totalAmount - scholarshipShare;

        // Calculate school commission
        if (bytes(schoolCode).length > 0 && schoolPartners[schoolCode].isActive) {
            SchoolPartner storage school = schoolPartners[schoolCode];
            schoolShare = (totalAmount * school.commissionBps) / MAX_BPS;
            getShare -= schoolShare;
            school.totalEarned += schoolShare;
            school.totalRegistrations++;
        }

        // Calculate referrer commission
        if (bytes(referralCode).length > 0 && referrers[referralCode].wallet != address(0)) {
            Referrer storage referrer = referrers[referralCode];
            referrerShare = (totalAmount * referrer.commissionBps) / MAX_BPS;
            getShare -= referrerShare;
            referrer.totalEarned += referrerShare;
            referrer.totalReferrals++;
        }

        // ===== ATOMIC DISTRIBUTION =====

        // 1. Send to GET operational wallet
        (bool s1, ) = getWallet.call{value: getShare}("");
        require(s1, "GET payment failed");

        // 2. Send to school partner (if applicable)
        if (schoolShare > 0) {
            (bool s2, ) = schoolPartners[schoolCode].wallet.call{value: schoolShare}("");
            require(s2, "School payment failed");
            emit SchoolCommissionPaid(schoolCode, schoolShare, block.timestamp);
        }

        // 3. Send to referrer (if applicable)
        if (referrerShare > 0) {
            (bool s3, ) = referrers[referralCode].wallet.call{value: referrerShare}("");
            require(s3, "Referrer payment failed");
            emit ReferrerCommissionPaid(referralCode, referrerShare, block.timestamp);
        }

        // 4. Send to Explorer Scholarship Fund
        if (scholarshipShare > 0) {
            (bool s4, ) = explorerFundWallet.call{value: scholarshipShare}("");
            require(s4, "Scholarship fund payment failed");
        }

        // ===== RECORD KEEPING =====

        uint256 paymentId = paymentRecords.length;
        paymentRecords.push(PaymentRecord({
            payer: msg.sender,
            totalAmount: totalAmount,
            getShare: getShare,
            schoolShare: schoolShare,
            referrerShare: referrerShare,
            scholarshipShare: scholarshipShare,
            schoolCode: schoolCode,
            referralCode: referralCode,
            registrationId: registrationId,
            timestamp: block.timestamp
        }));

        totalPaymentsProcessed++;
        totalRevenue += totalAmount;
        totalSchoolCommissions += schoolShare;
        totalReferrerCommissions += referrerShare;
        totalScholarshipContributions += scholarshipShare;

        emit PaymentProcessed(
            paymentId, msg.sender, totalAmount,
            getShare, schoolShare, referrerShare, scholarshipShare,
            registrationId, block.timestamp
        );
    }

    // =========== View Functions ===========

    function getDistributionMetrics() external view returns (
        uint256 _totalPayments,
        uint256 _totalRevenue,
        uint256 _totalSchoolCommissions,
        uint256 _totalReferrerCommissions,
        uint256 _totalScholarshipContributions
    ) {
        return (
            totalPaymentsProcessed,
            totalRevenue,
            totalSchoolCommissions,
            totalReferrerCommissions,
            totalScholarshipContributions
        );
    }

    function getSchoolPartner(string calldata schoolCode)
        external view returns (SchoolPartner memory)
    {
        return schoolPartners[schoolCode];
    }

    function getPaymentRecord(uint256 paymentId)
        external view returns (PaymentRecord memory)
    {
        require(paymentId < paymentRecords.length, "Invalid payment ID");
        return paymentRecords[paymentId];
    }

    function getPaymentCount() external view returns (uint256) {
        return paymentRecords.length;
    }

    // =========== Admin Functions ===========

    function updateScholarshipRate(uint256 newBps) external onlyRole(ADMIN_ROLE) {
        require(newBps <= 1000, "Max 10%");
        scholarshipBps = newBps;
    }

    function updateGetWallet(address payable newWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newWallet != address(0), "Invalid wallet");
        getWallet = newWallet;
    }
}
