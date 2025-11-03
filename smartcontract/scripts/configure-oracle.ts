/**
 * Configure Dusa Oracle Integration
 *
 * This script configures Dusa pair addresses for oracle price feeds
 */

import * as dotenv from 'dotenv';
import { Args, Web3Provider, Account, SmartContract, Mas } from '@massalabs/massa-web3';

// Load environment variables
dotenv.config();
const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);
interface OraclePairConfig {
  tokenAddress: string;
  tokenSymbol: string;
  dusaPairAddress: string;
}

/**
 * Dusa pair configurations
 * Update these with actual Dusa pair addresses for your tokens
 */
const ORACLE_PAIRS: OraclePairConfig[] = [
  {
    tokenSymbol: 'MAS',
    tokenAddress: process.env.WMAS_TOKEN_ADDRESS || '',
    dusaPairAddress: process.env.MAS_USDC_PAIR || '',
  },
  // {
  //   tokenSymbol: 'WETH',
  //   tokenAddress: process.env.WETH_TOKEN_ADDRESS || '',
  //   dusaPairAddress: process.env.MAS_WETH_PAIR || '',
  // },
  // Add more pairs as needed
];

async function configureOraclePairs() {
  console.log('🔮 Configuring Dusa Oracle Pairs\n');

  // Load config
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const lendingPoolAddress = process.env.LENDING_POOL_ADDRESS;
  const rpcUrl = process.env.MASSA_RPC_URL || '';

  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not set');
  }

  if (!lendingPoolAddress) {
    throw new Error('LENDING_POOL_ADDRESS not set');
  }

  console.log('📍 LendingPool:', lendingPoolAddress);
  console.log('👤 Admin:', account.address);
  console.log('');

  // Configure each pair
  for (const pair of ORACLE_PAIRS) {
    if (!pair.tokenAddress || !pair.dusaPairAddress) {
      console.log(`⏭️  Skipping ${pair.tokenSymbol} (not configured)\n`);
      continue;
    }

    console.log(`🔄 Configuring ${pair.tokenSymbol}...`);
    console.log(`   Token: ${pair.tokenAddress}`);
    console.log(`   Dusa Pair: ${pair.dusaPairAddress}`);

    try {
      const args = new Args()
        .addString(pair.tokenAddress)
        .addString(pair.dusaPairAddress);

      const contract = new SmartContract(provider, lendingPoolAddress);
      const tx = await contract.call(
        'setAssetPair',
        args.serialize(),
        {maxGas: BigInt(2_000_000_000), coins: BigInt(0)}
      );

      console.log(`   ✅ Pair configured\n`);
    } catch (error) {
      console.error(`   ❌ Failed:`, error, '\n');
    }
  }

  console.log('✅ Oracle configuration complete!\n');
  console.log('📝 Next steps:');
  console.log('1. Verify oracle prices:');
  console.log('   massa-cli read getAssetPrice <TOKEN_ADDRESS>');
  console.log('\n2. Optional: Set TWAP period (default 5 minutes):');
  console.log('   massa-cli call setTWAPPeriod <SECONDS>');
  console.log('');
}

configureOraclePairs().catch((error) => {
  console.error('❌ Configuration failed:', error);
  process.exit(1);
});
