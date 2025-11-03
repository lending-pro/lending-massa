import { Address, call } from '@massalabs/massa-as-sdk';
import { Args, bytesToU256 } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';

/**
 * Price Oracle Interface
 * Can be used with Dusa's oracle or any compatible price feed
 */
export class IPriceOracle {
  constructor(private _origin: Address) {}

  /**
   * Gets the address of this oracle contract
   */
  get address(): Address {
    return this._origin;
  }

  /**
   * Gets the price of an asset
   * @param tokenAddress - Address of the token
   * @returns Price with 18 decimals (1e18 = $1)
   */
  getPrice(tokenAddress: Address): u256 {
    const args = new Args().add(tokenAddress);
    const result = call(this._origin, 'getPrice', args, 0);
    return bytesToU256(stringToBytes(bytesToString(result)));
  }

  /**
   * Gets the latest price with timestamp
   * @param tokenAddress - Address of the token
   * @returns Price and timestamp
   */
  getLatestPrice(tokenAddress: Address): PriceData {
    const args = new Args().add(tokenAddress);
    const result = call(this._origin, 'getLatestPrice', args, 0);
    const resultArgs = new Args(result);

    const price = resultArgs.nextU256().unwrap();
    const timestamp = resultArgs.nextU64().unwrap();

    return new PriceData(price, timestamp);
  }

  /**
   * Checks if price is fresh (not stale)
   * @param tokenAddress - Address of the token
   * @param maxAge - Maximum age in milliseconds
   * @returns true if price is fresh
   */
  isPriceFresh(tokenAddress: Address, maxAge: u64): bool {
    const priceData = this.getLatestPrice(tokenAddress);
    const now = Context.timestamp();
    return (now - priceData.timestamp) <= maxAge;
  }
}

/**
 * Price data structure
 */
export class PriceData {
  constructor(
    public price: u256,
    public timestamp: u64
  ) {}
}

/**
 * Helper function to create an IPriceOracle instance from an address string
 * @param addressStr - String representation of the oracle address
 * @returns IPriceOracle instance
 */
export function createOracleInterface(addressStr: string): IPriceOracle {
  const addr = new Address(addressStr);
  return new IPriceOracle(addr);
}

// Import necessary functions
import { Context } from '@massalabs/massa-as-sdk';
import { bytesToString, stringToBytes } from '@massalabs/as-types';
