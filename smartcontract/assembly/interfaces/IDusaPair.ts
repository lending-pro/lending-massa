import { Address, call } from '@massalabs/massa-as-sdk';
import { Args, bytesToU64 } from '@massalabs/as-types';

/**
 * Dusa Pair Interface for Oracle Integration
 * Based on: https://github.com/dusaprotocol/v1-core/blob/main/assembly/interfaces/IPair.ts
 */
export class IDusaPair {
  constructor(private _origin: Address) {}

  /**
   * Gets the address of this pair contract
   */
  get address(): Address {
    return this._origin;
  }

  /**
   * Gets oracle sample from a specific time delta
   * @param timeDelta - Time delta in milliseconds from now
   * @returns OracleSample containing cumulative bin ID, volatility, and bin crossed
   */
  getOracleSampleFrom(timeDelta: u64): OracleSample {
    const args = new Args().add(timeDelta);
    const result = call(this._origin, 'getOracleSampleFrom', args, 0);
    const resultArgs = new Args(result);

    const cumulativeId = resultArgs.nextU64().unwrap();
    const cumulativeVolatility = resultArgs.nextU64().unwrap();
    const cumulativeBinCrossed = resultArgs.nextU64().unwrap();

    return new OracleSample(cumulativeId, cumulativeVolatility, cumulativeBinCrossed);
  }

  /**
   * Gets the active bin ID (current price bin)
   * @returns Active bin ID
   */
  getActiveId(): u64 {
    const result = call(this._origin, 'getActiveId', new Args(), 0);
    return bytesToU64(result);
  }

  /**
   * Gets the bin step for this pair
   * @returns Bin step (basis points)
   */
  getBinStep(): u64 {
    const result = call(this._origin, 'getBinStep', new Args(), 0);
    return bytesToU64(result);
  }
}

/**
 * Oracle sample data structure
 */
export class OracleSample {
  constructor(
    public cumulativeId: u64,
    public cumulativeVolatility: u64,
    public cumulativeBinCrossed: u64
  ) {}
}

/**
 * Helper function to create an IDusaPair instance from an address string
 * @param addressStr - String representation of the pair address
 * @returns IDusaPair instance
 */
export function createDusaPairInterface(addressStr: string): IDusaPair {
  const addr = new Address(addressStr);
  return new IDusaPair(addr);
}
