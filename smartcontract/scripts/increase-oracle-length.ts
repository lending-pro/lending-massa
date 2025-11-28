/**
 * Increase Oracle Length for Dusa Pairs
 *
 * This script calls increaseOracleLength on Dusa pairs to enable TWAP price feeds
 * Required for lending protocol oracle integration
 */

import * as dotenv from 'dotenv';
import { Args, Web3Provider, Account, SmartContract } from '@massalabs/massa-web3';

// Load environment variables
dotenv.config();
const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

// Oracle configuration
const DEFAULT_ORACLE_LENGTH = 100; // Number of oracle samples to store

interface PairConfig {
  name: string;
  address: string;
  newOracleLength: number;
}

/**
 * Get pairs from environment
 */
function getPairsConfig(): PairConfig[] {
  const pairs: PairConfig[] = [];

  // MAS/USDC pair
  const masUsdcPair = process.env.MAS_USDC_PAIR;
  if (masUsdcPair) {
    pairs.push({
      name: 'MAS/USDC',
      address: masUsdcPair,
      newOracleLength: DEFAULT_ORACLE_LENGTH,
    });
  }

  // MAS/WETH pair (if configured)
  const masWethPair = process.env.MAS_WETH_PAIR;
  if (masWethPair) {
    pairs.push({
      name: 'MAS/WETH',
      address: masWethPair,
      newOracleLength: DEFAULT_ORACLE_LENGTH,
    });
  }

  // MAS/WETH pair (if configured)
  const wbtcUsdcPair = process.env.WBTC_USDC_PAIR;
  if (wbtcUsdcPair) {
    pairs.push({
      name: 'WBTC/USDC',
      address: wbtcUsdcPair,
      newOracleLength: DEFAULT_ORACLE_LENGTH,
    });
  }

  return pairs;
}

/**
 * Increase oracle length for a Dusa pair
 */
async function increaseOracleLength(pair: PairConfig): Promise<void> {
  console.log(`\nIncreasing oracle length for ${pair.name}...`);
  console.log(`Pair address: ${pair.address}`);
  console.log(`New oracle length: ${pair.newOracleLength}`);

  try {
    const contract = new SmartContract(provider, pair.address);

    // Call increaseOracleLength with the new size
    const args = new Args().addU32(pair.newOracleLength);

    const result = await contract.call(
      'increaseOracleLength',
      args.serialize(),
      {
        maxGas: BigInt(200_000_000),
        coins: BigInt(100_000_000), // Send some coins for storage costs
      }
    );

    console.log(`Oracle length increased successfully!`);
  } catch (error: any) {
    // Check if error is because oracle is already large enough
    if (error.message?.includes('OracleNewSizeTooSmall')) {
      console.log(`Oracle length is already >= ${pair.newOracleLength}`);
    } else {
      console.error(`Failed:`, error.message || error);
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Dusa Oracle Length Configuration Script\n');
  console.log('Account:', account.address?.toString());

  const pairs = getPairsConfig();

  if (pairs.length === 0) {
    console.log('No pairs configured in .env file');
    console.log('Set MAS_USDC_PAIR and/or MAS_WETH_PAIR');
    return;
  }

  console.log(`\nFound ${pairs.length} pair(s) to configure:`);
  for (const pair of pairs) {
    console.log(`- ${pair.name}: ${pair.address}`);
  }

  // Increase oracle length for each pair
  for (const pair of pairs) {
    await increaseOracleLength(pair);
  }

  console.log('\nOracle configuration complete!\n');
  console.log('The oracle samples will start accumulating with each swap.');
  console.log('TWAP prices will be available after sufficient samples are collected.\n');
}

// Run
main().catch((error) => {
  console.error('\nScript failed:', error);
  process.exit(1);
});
