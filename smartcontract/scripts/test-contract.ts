/**
 * Test Contract Functions
 */
import { Args, Web3Provider, Account, SmartContract } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const account = await Account.fromEnv();
  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, process.env.LENDING_POOL_ADDRESS || '');
  const userAddress = 'AU1cBirTno1FrMVpUMT96KiQ97wBqqM1z9uJLr3XZKQwJjFLPEar';
  const usdcAddress = process.env.USDC_TOKEN_ADDRESS || '';

  console.log('Contract:', process.env.LENDING_POOL_ADDRESS);
  console.log('User:', userAddress);
  console.log('USDC:', usdcAddress);

  // Test getUserCollateral
  console.log('\n--- getUserCollateral ---');
  const collArgs = new Args().addString(userAddress).addString(usdcAddress);
  const collResult = await contract.read('getUserCollateral', collArgs.serialize());
  console.log('Raw bytes:', Array.from(collResult.value));
  const collateral = new Args(collResult.value).nextU256();
  console.log('User USDC Collateral:', collateral.toString());

  // Test getAccountHealth
  console.log('\n--- getAccountHealth ---');
  const healthArgs = new Args().addString(userAddress);
  const healthResult = await contract.read('getAccountHealth', healthArgs.serialize());
  console.log('Raw bytes:', Array.from(healthResult.value));
  const healthParsed = new Args(healthResult.value);
  const collateralValue = healthParsed.nextU256();
  const debtValue = healthParsed.nextU256();
  const healthFactor = healthParsed.nextU256();
  const isHealthy = healthParsed.nextBool();
  console.log('Collateral Value:', collateralValue.toString());
  console.log('Debt Value:', debtValue.toString());
  console.log('Health Factor:', healthFactor.toString());
  console.log('Is Healthy:', isHealthy);

  // Test getAssetPrice
  console.log('\n--- getAssetPrice ---');
  const priceArgs = new Args().addString(usdcAddress);
  const priceResult = await contract.read('getAssetPrice', priceArgs.serialize());
  const price = new Args(priceResult.value).nextU256();
  console.log('USDC Price:', price.toString());

  // Test total collateral in pool
  console.log('\n--- getTotalCollateral ---');
  const totalArgs = new Args().addString(usdcAddress);
  const totalResult = await contract.read('getTotalCollateral', totalArgs.serialize());
  const totalColl = new Args(totalResult.value).nextU256();
  console.log('Total USDC Collateral in pool:', totalColl.toString());

  // Try to borrow 1 USDC
  console.log('\n--- Attempting to borrow 1 USDC ---');
  try {
    const borrowAmount = BigInt(1_000_000); // 1 USDC with 6 decimals
    const borrowArgs = new Args().addString(usdcAddress).addU256(borrowAmount);
    const result = await contract.call('borrow', borrowArgs.serialize(), {
      maxGas: BigInt(3_000_000_000),
      coins: BigInt(100_000_000),
    });
    console.log('Borrow result:', result);
  } catch (err: any) {
    console.log('Borrow error:', err.message);
  }
}

main().catch(console.error);
