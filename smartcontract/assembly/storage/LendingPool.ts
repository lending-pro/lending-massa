import { Storage } from '@massalabs/massa-as-sdk';
import { Args, u256ToBytes, bytesToU256, bytesToU32, stringToBytes, bytesToU64, u32ToBytes, u64ToBytes } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';

/**
 * Storage keys and helper functions for the Lending Pool contract
 *
 * For u256 values, we serialize them to bytes and store using the generic Storage.set/get
 * which supports StaticArray<u8> as both key and value types.
 */

// ============================================
// Simple Storage Keys (for single values)
// ============================================

export const OWNER_KEY = 'owner';
export const INITIALIZED_KEY = 'initialized';
export const PAUSED_KEY = 'paused';

// Global Pool State
export const TOTAL_DEPOSITS_KEY = 'total_deposits';
export const TOTAL_BORROWS_KEY = 'total_borrows';
export const LAST_UPDATE_TIMESTAMP_KEY = 'last_update';

// Interest Rate Parameters (basis points, 10000 = 100%)
export const BASE_RATE_KEY = 'base_rate'; // Base interest rate (e.g., 200 = 2%)
export const OPTIMAL_UTILIZATION_KEY = 'optimal_util'; // Optimal utilization rate (e.g., 8000 = 80%)
export const SLOPE1_KEY = 'slope1'; // Interest rate slope before optimal (e.g., 400 = 4%)
export const SLOPE2_KEY = 'slope2'; // Interest rate slope after optimal (e.g., 6000 = 60%)

// Risk Parameters (basis points)
export const COLLATERAL_FACTOR_KEY = 'collateral_factor'; // Max LTV (e.g., 7500 = 75%)
export const LIQUIDATION_THRESHOLD_KEY = 'liquidation_threshold'; // Liquidation trigger (e.g., 8000 = 80%)
export const LIQUIDATION_PENALTY_KEY = 'liquidation_penalty'; // Liquidation bonus (e.g., 1000 = 10%)

// ============================================
// PersistentMap Storage Classes
// ============================================

/**
 * Storage for user collateral balances
 * Key: user_address:token_address
 * Value: u256 (collateral amount)
 */
export class UserCollateralStorage {
  private static PREFIX: string = 'user_collateral:';

  static getKey(userAddress: string, tokenAddress: string): StaticArray<u8> {
    return new Args().add(this.PREFIX + userAddress + ':' + tokenAddress).serialize();
  }

  static get(userAddress: string, tokenAddress: string): u256 {
    const key = this.getKey(userAddress, tokenAddress);
    if (!Storage.has<StaticArray<u8>>(key)) {
      return u256.Zero;
    }
    const data = Storage.get<StaticArray<u8>>(key);
    return bytesToU256(data);
  }

  static set(userAddress: string, tokenAddress: string, amount: u256): void {
    const key = this.getKey(userAddress, tokenAddress);
    Storage.set<StaticArray<u8>>(key, u256ToBytes(amount));
  }

  static has(userAddress: string, tokenAddress: string): bool {
    return Storage.has<StaticArray<u8>>(this.getKey(userAddress, tokenAddress));
  }
}

/**
 * Storage for user debt (borrowed amounts)
 * Key: user_address:token_address
 * Value: u256 (borrowed amount)
 */
export class UserDebtStorage {
  private static PREFIX: string = 'user_debt:';

  static getKey(userAddress: string, tokenAddress: string): StaticArray<u8> {
    return new Args().add(this.PREFIX + userAddress + ':' + tokenAddress).serialize();
  }

  static get(userAddress: string, tokenAddress: string): u256 {
    const key = this.getKey(userAddress, tokenAddress);
    if (!Storage.has<StaticArray<u8>>(key)) {
      return u256.Zero;
    }
    const data = Storage.get<StaticArray<u8>>(key);
    return bytesToU256(data);
  }

  static set(userAddress: string, tokenAddress: string, amount: u256): void {
    const key = this.getKey(userAddress, tokenAddress);
    Storage.set<StaticArray<u8>>(key, u256ToBytes(amount));
  }

  static has(userAddress: string, tokenAddress: string): bool {
    return Storage.has<StaticArray<u8>>(this.getKey(userAddress, tokenAddress));
  }
}

/**
 * Storage for user's last interaction timestamp (for interest calculation)
 * Key: user_address:token_address
 * Value: u64 (timestamp in milliseconds)
 */
export class UserLastUpdateStorage {
  private static PREFIX: string = 'user_last_update:';

  static getKey(userAddress: string, tokenAddress: string): string {
    return this.PREFIX + userAddress + ':' + tokenAddress;
  }

  static get(userAddress: string, tokenAddress: string): u64 {
    const key = this.getKey(userAddress, tokenAddress);
    if (!Storage.has(key)) {
      return 0;
    }
    return U64.parseInt(Storage.get(key));
  }

  static set(userAddress: string, tokenAddress: string, timestamp: u64): void {
    const key = this.getKey(userAddress, tokenAddress);
    Storage.set(key, timestamp.toString());
  }
}

/**
 * Storage for supported assets configuration
 * Key: token_address
 * Value: boolean (true if supported)
 */
export class SupportedAssetsStorage {
  private static PREFIX: string = 'supported_asset:';

  static getKey(tokenAddress: string): string {
    return this.PREFIX + tokenAddress;
  }

  static isSupported(tokenAddress: string): bool {
    return Storage.has(this.getKey(tokenAddress));
  }

  static add(tokenAddress: string): void {
    const key = this.getKey(tokenAddress);
    Storage.set(key, 'true');
  }

  static remove(tokenAddress: string): void {
    const key = this.getKey(tokenAddress);
    if (Storage.has(key)) {
      // Note: Massa doesn't have Storage.delete, so we set to empty
      Storage.set(key, '');
    }
  }
}

/**
 * Storage for asset prices (for simplicity, stored as u256)
 * In production, this should integrate with an oracle
 * Key: token_address
 * Value: u256 (price with 18 decimals, e.g., 1 token = 1e18 means $1)
 */
export class AssetPriceStorage {
  private static PREFIX: string = 'asset_price:';

  static getKey(tokenAddress: string): StaticArray<u8> {
    return new Args().add(this.PREFIX + tokenAddress).serialize();
  }

  static get(tokenAddress: string): u256 {
    const key = this.getKey(tokenAddress);
    if (!Storage.has<StaticArray<u8>>(key)) {
      return u256.Zero;
    }
    const data = Storage.get<StaticArray<u8>>(key);
    return bytesToU256(data);
  }

  static set(tokenAddress: string, price: u256): void {
    const key = this.getKey(tokenAddress);
    Storage.set<StaticArray<u8>>(key, u256ToBytes(price));
  }

  static has(tokenAddress: string): bool {
    return Storage.has<StaticArray<u8>>(this.getKey(tokenAddress));
  }
}

/**
 * Storage for total collateral per asset
 * Key: token_address
 * Value: u256 (total collateral amount)
 */
export class TotalCollateralStorage {
  private static PREFIX: string = 'total_collateral:';

  static getKey(tokenAddress: string): StaticArray<u8> {
    return new Args().add(this.PREFIX + tokenAddress).serialize();
  }

  static get(tokenAddress: string): u256 {
    const key = this.getKey(tokenAddress);
    if (!Storage.has<StaticArray<u8>>(key)) {
      return u256.Zero;
    }
    const data = Storage.get<StaticArray<u8>>(key);
    return bytesToU256(data);
  }

  static set(tokenAddress: string, amount: u256): void {
    const key = this.getKey(tokenAddress);
    Storage.set<StaticArray<u8>>(key, u256ToBytes(amount));
  }
}

/**
 * Storage for total borrows per asset
 * Key: token_address
 * Value: u256 (total borrowed amount)
 */
export class TotalBorrowsStorage {
  private static PREFIX: string = 'total_borrows:';

  static getKey(tokenAddress: string): StaticArray<u8> {
    return new Args().add(this.PREFIX + tokenAddress).serialize();
  }

  static get(tokenAddress: string): u256 {
    const key = this.getKey(tokenAddress);
    if (!Storage.has<StaticArray<u8>>(key)) {
      return u256.Zero;
    }
    const data = Storage.get<StaticArray<u8>>(key);
    return bytesToU256(data);
  }

  static set(tokenAddress: string, amount: u256): void {
    const key = this.getKey(tokenAddress);
    Storage.set<StaticArray<u8>>(key, u256ToBytes(amount));
  }
}

/**
 * Storage for tracking user's active assets
 * Key: user_address
 * Value: comma-separated list of token addresses
 */
export class UserAssetsStorage {
  private static PREFIX: string = 'user_assets:';

  static getKey(userAddress: string): string {
    return this.PREFIX + userAddress;
  }

  static getAssets(userAddress: string): string[] {
    const key = this.getKey(userAddress);
    if (!Storage.has(key)) {
      return [];
    }
    const assetsStr = Storage.get(key);
    if (assetsStr === '') return [];
    return assetsStr.split(',');
  }

  static addAsset(userAddress: string, tokenAddress: string): void {
    const assets = this.getAssets(userAddress);
    if (assets.indexOf(tokenAddress) === -1) {
      assets.push(tokenAddress);
      const key = this.getKey(userAddress);
      Storage.set(key, assets.join(','));
    }
  }

  static hasAsset(userAddress: string, tokenAddress: string): bool {
    const assets = this.getAssets(userAddress);
    return assets.indexOf(tokenAddress) !== -1;
  }
}

/**
 * Helper functions for simple storage operations
 */
export class SimpleStorage {
  static getString(key: string, defaultValue: string = ''): string {
    return Storage.has(key) ? Storage.get(key) : defaultValue;
  }

  static setString(key: string, value: string): void {
    Storage.set(key, value);
  }

  static getU64(key: string, defaultValue: u64 = 0): u64 {
    const keyBytes = stringToBytes(key);
    if (!Storage.has<StaticArray<u8>>(keyBytes)) return defaultValue;
    return bytesToU64(Storage.get<StaticArray<u8>>(keyBytes));
  }

  static setU64(key: string, value: u64): void {
    const keyBytes = stringToBytes(key);
    Storage.set<StaticArray<u8>>(keyBytes, u64ToBytes(value));
  }

  static getU32(key: string, defaultValue: u32 = 0): u32 {
    const keyBytes = stringToBytes(key);
    if (!Storage.has<StaticArray<u8>>(keyBytes)) return defaultValue;
    return bytesToU32(Storage.get<StaticArray<u8>>(keyBytes));
  }

  static setU32(key: string, value: u32): void {
    const keyBytes = stringToBytes(key);
    Storage.set<StaticArray<u8>>(keyBytes, u32ToBytes(value));
  }

  static getU256(key: string): u256 {
    const keyBytes = new Args().add(key).serialize();
    if (!Storage.has<StaticArray<u8>>(keyBytes)) return u256.Zero;
    const data = Storage.get<StaticArray<u8>>(keyBytes);
    return bytesToU256(data);
  }

  static setU256(key: string, value: u256): void {
    const keyBytes = new Args().add(key).serialize();
    Storage.set<StaticArray<u8>>(keyBytes, u256ToBytes(value));
  }

  static getBool(key: string, defaultValue: bool = false): bool {
    if (!Storage.has(key)) return defaultValue;
    const val = Storage.get(key);
    return val === 'true' || val === '1';
  }

  static setBool(key: string, value: bool): void {
    Storage.set(key, value ? 'true' : 'false');
  }
}
