# 🌍 GET Learning Passport

### Blockchain-Powered Verifiable Learning Credentials for Children in Emerging Markets

> Built on **Polygon PoS** | Open Source (MIT License) | UNICEF Venture Fund Application

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org/)
[![Polygon](https://img.shields.io/badge/Network-Polygon%20Amoy-purple)](https://polygon.technology/)

---

## 🎯 What is GET Learning Passport?

**Global Exchange Tour (GET)** enables children in Africa to explore the world through virtual cultural immersion tours. The **GET Learning Passport** adds a blockchain layer to create:

- **🎓 Verifiable, child-owned learning credentials** — permanent, portable, and tamper-proof
- **💰 Transparent scholarship fund** — donor money is traceable from source to child impact
- **⚡ Automated commission distribution** — instant, auditable payments to school partners and referrers
- **📊 Public impact dashboard** — anyone can independently verify GET's real-world impact

Every credential, payment, and scholarship lives on Polygon's public blockchain — creating radical transparency for UNICEF, donors, schools, and parents.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                  GET Web Platform                     │
│           (Laravel/React — Existing Product)          │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────────┐  │
│  │ Zoom    │  │ Paystack │  │ MySQL/PostgreSQL    │  │
│  │ (Tours) │  │ (Fiat)   │  │ (Operational Data)  │  │
│  └────┬────┘  └────┬─────┘  └─────────┬───────────┘  │
│       │            │                  │               │
└───────┼────────────┼──────────────────┼───────────────┘
        │            │                  │
        ▼            ▼                  ▼
┌──────────────────────────────────────────────────────┐
│            🔗 Polygon Blockchain Layer                │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │ Learning        │  │ ExplorerFund             │   │
│  │ Credential      │  │ (Scholarship + Escrow)   │   │
│  │ (Soulbound NFT) │  │                          │   │
│  └─────────────────┘  └──────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────────┐  │
│  │ CommissionDistributor                           │  │
│  │ (Automated Payment Splitting)                   │  │
│  └─────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────┐
│         📊 Public Impact Dashboard                    │
│    (Anyone can verify GET's impact on-chain)          │
└──────────────────────────────────────────────────────┘
```

---

## 📦 Smart Contracts

| Contract | Description | Key Features |
|----------|-------------|-------------|
| `LearningCredential.sol` | Soulbound NFT for verified learning credentials | Non-transferable, batch issuance, duplicate prevention, impact metrics |
| `ExplorerFund.sol` | Transparent scholarship fund with milestone escrow | Donations, milestone lifecycle, scholarship awards, public metrics |
| `CommissionDistributor.sol` | Automated payment splitting | Instant school/referrer commissions, scholarship auto-contribution |

### Why Polygon?

- **Cost**: ~$0.001 per transaction (issuing a credential costs fractions of a cent)
- **Speed**: ~2 second block times
- **UNICEF Alignment**: UNICEF CryptoFund operates on Ethereum; Polygon is EVM-compatible
- **Grants**: Polygon Community Treasury allocates ~100M POL/year to builders
- **Ecosystem**: Largest EVM L2 developer ecosystem
- **Carbon Neutral**: Polygon is carbon-neutral (important for UNICEF ESG requirements)

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ 
- [Git](https://git-scm.com/)
- A code editor (VS Code recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/get-learning-passport.git
cd get-learning-passport

# Install dependencies
npm install

# Compile smart contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to local Hardhat node (for demo)
npx hardhat node                          # Terminal 1
npx hardhat run scripts/deploy.js --network localhost  # Terminal 2
```

### Deploy to Polygon Amoy Testnet

```bash
# 1. Create .env file
echo "PRIVATE_KEY=your_wallet_private_key_here" > .env
echo "POLYGONSCAN_API_KEY=your_polygonscan_api_key" >> .env

# 2. Get free Amoy testnet MATIC from faucet:
#    https://faucet.polygon.technology/

# 3. Deploy
npx hardhat run scripts/deploy.js --network polygon_amoy
```

---

## 🧪 Running Tests

```bash
# Run all tests
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run specific test
npx hardhat test --grep "soulbound"
```

### Test Coverage

- ✅ Credential issuance and verification
- ✅ Soulbound (non-transferable) enforcement
- ✅ Batch credential issuance
- ✅ Duplicate prevention
- ✅ Donation tracking
- ✅ Full milestone lifecycle (create → submit → verify → release)
- ✅ Scholarship award and redemption
- ✅ Commission distribution (school + referrer + scholarship)
- ✅ Full user journey integration test

---

## 👥 User Journey (Blockchain-Enhanced)

### For a Parent (Chioma)

1. **Registers** on GET platform (existing web flow)
2. **Pays** via Paystack → backend triggers `CommissionDistributor.processPayment()`
3. Smart contract **instantly splits** payment: GET (80%), School (10%), Scholarship Fund (5%), Referrer (5%)
4. Child **attends virtual tour** via Zoom (unchanged)
5. After tour, GET calls `LearningCredential.issueCredential()` → child receives permanent on-chain credential
6. Parent can **verify credential** on Polygonscan — proof their child participated
7. Parent shares **referral link** → earns commission on next referral (tracked on-chain)

### For a School (Mr. Okon)

1. GET registers school via `CommissionDistributor.addSchoolPartner()`
2. School distributes discount codes to parents
3. Every registration with school code → school **instantly receives commission** on-chain
4. School can **check earnings in real-time** on Polygonscan or impact dashboard
5. No waiting for monthly reconciliation — total transparency

### For UNICEF / Donors

1. UNICEF deposits grant funds into `ExplorerFund` contract
2. Milestones defined: "Onboard 500 underserved children" → Release $25K
3. GET submits proof → UNICEF verifies → Funds release automatically
4. Public dashboard shows: credentials issued, scholarships funded, geographic reach
5. **Every dollar traceable** from deposit to child impact — on immutable public ledger

### For an Underserved Child

1. School applies for scholarship slots
2. `ExplorerFund.awardScholarship()` → child receives scholarship NFT
3. Child participates in tour at **zero cost to their family**
4. Receives same verifiable credential as paid participants
5. Credential is **theirs forever** — even if GET shuts down

---

## 🛤️ Roadmap

| Phase | Timeline | Deliverables |
|-------|----------|-------------|
| **Phase 1: Foundation** | Months 1-3 | Deploy to Polygon Amoy testnet, audit smart contracts, open-source all code |
| **Phase 2: Pilot** | Months 4-6 | Issue 500+ credentials from live tour cohort, launch Explorer Scholarship Fund |
| **Phase 3: Scale** | Months 7-9 | 1,000+ credentials, 5+ school partners on-chain, cross-border payment pilot |
| **Phase 4: Ecosystem** | Months 10-12 | 2,500+ credentials, interoperable credential SDK, partner with 2+ African edtech platforms |

---

## 💰 Additional Funding Opportunities

Building on Polygon unlocks additional grant opportunities:

- **Polygon Community Grants**: ~100M POL/year for builders ([Apply](https://polygon.technology/grow))
- **Gitcoin Grants**: Quadratic funding for public goods
- **Ethereum Foundation Grants**: For open-source infrastructure
- **UNICEF CryptoFund**: Disbursement in ETH/USDC directly to project wallets

---

## 📄 License

This project is licensed under the **MIT License** — fully open source as required by UNICEF Venture Fund.

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📬 Contact

- **Website**: [getour.ng](https://getour.ng)
- **Email**: hello@getour.ng
- **Twitter**: [@globalexchangetour](https://twitter.com/globalexchangetour)

---

*Built with ❤️ for children in emerging markets. Supported by UNICEF Venture Fund.*
