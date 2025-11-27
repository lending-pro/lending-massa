/**
 * Deployment script for Massa Lending Pool
 *
 * This script:
 * 1. Deploys the LendingPool contract
 * 2. Initializes with default parameters
 * 3. Optionally adds supported assets
 * 4. Optionally sets initial prices or Dusa pairs
 * 5. Outputs configuration for frontend
 */

import { readFileSync } from 'fs';
import { Args, Web3Provider, Account, SmartContract, Mas } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
// import { deploySC, WalletClient } from '@massalabs/massa-sc-deployer';
function getScByteCode(folderName: string, fileName: string): Buffer {
  // Obtain the current file name and directory paths
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(path.dirname(__filename));
  return readFileSync(path.join(__dirname, folderName, fileName));
}

// Load environment variables
dotenv.config();
const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

interface DeployConfig {
  privateKey: string;
  publicKey: string;
  rpcUrl: string;
  maxGas: bigint;
  gasPrice: bigint;
  coins: bigint;
}

interface ContractAddresses {
  lendingPool: string;
  timestamp: string;
  network: string;
}

/**
 * Load configuration from environment
 */
function loadConfig(): DeployConfig {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
  const publicKey = process.env.DEPLOYER_ADDRESS || process.env.WALLET_ADDRESS;

  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not found in .env file');
  }

  if (!publicKey) {
    throw new Error('DEPLOYER_ADDRESS not found in .env file');
  }

  return {
    privateKey,
    publicKey,
    rpcUrl: process.env.MASSA_RPC_URL || '',
    maxGas: BigInt(process.env.MAX_GAS || '200000000'),
    gasPrice: BigInt(process.env.GAS_PRICE || '0'),
    coins: BigInt(process.env.COINS || '0'),
  };
}

/**
 * Deploy LendingPool contract
 */
async function deployLendingPool(config: DeployConfig): Promise<SmartContract> {
  console.log('\nDeploying LendingPool Contract...');
  console.log('Deployer:', config.publicKey);

  // Read compiled WASM
  const wasmPath = './build/LendingPool.wasm';
  let contractData: Buffer;

  try {
    contractData = readFileSync(wasmPath);
  } catch (error) {
    throw new Error(`Failed to read WASM file at ${wasmPath}. Did you run 'npm run build'?`);
  }

  // Prepare constructor arguments (owner address)
  const constructorArgs = new Args().addString(config.publicKey);

  console.log('Contract size:', contractData.length, 'bytes');
  console.log('Max gas:', config.maxGas.toString());

  // Deploy contract
  try {
    const byteCode = getScByteCode('build', 'LendingPool.wasm');
    const contract = await SmartContract.deploy(provider, byteCode, constructorArgs, {
      coins: config.coins,
    });
    // const deploymentResult = await deploySC(
    //   config.publicKey,
    //   account,
    //   contractData,
    //   constructorArgs,
    //   config.maxGas,
    //   config.coins,
    //   config.gasPrice,
    //   config.rpcUrl
    // );

    console.log('Contract deployed successfully!');
    console.log('Address:', contract.address);
    // console.log('🔗 Operation ID:', contract.);

    return contract;
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

/**
 * Post-deployment configuration
 */
async function configureContract(
  contract: SmartContract,
  config: DeployConfig
): Promise<void> {
  console.log('\nConfiguring LendingPool...');

  // Parse supported assets from environment
  const supportedAssets = process.env.SUPPORTED_ASSETS?.split(',').filter(a => a.trim());

  if (supportedAssets && supportedAssets.length > 0) {
    console.log('\nAdding supported assets...');

    for (const asset of supportedAssets) {
      try {
        const args = new Args().addString(asset.trim());

        await contract.call(
          'addSupportedAsset',
          args.serialize(),
          { maxGas: config.maxGas, coins: config.coins },
        );

        console.log('Added:', asset.trim());
      } catch (error) {
        console.error('Failed to add', asset, ':', error);
      }
    }
  }

  // Set initial prices if provided
  const initialPrices = process.env.INITIAL_PRICES?.split(',').filter(p => p.trim());

  if (initialPrices && initialPrices.length > 0) {
    console.log('\nSetting initial prices...');

    for (const priceEntry of initialPrices) {
      const [address, price] = priceEntry.split(':');
      if (address && price) {
        try {
          const args = new Args()
            .addString(address.trim())
            .addU256(BigInt(price.trim()));

          await contract.call(
            'setAssetPrice',
            args.serialize(),
            { maxGas: config.maxGas, coins: config.coins },);

          console.log(`Set price for ${address.trim()}: ${price}`);
        } catch (error) {
          console.error(`Failed to set price for ${address}:`, error);
        }
      }
    }
  }

  console.log('\nConfiguration complete!');
}

/**
 * Save deployment addresses to file
 */
function saveDeploymentInfo(addresses: ContractAddresses): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');

  const deploymentInfo = {
    ...addresses,
    note: 'Update Front/src/utils/constants.ts with these addresses',
  };

  const outputPath = path.join(__dirname, '../deployment-addresses.json');
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));

  console.log('\nDeployment info saved to:', outputPath);
}

/**
 * Main deployment function
 */
async function main() {
  console.log('Massa Lending Pool Deployment Script\n');

  try {
    // Load configuration
    const config = loadConfig();
    console.log('Configuration loaded');
    console.log('Network:', config.rpcUrl);

    // Deploy contract
    const lendingPool = await deployLendingPool(config);

    // Create wallet client for post-deployment configuration
    // const baseAccount = await WalletClient.getAccountFromSecretKey(config.privateKey);


    // Configure contract
    await configureContract(lendingPool, config);

    // Save addresses
    const addresses: ContractAddresses = {
      lendingPool: lendingPool.address,
      timestamp: new Date().toISOString(),
      network: config.rpcUrl.includes('test') ? 'testnet' : 'mainnet',
    };

    saveDeploymentInfo(addresses);

    const events = await provider.getEvents({
      smartContractAddress: lendingPool.address,
    });
    for (const event of events) {
      console.log('Event message:', event.data);
    }

    // Print summary
    console.log('\nDeployment Complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('LendingPool Address:', lendingPool.address);
    console.log('Owner Address:', config.publicKey);
    console.log('Network:', addresses.network);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Next Steps:');
    console.log('1. Update Front/src/utils/constants.ts:');
    console.log(`export const LENDING_POOL_ADDRESS = '${lendingPool.address}';`);
    console.log('\n2. Add supported assets (if not done):');
    console.log('massa-cli call addSupportedAsset <TOKEN_ADDRESS>');
    console.log('\n3. Set asset prices or Dusa pairs:');
    console.log('massa-cli call setAssetPrice <TOKEN> <PRICE>');
    console.log('// OR');
    console.log('massa-cli call setAssetPair <TOKEN> <DUSA_PAIR>');
    console.log('\n4. Test the deployment:');
    console.log('massa-cli read getBorrowRate <TOKEN_ADDRESS>');
    console.log('massa-cli read getTotalCollateral <TOKEN_ADDRESS>\n');

  } catch (error) {
    console.error('\nDeployment failed:', error);
    process.exit(1);
  }
}

// Run deployment
main().catch(console.error);
