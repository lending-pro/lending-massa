import { u128 } from 'as-bignum/assembly/integer/u128';
import { u256 } from 'as-bignum/assembly/integer/u256';

/**
 * Constants used throughout the lending protocol
 * Based on: https://github.com/dusaprotocol/v1-core/blob/main/assembly/libraries/Constants.ts
 */

// Basic u256 constants
export const ZERO = u256.Zero;
export const ONE = u256.One;
export const TWO = u256.fromU64(2);
export const THREE = u256.fromU64(3);
export const MAX = u256.Max;
export const MAX_U128 = u256.from(u128.Max);

// Fixed-point constants
export const REAL_ID_SHIFT: i64 = 1 << 23;
export const ID_ONE: u32 = 2 ** 23;
export const SCALE_OFFSET: i32 = 128;
export const BASIS_POINT_MAX: u16 = 10_000;
export const PRECISION: u256 = u256.from(u64(10 ** 18));

// Bin step limits
export const MIN_BIN_STEP: u16 = 1;
export const MAX_BIN_STEP: u16 = 100;

// Fee limits
export const MAX_FEE: u64 = 10 ** 17; // 10%

// Coin precision
export const ONE_COIN: u64 = 10 ** 9;

// Pre-computed constants for BinHelper
export const ONE_128128 = u256.shl(ONE, SCALE_OFFSET);
export const INV_BP = u256.div(ONE_128128, u256.from(BASIS_POINT_MAX));
