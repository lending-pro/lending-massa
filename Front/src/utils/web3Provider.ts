import { Args, JsonRpcPublicProvider, U256 } from '@massalabs/massa-web3';
import { RPC_URL } from './constants';

// Create JSON-RPC Public Provider for read-only operations (no account needed)
export const rpcProvider = JsonRpcPublicProvider.fromRPCUrl(RPC_URL);

// Helper function to read datastore entries (storage keys) directly
export async function readStorageKeys(
  contractAddress: string,
  keys: string[]
): Promise<(Uint8Array | null)[]> {
  try {
    // Call RPC directly to get datastore entries
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get_datastore_entries',
        params: [[{
          address: contractAddress,
          keys: keys.map(key => Array.from(new TextEncoder().encode(key)))
        }]]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('RPC error:', data.error);
      return keys.map(() => null);
    }

    // Map results back to the same order as input keys
    const results: (Uint8Array | null)[] = new Array(keys.length).fill(null);

    if (data.result && data.result.length > 0 && data.result[0]) {
      data.result[0].forEach((entry: any) => {
        if (entry.final_value) {
          const keyStr = new TextDecoder().decode(new Uint8Array(entry.key));
          const idx = keys.indexOf(keyStr);
          if (idx !== -1) {
            results[idx] = new Uint8Array(entry.final_value);
          }
        }
      });
    }

    return results;
  } catch (err) {
    console.error('Error reading storage keys:', err);
    return keys.map(() => null);
  }
}

// Helper to convert storage bytes to u256
// Smart contract stores u256 as bytesToString(u256ToBytes(value))
export function storageToU256(data: Uint8Array | null): bigint {
  if (!data || data.length === 0) {
    return 0n;
  }

  try {
    // The storage encodes u256 as bytes
    // We need to convert the bytes to bigint
    return U256.fromBytes(data);
  } catch (err) {
    console.error('Error converting storage to u256:', err);
    return 0n;
  }
}

// Helper function to call ERC20 balanceOf
export async function getERC20Balance(tokenAddress: string, userAddress: string): Promise<bigint> {
  try {
    const args = new Args().addString(userAddress);

    console.log('Fetching balance for:', { tokenAddress, userAddress });

    const result = await rpcProvider.readSC({
      target: tokenAddress,
      func: 'balanceOf',
      parameter: args,
      maxGas: BigInt(200_000_000),
      caller: userAddress,
    });

    console.log('Read SC result:', {
      hasValue: !!result.value,
      valueLength: result.value?.length,
      error: result.info?.error,
      gasCost: result.info?.gasCost,
      events: result.info?.events,
    });

    // Check for errors in the result
    if (result.info?.error) {
      console.error('Smart contract error:', result.info.error);
      return 0n;
    }

    // Check if we have a value
    if (!result.value || result.value.length === 0) {
      console.warn('Empty result value');
      return 0n;
    }

    // Parse the result using U256.fromBytes (ERC20 returns raw U256 bytes, not Args-serialized)
    try {
      const balance = U256.fromBytes(result.value);
      console.log('Parsed balance:', balance.toString());
      return balance;
    } catch (parseErr) {
      console.error('Error parsing result:', parseErr, 'Raw value:', result.value);
      return 0n;
    }
  } catch (err) {
    console.error('Error fetching ERC20 balance:', err);
    return 0n;
  }
}

// Helper function to read smart contract
export async function readSmartContract(
  contractAddress: string,
  functionName: string,
  args: Args,
  callerAddress?: string
): Promise<any> {
  try {
    const result = await rpcProvider.readSC({
      target: contractAddress,
      func: functionName,
      parameter: args,
      maxGas: BigInt(3_000_000_000),
      caller: callerAddress,
    });

    return result;
  } catch (err) {
    console.error('Error reading smart contract:', err);
    throw err;
  }
}

// Helper function to get ERC20 allowance
export async function getERC20Allowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<bigint> {
  try {
    const args = new Args().addString(ownerAddress).addString(spenderAddress);

    const result = await rpcProvider.readSC({
      target: tokenAddress,
      func: 'allowance',
      parameter: args,
      maxGas: BigInt(200_000_000),
      caller: ownerAddress,
    });

    if (result.info?.error) {
      console.error('Smart contract error:', result.info.error);
      return 0n;
    }

    if (!result.value || result.value.length === 0) {
      return 0n;
    }

    return U256.fromBytes(result.value);
  } catch (err) {
    console.error('Error fetching ERC20 allowance:', err);
    return 0n;
  }
}

// Helper function to check if a token is supported in the lending pool
export async function isTokenSupported(
  lendingPoolAddress: string,
  tokenAddress: string
): Promise<boolean> {
  try {
    const args = new Args().addString(tokenAddress);

    const result = await rpcProvider.readSC({
      target: lendingPoolAddress,
      func: 'isAssetSupported',
      parameter: args,
      maxGas: BigInt(1_000_000_000),
    });

    if (result.value && result.value.length > 0) {
      const resultArgs = new Args(result.value);
      return resultArgs.nextBool();
    }
    return false;
  } catch (err) {
    console.error('Error checking if token is supported:', err);
    return false;
  }
}
