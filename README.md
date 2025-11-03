# Massa Lending & Borrowing Platform

A complete decentralized lending and borrowing protocol built on the Massa blockchain with a modern React frontend.

## Project Overview

This project consists of two main components:
1. **Smart Contracts** - AssemblyScript contracts for the lending pool
2. **Frontend** - React + TypeScript web application

## Features

### Smart Contract Features
- ✅ Collateralized lending and borrowing
- ✅ Multi-asset support
- ✅ Dynamic interest rates based on utilization
- ✅ Automated liquidations
- ✅ Health factor monitoring
- ✅ Admin controls and parameter management

### Frontend Features
- ✅ Massa Wallet integration
- ✅ Real-time position tracking
- ✅ Deposit/withdraw collateral interface
- ✅ Borrow/repay interface
- ✅ Liquidation opportunities display
- ✅ Responsive, modern UI with Tailwind CSS

## Project Structure

```
massa-test-pro/
├── smartcontract/              # Smart contracts
│   ├── assembly/
│   │   ├── contracts/         # Main contracts
│   │   │   └── LendingPool.ts # Core lending pool (700+ lines)
│   │   ├── storage/           # Storage schemas
│   │   ├── structs/           # Data structures
│   │   ├── libraries/         # Helper libraries (SafeMath, InterestRateModel)
│   │   └── interfaces/        # Token interfaces
│   ├── build/                 # Compiled WASM files
│   └── LENDING_PLATFORM.md    # Detailed documentation
│
└── Front/                      # Frontend application
    ├── src/
    │   ├── components/        # React components
    │   ├── contexts/          # Wallet context
    │   ├── hooks/             # Custom hooks
    │   ├── types/             # TypeScript types
    │   └── utils/             # Utilities
    ├── dist/                  # Built production files
    └── README.md              # Frontend documentation
```

## Quick Start

### Prerequisites

- Node.js >= 16
- npm or yarn
- Massa Wallet Extension (for testnet)

### Smart Contracts

```bash
# Navigate to smart contract directory
cd smartcontract

# Install dependencies
npm install

# Build contracts
npm run build

# Deploy (configure .env first)
npm run deploy
```

The main contract will be compiled to `build/LendingPool.wasm`.

### Frontend

```bash
# Navigate to frontend directory
cd Front

# Install dependencies
npm install

# Update contract addresses in src/utils/constants.ts

# Start development server
npm run dev

# Build for production
npm run build
```

## Configuration

### Smart Contract Configuration

Default parameters in the lending pool:
- **Base Rate**: 2% APY
- **Optimal Utilization**: 80%
- **Collateral Factor**: 75% (max LTV)
- **Liquidation Threshold**: 80%
- **Liquidation Penalty**: 10%

### Frontend Configuration

Update `Front/src/utils/constants.ts`:

```typescript
export const LENDING_POOL_ADDRESS = 'AS1'; // deployed contract

export const DEFAULT_ASSETS = [
  {
    symbol: 'MAS',
    name: 'Massa',
    address: 'AS1...', // Token address
    decimals: 18,
  },
  // Add more assets...
];
```

## Key Concepts

### Health Factor

The health factor indicates position safety:
```
Health Factor = (Collateral Value × Liquidation Threshold) / Debt Value
```

- **> 1.5**: Safe (Green)
- **1.0 - 1.5**: Moderate (Yellow)
- **< 1.0**: Liquidatable (Red)

### Interest Rate Model

Two-slope model based on utilization:
```
if utilization ≤ optimal:
    rate = baseRate + (utilization × slope1 / optimal)
else:
    rate = baseRate + slope1 + ((utilization - optimal) × slope2 / (1 - optimal))
```

### Liquidations

- Triggered when Health Factor < 1.0
- Liquidators can repay up to 50% of debt
- Liquidators receive debt value + 10% bonus in collateral

## Usage Guide

### 1. Deposit Collateral

```typescript
// Frontend
1. Navigate to "Supply" tab
2. Select asset
3. Enter amount
4. Approve token spending
5. Confirm deposit
```

### 2. Borrow

```typescript
// Frontend
1. Navigate to "Borrow" tab
2. Select asset to borrow
3. Enter amount (up to 75% of collateral value)
4. Monitor health factor
5. Confirm borrow
```

### 3. Repay

```typescript
// Frontend
1. Navigate to "Borrow" tab → "Repay"
2. Select asset
3. Enter repay amount
4. Approve token spending
5. Confirm repayment
```

### 4. Liquidate

```typescript
// Frontend
1. Navigate to "Liquidate" tab
2. Browse unhealthy positions (HF < 1.0)
3. Select position to liquidate
4. Enter debt amount to repay
5. Receive collateral + 10% bonus
```

## Smart Contract Functions

### User Functions
- `depositCollateral(tokenAddress, amount)` - Deposit collateral
- `withdrawCollateral(tokenAddress, amount)` - Withdraw collateral
- `borrow(tokenAddress, amount)` - Borrow assets
- `repay(tokenAddress, amount)` - Repay debt
- `liquidate(borrower, collateralToken, debtToken, amount)` - Liquidate position

### View Functions
- `getUserCollateral(user, token)` - Get user's collateral
- `getUserDebt(user, token)` - Get user's debt with interest
- `getBorrowRate(token)` - Get current borrow APY

### Admin Functions (Owner Only)
- `addSupportedAsset(tokenAddress)` - Add supported asset
- `setAssetPrice(tokenAddress, price)` - Set asset price
- `setInterestRateParams(...)` - Update interest rate model
- `pause()` / `unpause()` - Emergency pause

## Development

### Running Tests

```bash
# Smart contracts
cd smartcontract
npm run test

# Frontend
cd Front
npm run dev
```

### Building for Production

```bash
# Smart contracts
cd smartcontract
npm run build

# Frontend
cd Front
npm run build
```

## Roadmap

### Phase 1 (Current)
- ✅ Core lending/borrowing functionality
- ✅ Basic frontend interface
- ✅ Liquidation mechanism

### Phase 2 (Future)
- [ ] Oracle integration
- [ ] Governance system
- [ ] Flash loans
- [ ] Isolated lending pools
- [ ] Analytics dashboard

### Phase 3 (Future)
- [ ] Cross-chain bridges
- [ ] Leverage trading
- [ ] Synthetic assets
- [ ] Insurance fund

## Tech Stack

### Smart Contracts
- AssemblyScript
- Massa SDK
- as-bignum (u256 support)

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Massa Wallet integration

## Documentation

- [Smart Contract Documentation](smartcontract/LENDING_PLATFORM.md)
- [Frontend Documentation](Front/README.md)

## Acknowledgments

Built on [Massa blockchain](https://massa.net) using patterns from:
- Dusa Protocol v1-core
- Aave Protocol
- Compound Finance

---

**⚡ Built with Massa Blockchain Technology**

For more information:
- [Massa Network](https://massa.net)
- [Massa Documentation](https://docs.massa.net)
- [Dusa Protocol](https://github.com/dusaprotocol/v1-core)
