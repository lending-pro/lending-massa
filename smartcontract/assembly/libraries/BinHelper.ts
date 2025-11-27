import { u256 } from 'as-bignum/assembly';
import {
  BASIS_POINT_MAX,
  MAX,
  MAX_U128,
  ONE,
  REAL_ID_SHIFT,
  SCALE_OFFSET,
  ZERO,
  ONE_128128,
  INV_BP,
} from './Constants';

/**
 * Square and shift helper for power calculation
 */
function sqrShift(v: u256): u256 {
  return u256.shr(u256.mul(v, v), SCALE_OFFSET);
}

/**
 * BinHelper - Helper functions for converting Dusa bin IDs to prices
 * Based on: https://github.com/dusaprotocol/v1-core/blob/main/assembly/libraries/BinHelper.ts
 */
export class BinHelper {
  /**
   * Returns the price corresponding to the given ID, as a 128.128-binary fixed-point number
   * @param id - the id
   * @param binStep - the bin step
   * @returns The price corresponding to this id, as a 128.128-binary fixed-point number
   */
  static getPriceFromId(id: u64, binStep: u16): u256 {
    assert(id <= U32.MAX_VALUE, 'BinHelper: ID overflows');
    return this.power(this._getBPValue(binStep), i64(id) - REAL_ID_SHIFT);
  }

  /**
   * Returns the (1 + bp) value as a 128.128-decimal fixed-point number
   * @param bp The bp value in [1; 100] (referring to 0.01% to 1%)
   * @return The (1+bp) value as a 128.128-decimal fixed-point number
   */
  static _getBPValue(bp: u16): u256 {
    assert(bp > 0 && bp <= BASIS_POINT_MAX, 'BinHelper: BinStep overflows');
    // can't overflow as `max(result) = 2**128 + 10_000 << 128 / 10_000 < max(u256)`
    return u256.add(ONE_128128, u256.mul(u256.from(bp), INV_BP));
  }

  /**
   * Returns the value of x^y. It calculates `1 / x^abs(y)` if x is bigger than 2^128.
   * At the end of the operations, we invert the result if needed.
   * @param x The unsigned 128.128-binary fixed-point number for which to calculate the power
   * @param y A relative number without any decimals, needs to be between ]-2^20; 2^20[
   * @return The result of `x^y`
   */
  static power(x: u256, y: i64): u256 {
    if (y == 0) return ONE_128128;
    let invert = false;

    let absY = y < 0 ? ((invert = true), -y) : y;

    assert(absY < 0x100000, 'BinHelper: Power underflow');

    let pow = x;
    if (u256.gt(x, MAX_U128)) {
      pow = u256.div(MAX, x);
      invert = !invert;
    }

    let result = ONE_128128;
    while (absY != 0) {
      if ((absY & 1) != 0) {
        result = u256.shr(u256.mul(result, pow), SCALE_OFFSET);
      }
      pow = sqrShift(pow);
      absY >>= 1;
    }

    // revert if y is too big or if x^y underflowed
    assert(result != ZERO, 'BinHelper: Power underflow');

    return invert ? u256.div(MAX, result) : result;
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

    const divisor = u256.shl(ONE, SCALE_OFFSET); // 2^128
    const multiplier = u256.from(1000000000000000000); // 1e18

    // (fixedPoint * 1e18) / 2^128
    return u256.div(u256.mul(fixedPoint, multiplier), divisor);
  }

  /**
   * Calculates time-weighted average bin ID
   * @param sample1 - Earlier cumulative ID
   * @param sample2 - Later cumulative ID
   * @param timeDelta - Time difference in seconds
   * @returns Average bin ID
   */
  static calculateTWAP(sample1: u64, sample2: u64, timeDelta: u64): u64 {
    assert(timeDelta > 0, 'BinHelper: Time delta must be positive');
    assert(sample2 >= sample1, 'BinHelper: Invalid sample order');

    const diff = sample2 - sample1;
    return diff / timeDelta;
  }
}
