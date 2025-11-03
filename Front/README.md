# Massa Lending Platform - Frontend

A modern, responsive frontend for the Massa lending and borrowing platform built with React, TypeScript, and Tailwind CSS.

## Features

- **Wallet Integration**: Connect with Massa wallet extension
- **Dashboard**: View your lending positions, health factor, and statistics
- **Supply**: Deposit and withdraw collateral
- **Borrow**: Borrow assets against your collateral and repay loans
- **Liquidate**: Participate in liquidations to earn bonuses
- **Real-time Updates**: Live interest rates and position tracking

## Prerequisites

- Node.js >= 16
- npm or yarn
- Massa Wallet Extension (for testnet)

## Installation

```bash
# Install dependencies
npm install
```

## Configuration

Before running the app, update the contract addresses in `src/utils/constants.ts`:

```typescript
export const LENDING_POOL_ADDRESS = 'AS1...'; // Your deployed LendingPool contract address

export const DEFAULT_ASSETS = [
  {
    symbol: 'MAS',
    name: 'Massa',
    address: 'AS1...', // WMAS token address
    decimals: 18,
  },
  // Add more supported assets
];
```

## Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

## Build for Production

```bash
# Build the app
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx      # Navigation and wallet connection
│   ├── Dashboard.tsx   # User positions dashboard
│   ├── DepositWithdraw.tsx  # Collateral management
│   ├── BorrowRepay.tsx      # Borrowing interface
│   └── Liquidations.tsx     # Liquidation interface
├── contexts/           # React contexts
│   └── WalletContext.tsx    # Wallet connection state
├── hooks/              # Custom hooks
│   └── useLendingPool.ts    # Contract interaction hooks
├── types/              # TypeScript types
│   └── index.ts
├── utils/              # Utility functions
│   ├── constants.ts    # App constants
│   └── formatting.ts   # Formatting helpers
├── App.tsx             # Main app component
├── main.tsx            # Entry point
└── index.css           # Global styles
```

## Usage

### Connecting Your Wallet

1. Install the Massa Wallet extension
2. Create or import a wallet
3. Switch to testnet
4. Click "Connect Wallet" in the app

### Depositing Collateral

1. Navigate to the "Supply" tab
2. Select an asset
3. Enter the amount to deposit
4. Approve the transaction in your wallet
5. Confirm the deposit

### Borrowing

1. Navigate to the "Borrow" tab
2. Ensure you have sufficient collateral
3. Select an asset to borrow
4. Enter the amount (up to 75% of collateral value)
5. Monitor your health factor
6. Confirm the transaction

### Repaying

1. Navigate to the "Borrow" tab
2. Click "Repay"
3. Select the asset to repay
4. Enter the amount
5. Confirm the transaction

### Liquidating Positions

1. Navigate to the "Liquidate" tab
2. Browse unhealthy positions (Health Factor < 1.0)
3. Click "Liquidate" on a position
4. Enter the amount to repay
5. Receive collateral + 10% bonus

## Key Features Explained

### Health Factor

The health factor indicates the safety of your position:
- **> 2.0**: Very Safe (Green)
- **1.5 - 2.0**: Safe (Green)
- **1.2 - 1.5**: Moderate (Yellow)
- **1.0 - 1.2**: Risky (Yellow)
- **< 1.0**: Liquidatable (Red)

Formula: `(Collateral Value × Liquidation Threshold) / Debt Value`

### Interest Rates

Interest rates are dynamic and based on utilization:
- Higher utilization = Higher borrow rates
- Rates adjust in real-time
- Supply APY = Borrow APY × Utilization Rate

### Liquidations

When a position becomes unhealthy (HF < 1.0):
- Liquidators can repay up to 50% of the debt
- Liquidators receive the debt value + 10% bonus in collateral
- Helps maintain protocol solvency

## Troubleshooting

### Wallet Connection Issues

- Ensure Massa Wallet extension is installed
- Check you're on the correct network (testnet)
- Refresh the page and try again

### Transaction Failures

- Check your wallet has sufficient balance for gas
- Verify you've approved token spending
- Ensure your position will remain healthy after the transaction

### Price Display Issues

- Prices are fetched from the smart contract
- Ensure oracle prices are set (admin function)
- Default values may show if prices aren't set

## Development Tips

### Adding New Assets

1. Update `DEFAULT_ASSETS` in `src/utils/constants.ts`
2. Ensure the asset is supported in the smart contract
3. Set the asset price (admin only)

### Customizing Styles

The app uses Tailwind CSS. Modify `tailwind.config.js` to customize colors and theme.

### API Integration

All contract interactions are in `src/hooks/useLendingPool.ts`. Modify this file to add new contract functions.

## Tech Stack

- **React 18**: UI library
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **@massalabs/massa-web3**: Massa blockchain integration
- **@massalabs/wallet-provider**: Wallet connection

Built with ❤️ on Massa Blockchain
