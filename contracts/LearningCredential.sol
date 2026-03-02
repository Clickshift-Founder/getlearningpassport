// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
/**
 * @title LearningCredential
 * @author Global Exchange Tour
 * @notice Soulbound (non-transferable) NFT representing verified learning credentials
 * @dev Each credential attests that a child completed a specific tour, earned a badge,
 *      or achieved a learning milestone. These credentials are OWNED by the child
 *      and cannot be transferred, sold, or revoked — creating a permanent,
 *      verifiable educational identity.
 *
 *      UNICEF Alignment: Verifiable proofs of impact, child-owned data,
 *      transparent credential issuance on immutable public ledger.
 */
contract LearningCredential is ERC721, ERC721URIStorage, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    uint256 private _nextTokenId;

    // =========== Credential Types ===========
    enum CredentialType {
        TOUR_COMPLETION,    // Completed a virtual tour
        BADGE_EARNED,       // Earned a specific badge (Explorer, Adventurer, etc.)
        SKILL_ATTESTATION,  // Demonstrated a specific skill
        SCHOLARSHIP_RECIPIENT, // Received scholarship funding
        TOP_PERFORMER       // Leaderboard recognition
    }

    // =========== Credential Data ===========
    struct Credential {
        CredentialType credentialType;
        string tourId;          // e.g., "WINTER-2025-DEC"
        string achievement;     // e.g., "Globetrotter Badge", "Tour Completion"
        uint256 gxpEarned;      // GXP points associated with this credential
        uint256 issuedAt;       // Timestamp of issuance
        string metadataHash;    // IPFS hash of detailed metadata (privacy-preserving)
    }

    // =========== Storage ===========
    mapping(uint256 => Credential) public credentials;
    mapping(address => uint256[]) public holderCredentials;

    // Prevent duplicate credentials (holder + tourId + type = unique)
    mapping(bytes32 => bool) public credentialExists;

    // =========== Impact Metrics (publicly readable) ===========
    uint256 public totalCredentialsIssued;
    uint256 public totalUniqueHolders;
    mapping(string => uint256) public credentialsByTour;   // tourId => count
    mapping(address => bool) private _isHolder;

    // =========== Events ===========
    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed holder,
        CredentialType credentialType,
        string tourId,
        string achievement,
        uint256 gxpEarned,
        uint256 timestamp
    );

    event ImpactMilestone(
        string milestone,
        uint256 totalCredentials,
        uint256 totalHolders,
        uint256 timestamp
    );

    // =========== Constructor ===========
    constructor() ERC721("GET Learning Credential", "GETLC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    // =========== Core Functions ===========

    /**
     * @notice Issue a new learning credential to a child's wallet
     * @param to The child's wallet address (pseudonymous — no PII on-chain)
     * @param credentialType Type of credential being issued
     * @param tourId Identifier for the tour (e.g., "WINTER-2025-DEC")
     * @param achievement Description of the achievement
     * @param gxpEarned GXP points earned with this credential
     * @param metadataHash IPFS hash containing detailed (private) metadata
     * @param uri Token URI pointing to credential metadata JSON
     */
    function issueCredential(
        address to,
        CredentialType credentialType,
        string memory tourId,
        string memory achievement,
        uint256 gxpEarned,
        string memory metadataHash,
        string memory uri
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        // Prevent duplicate credentials
        bytes32 uniqueKey = keccak256(abi.encodePacked(to, tourId, credentialType));
        require(!credentialExists[uniqueKey], "Credential already issued");

        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        // Mint the soulbound NFT
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        // Store credential data on-chain
        credentials[tokenId] = Credential({
            credentialType: credentialType,
            tourId: tourId,
            achievement: achievement,
            gxpEarned: gxpEarned,
            issuedAt: block.timestamp,
            metadataHash: metadataHash
        });

        // Track holder's credentials
        holderCredentials[to].push(tokenId);
        credentialExists[uniqueKey] = true;

        // Update impact metrics
        totalCredentialsIssued++;
        credentialsByTour[tourId]++;

        if (!_isHolder[to]) {
            _isHolder[to] = true;
            totalUniqueHolders++;
        }

        emit CredentialIssued(
            tokenId, to, credentialType, tourId,
            achievement, gxpEarned, block.timestamp
        );

        // Emit milestones for transparency dashboard
        if (totalCredentialsIssued % 100 == 0) {
            emit ImpactMilestone(
                string(abi.encodePacked("Reached ", _toString(totalCredentialsIssued), " credentials")),
                totalCredentialsIssued,
                totalUniqueHolders,
                block.timestamp
            );
        }

        return tokenId;
    }

    /**
     * @notice Batch issue credentials (gas-efficient for post-tour issuance)
     * @dev Issues credentials to multiple children after a tour completes
     */
    function batchIssueCredentials(
        address[] calldata recipients,
        CredentialType credentialType,
        string calldata tourId,
        string calldata achievement,
        uint256[] calldata gxpAmounts,
        string[] calldata metadataHashes,
        string[] calldata uris
    ) external onlyRole(ISSUER_ROLE) {
        require(
            recipients.length == gxpAmounts.length &&
            recipients.length == metadataHashes.length &&
            recipients.length == uris.length,
            "Array length mismatch"
        );
        require(recipients.length <= 100, "Max 100 per batch");

        for (uint256 i = 0; i < recipients.length; i++) {
            bytes32 uniqueKey = keccak256(
                abi.encodePacked(recipients[i], tourId, credentialType)
            );
            if (!credentialExists[uniqueKey]) {
                _nextTokenId++;
                uint256 tokenId = _nextTokenId;

                _safeMint(recipients[i], tokenId);
                _setTokenURI(tokenId, uris[i]);

                credentials[tokenId] = Credential({
                    credentialType: credentialType,
                    tourId: tourId,
                    achievement: achievement,
                    gxpEarned: gxpAmounts[i],
                    issuedAt: block.timestamp,
                    metadataHash: metadataHashes[i]
                });

                holderCredentials[recipients[i]].push(tokenId);
                credentialExists[uniqueKey] = true;
                totalCredentialsIssued++;
                credentialsByTour[tourId]++;

                if (!_isHolder[recipients[i]]) {
                    _isHolder[recipients[i]] = true;
                    totalUniqueHolders++;
                }

                emit CredentialIssued(
                    tokenId, recipients[i], credentialType,
                    tourId, achievement, gxpAmounts[i], block.timestamp
                );
            }
        }
    }

    // =========== View Functions ===========

    /**
     * @notice Get all credential token IDs for a specific holder
     * @param holder The wallet address to query
     */
    function getHolderCredentials(address holder) external view returns (uint256[] memory) {
        return holderCredentials[holder];
    }

    /**
     * @notice Verify a credential's authenticity and details
     * @param tokenId The credential token ID to verify
     */
    function verifyCredential(uint256 tokenId) external view returns (
        address holder,
        CredentialType credentialType,
        string memory tourId,
        string memory achievement,
        uint256 gxpEarned,
        uint256 issuedAt,
        bool isValid
    ) {
        require(tokenId <= _nextTokenId && tokenId > 0, "Invalid token ID");
        Credential memory cred = credentials[tokenId];
        address owner = ownerOf(tokenId);
        return (
            owner,
            cred.credentialType,
            cred.tourId,
            cred.achievement,
            cred.gxpEarned,
            cred.issuedAt,
            true
        );
    }

    /**
     * @notice Get impact metrics for transparency dashboard
     */
    function getImpactMetrics() external view returns (
        uint256 _totalCredentials,
        uint256 _totalHolders,
        uint256 _currentTokenId
    ) {
        return (totalCredentialsIssued, totalUniqueHolders, _nextTokenId);
    }

    // =========== SOULBOUND: Prevent Transfers ===========

    /**
     * @dev Override to make tokens non-transferable (soulbound)
     *      Tokens can only be minted, never transferred or sold.
     *      This ensures credentials are permanently tied to the child.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)) but block all transfers
        if (from != address(0) && to != address(0)) {
            revert("LearningCredential: Soulbound - transfers disabled");
        }
        return super._update(to, tokenId, auth);
    }

    // =========== Required Overrides ===========

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // =========== Internal Helpers ===========

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
