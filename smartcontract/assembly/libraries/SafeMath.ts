import { u256 } from 'as-bignum/assembly';
import { ZERO } from './Constants';

/**
 * SafeMath library for u256 operations with overflow/underflow protection
 */

export class SafeMath {
  /**
   * Adds two u256 values with overflow check
   */
  static add(a: u256, b: u256): u256 {
    const c = u256.add(a, b);
    assert(c >= a, 'SafeMath: addition overflow');
    return c;
  }

  /**
   * Subtracts two u256 values with underflow check
   */
  static sub(a: u256, b: u256): u256 {
    assert(b <= a, 'SafeMath: subtraction underflow');
    return u256.sub(a, b);
  }

  /**
   * Multiplies two u256 values with overflow check
   */
  static mul(a: u256, b: u256): u256 {
    if (a.isZero()) {
      return ZERO;
    }
    const c = u256.mul(a, b);
    assert(u256.eq(u256.div(c, a), b), 'SafeMath: multiplication overflow');
    return c;
  }

  /**
   * Divides two u256 values
   * Uses native u256.div for efficiency
   */
  static div(a: u256, b: u256): u256 {
    assert(u256.gt(b, ZERO), 'SafeMath: division by zero');
    return u256.div(a, b);
  }

  /**
   * Modulo operation
   */
  static mod(a: u256, b: u256): u256 {
    assert(!b.isZero(), 'SafeMath: modulo by zero');
    return u256.rem(a, b);
  }

  /**
   * Returns the minimum of two u256 values
   */
  static min(a: u256, b: u256): u256 {
    return a < b ? a : b;
  }

  /**
   * Returns the maximum of two u256 values
   */
  static max(a: u256, b: u256): u256 {
    return a > b ? a : b;
  }

  /**
   * Multiplies a u256 by a percentage (basis points)
   * @param value - The value to multiply
   * @param basisPoints - The percentage in basis points (10000 = 100%)
   * @returns value * (basisPoints / 10000)
   */
  static mulBP(value: u256, basisPoints: u32): u256 {
    if (value.isZero() || basisPoints == 0) {
      return ZERO;
    }
    const bpU256 = u256.from(basisPoints);
    const tenThousand = u256.from(10000);
    return SafeMath.div(SafeMath.mul(value, bpU256), tenThousand);
  }

  /**
   * Divides a u256 by a percentage (basis points)
   * @param value - The value to divide
   * @param basisPoints - The percentage in basis points (10000 = 100%)
   * @returns value / (basisPoints / 10000)
   */
  static divBP(value: u256, basisPoints: u32): u256 {
    assert(basisPoints > 0, 'SafeMath: division by zero basis points');
    const bpU256 = u256.from(basisPoints);
    const tenThousand = u256.from(10000);
    return SafeMath.div(SafeMath.mul(value, tenThousand), bpU256);
  }

  /**
   * Calculates percentage of a value
   * @param value - The value
   * @param numerator - The numerator
   * @param denominator - The denominator
   * @returns (value * numerator) / denominator
   */
  static percentage(value: u256, numerator: u256, denominator: u256): u256 {
    assert(u256.gt(denominator, ZERO), 'SafeMath: percentage division by zero');
    if (value.isZero() || numerator.isZero()) {
      return ZERO;
    }
    return SafeMath.div(SafeMath.mul(value, numerator), denominator);
  }

  /**
   * Converts a u64 to u256
   */
  static fromU64(value: u64): u256 {
    return u256.from(value);
  }

  /**
   * Converts a u32 to u256
   */
  static fromU32(value: u32): u256 {
    return u256.from(value);
  }

  /**
   * Checks if a u256 is zero
   */
  static isZero(value: u256): bool {
    return value.isZero();
  }

  /**
   * Checks if a u256 is greater than zero
   */
  static isPositive(value: u256): bool {
    return u256.gt(value, ZERO);
  }
}
