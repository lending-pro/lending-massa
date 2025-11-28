/**
 * Add WBTC as a supported asset
 */
import { Args, Web3Provider, Account, SmartContract } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
dotenv.config();

const WBTC_ADDRESS = 'AS1ZXy3nvqXAMm2w6viAg7frte6cZfJM8hoMvWf4KoKDzvLzYKqE';
const WBTC_PRICE = BigInt('110000000000000000000000'); // $110,000 with 18 decimals

async function main() {
  const account = await Account.fromEnv();
  const provider = Web3Provider.buildnet(account);

  const lendingPoolAddress = process.env.LENDING_POOL_ADDRESS;
  if (!lendingPoolAddress) {
    throw new Error('LENDING_POOL_ADDRESS not set');
  }

  console.log('Adding WBTC to Lending Pool...');
  console.log('Contract:', lendingPoolAddress);
  console.log('WBTC Address:', WBTC_ADDRESS);

  const contract = new SmartContract(provider, lendingPoolAddress);

  // Add WBTC as supported asset
  console.log('\n1. Adding WBTC as supported asset...');
  try {
    const addArgs = new Args().addString(WBTC_ADDRESS);
    await contract.call('addSupportedAsset', addArgs.serialize(), {
      maxGas: BigInt(200000000),
      coins: BigInt(20000000000),
    });
    console.log('WBTC added successfully!');
  } catch (err: any) {
    console.log('Add asset error:', err.message);
  }

  // Set WBTC price
  console.log('\n2. Setting WBTC price...');
  try {
    const priceArgs = new Args().addString(WBTC_ADDRESS).addU256(WBTC_PRICE);
    await contract.call('setAssetPrice', priceArgs.serialize(), {
      maxGas: BigInt(200000000),
      coins: BigInt(20000000000),
    });
    console.log('WBTC price set to $110,000');
  } catch (err: any) {
    console.log('Set price error:', err.message);
  }

  // Verify
  console.log('\n3. Verifying WBTC configuration...');
  try {
    const priceArgs = new Args().addString(WBTC_ADDRESS);
    const priceResult = await contract.read('getAssetPrice', priceArgs.serialize());
    const price = new Args(priceResult.value).nextU256();
    console.log('WBTC Price:', price.toString());
  } catch (err: any) {
    console.log('Verify error:', err.message);
  }

  console.log('\nDone!');
}

main().catch(console.error);
