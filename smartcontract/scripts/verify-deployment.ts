/**
 * Verify Lending Pool Deployment
 */

import * as dotenv from 'dotenv';
import { Args, Web3Provider, Account, SmartContract, bytesToStr } from '@massalabs/massa-web3';

dotenv.config();
const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

// Token addresses
const WBTC_ADDRESS = 'AS1ZXy3nvqXAMm2w6viAg7frte6cZfJM8hoMvWf4KoKDzvLzYKqE';

async function main() {
  const lendingPoolAddress = process.env.LENDING_POOL_ADDRESS;
  const wmasAddress = process.env.WMAS_TOKEN_ADDRESS;
  const usdcAddress = process.env.USDC_TOKEN_ADDRESS;
  const wbtcAddress = process.env.WBTC_TOKEN_ADDRESS || WBTC_ADDRESS;

  if (!lendingPoolAddress) {
    throw new Error('LENDING_POOL_ADDRESS not set');
  }

  console.log('Verifying Lending Pool Deployment\n');
  console.log('Contract:', lendingPoolAddress);

  const contract = new SmartContract(provider, lendingPoolAddress);

  // Check owner
  try {
    const ownerResult = await contract.read('getOwner', new Args().serialize());
    const owner = bytesToStr(ownerResult.value);
    console.log('👤 Owner:', owner);
  } catch (e: any) {
    console.log('Failed to get owner:', e.message);
  }

  // Check WMAS configuration
  if (wmasAddress) {
    console.log('\nWMAS Token Configuration:');
    try {
      const args = new Args().addString(wmasAddress);

      // Get total collateral
      const collateralResult = await contract.read('getTotalCollateral', args.serialize());
      const totalCollateral = new Args(collateralResult.value).nextU256();
      console.log('Total Collateral:', totalCollateral.toString());

      // Get total borrows
      const borrowsResult = await contract.read('getTotalBorrows', args.serialize());
      const totalBorrows = new Args(borrowsResult.value).nextU256();
      console.log('Total Borrows:', totalBorrows.toString());

      // Get borrow rate
      const rateResult = await contract.read('getBorrowRate', args.serialize());
      const borrowRate = new Args(rateResult.value).nextU32();
      console.log('Borrow Rate (bps):', borrowRate.toString());

      // Get asset price
      const priceResult = await contract.read('getAssetPrice', args.serialize());
      const price = new Args(priceResult.value).nextU256();
      console.log('Asset Price:', price.toString());
    } catch (e: any) {
      console.log('Error:', e.message);
    }
  }

  // Check USDC configuration
  if (usdcAddress) {
    console.log('\nUSDC Token Configuration:');
    try {
      const args = new Args().addString(usdcAddress);

      // Get total collateral
      const collateralResult = await contract.read('getTotalCollateral', args.serialize());
      const totalCollateral = new Args(collateralResult.value).nextU256();
      console.log('Total Collateral:', totalCollateral.toString());

      // Get total borrows
      const borrowsResult = await contract.read('getTotalBorrows', args.serialize());
      const totalBorrows = new Args(borrowsResult.value).nextU256();
      console.log('Total Borrows:', totalBorrows.toString());

      // Get borrow rate
      const rateResult = await contract.read('getBorrowRate', args.serialize());
      const borrowRate = new Args(rateResult.value).nextU32();
      console.log('Borrow Rate (bps):', borrowRate.toString());

      // Get asset price
      const priceResult = await contract.read('getAssetPrice', args.serialize());
      const price = new Args(priceResult.value).nextU256();
      console.log('Asset Price:', price.toString());
    } catch (e: any) {
      console.log('Error:', e.message);
    }
  }

  // Check WBTC configuration
  if (wbtcAddress) {
    console.log('\nWBTC Token Configuration:');
    try {
      const args = new Args().addString(wbtcAddress);

      // Get total collateral
      const collateralResult = await contract.read('getTotalCollateral', args.serialize());
      const totalCollateral = new Args(collateralResult.value).nextU256();
      console.log('Total Collateral:', totalCollateral.toString());

      // Get total borrows
      const borrowsResult = await contract.read('getTotalBorrows', args.serialize());
      const totalBorrows = new Args(borrowsResult.value).nextU256();
      console.log('Total Borrows:', totalBorrows.toString());

      // Get borrow rate
      const rateResult = await contract.read('getBorrowRate', args.serialize());
      const borrowRate = new Args(rateResult.value).nextU32();
      console.log('Borrow Rate (bps):', borrowRate.toString());

      // Get asset price
      const priceResult = await contract.read('getAssetPrice', args.serialize());
      const price = new Args(priceResult.value).nextU256();
      console.log('Asset Price:', price.toString());
    } catch (e: any) {
      console.log('Error:', e.message);
    }
  }

  console.log('\nVerification complete!');
}

main().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
