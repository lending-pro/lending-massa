import { Args, Provider, SmartContract } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

export function getScByteCode(folderName: string, fileName: string): Buffer {
  // Obtain the current file name and directory paths
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(path.dirname(__filename));
  return readFileSync(path.join(__dirname, folderName, fileName));
}

export async function getDynamicCosts(
  provider: Provider,
  targetAddress: string,
  targetFunction: string,
  parameter: Args,
): Promise<bigint> {
  const MAX_GAS = 4294167295; // Max gas for an op on Massa blockchain
  const gas_margin = 1.2;
  let estimatedGas: bigint = BigInt(MAX_GAS);
  // const prefix = "Estimated storage cost: ";
  // let estimatedStorageCost: number = 0;
  // const storage_cost_margin = 1.1;

  const sc = new SmartContract(provider, targetAddress);
  try {
    const readOnlyCall = await sc.read(targetFunction, parameter);
    console.log('readOnlyCall:', readOnlyCall);
    console.log('events', readOnlyCall.info.events);
    console.log('===');

    estimatedGas = BigInt(
      Math.min(Math.floor(readOnlyCall.info.gasCost * gas_margin), MAX_GAS),
    );
    // let filteredEvents = readOnlyCall.info.output_events.filter((e) => e.data.includes(prefix));
    // // console.log("filteredEvents:", filteredEvents);
    // estimatedStorageCost = Math.floor(
    //     parseInt( filteredEvents[0].data.slice(prefix.length) , 10) * storage_cost_margin
    // );
  } catch (err) {
    console.log(
      `Failed to get dynamic gas cost for ${targetFunction} at ${targetAddress}. Using fallback value `,
      err,
    );
  }
  return estimatedGas;
}

export function assert(condition: unknown, msg?: string): asserts condition {
  if (condition === false) throw new Error(msg);
}
