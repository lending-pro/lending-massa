import { u256 } from 'as-bignum/assembly';
import { SafeMath } from './SafeMath';

/**
 * BinHelper - Helper functions for converting Dusa bin IDs to prices
 * Based on: https://github.com/dusaprotocol/v1-core/blob/main/assembly/libraries/BinHelper.ts
 */
export class BinHelper {
  // Constants from Dusa Protocol
  private static readonly REAL_ID_SHIFT: i64 = 8388608; // 1 << 23
  private static readonly SCALE_OFFSET: u32 = 128;
  private static readonly BASIS_POINT_MAX: u64 = 10000;

  /**
   * Left shift helper: value << bits (multiply by 2^bits)
   */
  private static leftShift(value: u256, bits: u32): u256 {
    let result = value;
    for (let i: u32 = 0; i < bits; i++) {
      result = u256.add(result, result); // result * 2
    }
    return result;
  }

  /**
   * Right shift helper: value >> bits (divide by 2^bits)
   */
  private static rightShift(value: u256, bits: u32): u256 {
    let result = value;
    for (let i: u32 = 0; i < bits; i++) {
      // Divide by 2
      if (result <= u256.One) {
        result = u256.Zero;
        break;
      }
      // Use SafeMath for division
      result = SafeMath.div(result, u256.from(2));
    }
    return result;
  }

  /**
   * Converts a bin ID to price
   * @param id - Bin ID
   * @param binStep - Bin step (basis points, typically 1-100)
   * @returns Price as u256 (128.128-bit fixed point)
   */
  static getPriceFromId(id: u64, binStep: u64): u256 {
    assert(id <= u32.MAX_VALUE, 'BinHelper: ID overflows');

    const realId = i64(id) - BinHelper.REAL_ID_SHIFT;
    const bpValue = BinHelper._getBPValue(binStep);

    return BinHelper.power(bpValue, realId);
  }

  /**
   * Gets the basis point value as 128.128 fixed point
   * @param binStep - Bin step in basis points
   * @returns (1 + binStep/10000) as 128.128 fixed point
   */
  private static _getBPValue(binStep: u64): u256 {
    assert(binStep != 0 && binStep <= BinHelper.BASIS_POINT_MAX,
      'BinHelper: Bin step overflows');

    // Calculate: (1 << 128) + (binStep << 128) / 10000
    const one = BinHelper.leftShift(u256.One, BinHelper.SCALE_OFFSET);
    const stepScaled = BinHelper.leftShift(u256.from(binStep), BinHelper.SCALE_OFFSET);
    const increment = SafeMath.div(stepScaled, u256.from(BinHelper.BASIS_POINT_MAX));

    return u256.add(one, increment);
  }

  /**
   * Power function for fixed-point numbers using binary exponentiation
   * @param base - Base value (128.128 fixed point)
   * @param exponent - Exponent (can be negative)
   * @returns base^exponent as 128.128 fixed point
   */
  static power(base: u256, exponent: i64): u256 {
    if (exponent == 0) {
      // Return 1.0 in 128.128 fixed point
      return BinHelper.leftShift(u256.One, BinHelper.SCALE_OFFSET);
    }

    let result = BinHelper.leftShift(u256.One, BinHelper.SCALE_OFFSET); // 1.0
    let currentBase = base;
    let exp = exponent < 0 ? -exponent : exponent;

    // Binary exponentiation
    while (exp > 0) {
      if ((exp & 1) == 1) {
        // Multiply: result = (result * currentBase) >> 128
        result = BinHelper.rightShift(u256.mul(result, currentBase), BinHelper.SCALE_OFFSET);
      }

      // Square the base: currentBase = (currentBase * currentBase) >> 128
      currentBase = BinHelper.rightShift(u256.mul(currentBase, currentBase), BinHelper.SCALE_OFFSET);
      exp >>= 1;
    }

    // If exponent was negative, return 1/result
    if (exponent < 0) {
      // const one = BinHelper.leftShift(u256.One, BinHelper.SCALE_OFFSET);
      const oneSquared = BinHelper.leftShift(u256.One, BinHelper.SCALE_OFFSET * 2);
      result = SafeMath.div(oneSquared, result);
    }

    return result;
  }

  /**
   * Converts 128.128 fixed point to regular u256 with 18 decimals
   * @param fixedPoint - Price in 128.128 fixed point format
   * @returns Price scaled to 18 decimals (1e18 = 1.0)
   */
  static toDecimal18(fixedPoint: u256): u256 {
    // Convert from 128.128 to 1e18
    // fixedPoint is in format: integer_part * 2^128 + fractional_part
    // We want: (fixedPoint / 2^128) * 1e18

    const divisor = BinHelper.leftShift(u256.One, BinHelper.SCALE_OFFSET); // 2^128
    const multiplier = u256.from(1000000000000000000); // 1e18

    // (fixedPoint * 1e18) / 2^128
    return SafeMath.div(u256.mul(fixedPoint, multiplier), divisor);
  }

  /**
   * Calculates time-weighted average bin ID
   * @param sample1 - Earlier cumulative ID
   * @param sample2 - Later cumulative ID
   * @param timeDelta - Time difference in milliseconds
   * @returns Average bin ID
   */
  static calculateTWAP(sample1: u64, sample2: u64, timeDelta: u64): u64 {
    assert(timeDelta > 0, 'BinHelper: Time delta must be positive');
    assert(sample2 >= sample1, 'BinHelper: Invalid sample order');

    const diff = sample2 - sample1;
    return diff / timeDelta;
  }
}
