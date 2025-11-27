/**
 * Set Asset Prices for Lending Pool
 */

import * as dotenv from 'dotenv';
import { Args, Web3Provider, Account, SmartContract } from '@massalabs/massa-web3';

dotenv.config();
const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

async function main() {
  const lendingPoolAddress = process.env.LENDING_POOL_ADDRESS;
  const wmasAddress = process.env.WMAS_TOKEN_ADDRESS;
  const usdcAddress = process.env.USDC_TOKEN_ADDRESS;

  if (!lendingPoolAddress) {
    throw new Error('LENDING_POOL_ADDRESS not set');
  }

  console.log('Setting Asset Prices\n');
  console.log('Contract:', lendingPoolAddress);

  const contract = new SmartContract(provider, lendingPoolAddress);

  // Set USDC price to $1.00 (1e18)
  if (usdcAddress) {
    console.log('\nSetting USDC price to $1.00...');
    try {
      const usdcPrice = BigInt('1000000000000000000'); // 1e18 = $1.00
      const args = new Args().addString(usdcAddress).addU256(usdcPrice);

      await contract.call('setAssetPrice', args.serialize(), {
        maxGas: BigInt(2_000_000_000),
        coins: BigInt(100_000_000),
      });

      console.log('USDC price set to $1.00');
    } catch (e: any) {
      console.log('Error:', e.message);
    }
  }

  // Set WMAS price to $0.19 (0.19e18)
  if (wmasAddress) {
    console.log('\nSetting WMAS price to $0.19...');
    try {
      const wmasPrice = BigInt('190000000000000000'); // 0.19e18 = $0.19
      const args = new Args().addString(wmasAddress).addU256(wmasPrice);

      await contract.call('setAssetPrice', args.serialize(), {
        maxGas: BigInt(2_000_000_000),
        coins: BigInt(100_000_000),
      });

      console.log('WMAS price set to $0.19');
    } catch (e: any) {
      console.log('Error:', e.message);
    }
  }

  console.log('\nPrices set successfully!');
}

main().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
