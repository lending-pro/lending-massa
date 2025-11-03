# Massa Lending Pool - Complete Deployment Guide

## Prerequisites

- Node.js >= 16
- npm or yarn
- Massa Wallet with testnet MAS
- Git

## Step 1: Clone and Setup

```bash
# Clone repository
git clone <your-repo-url>
cd massa-test-pro

# Install dependencies
cd smartcontract
npm install

cd ../Front
npm install
```

## Step 2: Build Smart Contracts

```bash
cd smartcontract
npm run build
```

**Expected Output:**
```
2 files to compile
contract to compile assembly/contracts/LendingPool.ts
contract to compile assembly/contracts/main.ts
```

**Verify build:**
```bash
ls -lh build/
# Should see LendingPool.wasm (~180 KB)
```

## Step 3: Configure Environment

```bash
# In smartcontract directory
cp .env.example .env
```

**Edit `.env` file:**
```bash
# Required
DEPLOYER_PRIVATE_KEY=S1your_secret_key_here
DEPLOYER_ADDRESS=AU1your_address_here
MASSA_RPC_URL=https://test.massa.net/api/v2

# Optional - will use defaults
MAX_GAS=2000000
LENDING_POOL_ADDRESS=  # Will be filled after deployment
```

## Step 4: Deploy Contract

### Option A: Using Deployment Script (Recommended)

```bash
cd smartcontract
npx ts-node scripts/deploy-lending-pool.ts
```

**Expected Output:**
```
🚀 Massa Lending Pool Deployment Script

✅ Configuration loaded
🌐 Network: https://test.massa.net/api/v2

📦 Deploying LendingPool Contract...
Deployer: AU1your_address_here
📝 Contract size: 185342 bytes
⛽ Max gas: 2000000

✅ Contract deployed successfully!
📍 Address: AS1abc123...
🔗 Operation ID: O1xyz789...

✅ Configuration complete!

🎉 Deployment Complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 LendingPool Address: AS1abc123...
👤 Owner Address: AU1your_address_here
🌐 Network: testnet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Save the contract address!** You'll need it for the frontend.

### Option B: Manual Deployment

```bash
# Using massa-cli
massa-cli deploy smartcontract/build/LendingPool.wasm --args <owner_address>
```

## Step 5: Post-Deployment Configuration

### 5.1 Add Supported Assets

```bash
# Add WMAS token
massa-cli call AS1lendingpool addSupportedAsset AS1wmas_address

# Add USDC token
massa-cli call AS1lendingpool addSupportedAsset AS1usdc_address

# Add more assets as needed
```

### 5.2 Configure Oracle (Option A: Dusa Integration - Recommended)

```bash
# Set Dusa pair addresses for oracle prices
massa-cli call AS1lendingpool setAssetPair AS1wmas_address AS1mas_usdc_pair

massa-cli call AS1lendingpool setAssetPair AS1usdc_address AS1usdc_mas_pair
```

**Or use the script:**
```bash
# Update .env with pair addresses
WMAS_TOKEN_ADDRESS=AS1...
MAS_USDC_PAIR=AS1...

# Run oracle configuration
npx ts-node scripts/configure-oracle.ts
```

### 5.3 Configure Prices (Option B: Manual Prices for Testing)

```bash
# Set MAS price to $50 (50 * 1e18)
massa-cli call AS1lendingpool setAssetPrice AS1wmas_address 50000000000000000000

# Set USDC price to $1
massa-cli call AS1lendingpool setAssetPrice AS1usdc_address 1000000000000000000
```

### 5.4 Verify Deployment

```bash
# Check borrow rate
massa-cli read AS1lendingpool getBorrowRate AS1wmas_address
# Should return basis points (e.g., 200 = 2%)

# Check total collateral (should be 0 initially)
massa-cli read AS1lendingpool getTotalCollateral AS1wmas_address

# Check asset price
massa-cli read AS1lendingpool getAssetPrice AS1wmas_address
```

## Step 6: Configure Frontend

```bash
cd Front

# Update contract address
vi src/utils/constants.ts
```

**Edit `constants.ts`:**
```typescript
export const LENDING_POOL_ADDRESS = 'AS1abc123...'; // Your deployed address

export const DEFAULT_ASSETS = [
  {
    symbol: 'MAS',
    name: 'Massa',
    address: 'AS1wmas_address', // Real WMAS address
    decimals: 18,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: 'AS1usdc_address', // Real USDC address
    decimals: 6,
  },
  // Add more assets...
];
```

## Step 7: Test Frontend Locally

```bash
cd Front
npm run dev
```

**Open browser:** http://localhost:5173

**Test Flow:**
1. Click "Connect Wallet"
2. Select Massa Wallet
3. Approve connection
4. Navigate to "Supply" tab
5. Check if APY/TVL displays correctly
6. Try depositing a small amount

## Step 8: Deploy Frontend (Production)

```bash
cd Front
npm run build

# Deploy dist/ folder to:
# - Vercel: vercel deploy
# - Netlify: netlify deploy --prod
# - GitHub Pages: push to gh-pages branch
# - Or any static hosting
```

## Step 9: Initial Testing Checklist

### Smart Contract Tests

- [ ] Deposit collateral (small amount)
- [ ] Check `getUserCollateral` returns correct amount
- [ ] Borrow against collateral
- [ ] Check `getUserDebt` returns correct amount
- [ ] Check borrow rate updates with utilization
- [ ] Repay debt
- [ ] Withdraw collateral
- [ ] Check liquidation (need unhealthy position)

### Frontend Tests

- [ ] Wallet connects successfully
- [ ] Dashboard shows positions
- [ ] Supply APY displays correctly
- [ ] Borrow APY displays correctly
- [ ] TVL shows real values
- [ ] Utilization updates
- [ ] Deposit form works
- [ ] Borrow form works
- [ ] Repay works
- [ ] Withdraw works

## Step 10: Monitor Deployment

### Check Events

```bash
# Monitor contract events
massa-cli events AS1lendingpool

# Check for:
# - CollateralDeposited
# - TokensBorrowed
# - DebtRepaid
# - PositionLiquidated
```

### Monitor Prices

```bash
# Check oracle prices regularly
watch -n 60 massa-cli read AS1lendingpool getAssetPrice AS1wmas_address
```

### Monitor Health

```bash
# Check overall protocol health
massa-cli read AS1lendingpool getTotalCollateral AS1wmas
massa-cli read AS1lendingpool getTotalBorrows AS1wmas

# Calculate utilization
# Utilization = borrows / collateral
```

## Troubleshooting

### Issue: Contract deployment fails

**Solution:**
- Check you have enough MAS for gas
- Verify WASM file exists: `ls build/LendingPool.wasm`
- Check RPC URL is correct
- Try increasing MAX_GAS

### Issue: Cannot add supported asset

**Solution:**
- Verify you're calling from owner address
- Check asset address is valid
- Ensure contract is not paused

### Issue: Frontend shows $0 for TVL

**Solutions:**
1. Check asset prices are set:
   ```bash
   massa-cli read AS1lendingpool getAssetPrice AS1token
   ```

2. If using Dusa oracle, verify pair address:
   ```bash
   # Check pair is set correctly
   # (No direct read function, check deployment logs)
   ```

3. Verify network in frontend matches deployment

### Issue: APY shows 0.00%

**Solution:**
- Check if there are any borrows (0% borrow = 0% supply APY)
- Verify interest rate parameters are set
- Check utilization is > 0

### Issue: Wallet won't connect

**Solution:**
- Install Massa Wallet extension
- Switch to correct network (testnet vs mainnet)
- Refresh page
- Check console for errors

## Security Checklist Before Mainnet

- [ ] Professional security audit completed
- [ ] All tests passing
- [ ] Oracle integration verified
- [ ] Multi-sig for admin functions
- [ ] Timelock for parameter changes
- [ ] Emergency pause mechanism tested
- [ ] TVL caps set appropriately
- [ ] Bug bounty program launched
- [ ] Documentation complete
- [ ] User testing on testnet

## Useful Commands Reference

```bash
# Smart Contract
massa-cli deploy <wasm> --args <args>
massa-cli call <address> <function> <args>
massa-cli read <address> <function> <args>
massa-cli events <address>

# Check balance
massa-cli balance <address>

# Check operation status
massa-cli operation <operation_id>

# Frontend
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
```

## Support

If you encounter issues:

1. Check logs: `npm run dev` (frontend) or deployment logs (contract)
2. Review documentation: `README.md`, `LENDING_PLATFORM.md`
3. Check Massa documentation: https://docs.massa.net
4. Open issue on GitHub

## Next Steps After Deployment

1. **User Testing**
   - Invite beta testers
   - Gather feedback
   - Fix issues

2. **Monitoring Setup**
   - Setup alerts for:
     - High utilization (>90%)
     - Large borrowings
     - Liquidations
     - Oracle price anomalies

3. **Analytics**
   - Track TVL growth
   - Monitor APY trends
   - User adoption metrics

4. **Community**
   - Announce on Massa Discord
   - Write blog post
   - Create tutorial videos

5. **Improvements**
   - Add more assets
   - Optimize gas costs
   - Improve UI/UX
   - Add features (flash loans, etc.)

---

**Congratulations on deploying your Massa Lending Pool!** 🎉

For questions or support, refer to the documentation or open an issue.
