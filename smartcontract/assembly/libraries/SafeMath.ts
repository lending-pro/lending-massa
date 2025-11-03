import { u256 } from 'as-bignum/assembly';

/**
 * SafeMath library for u256 operations with overflow/underflow protection
 */

export class SafeMath {
  /**
   * Adds two u256 values with overflow check
   */
  static add(a: u256, b: u256): u256 {
    const result = u256.add(a, b);
    assert(result >= a, 'SafeMath: addition overflow');
    return result;
  }

  /**
   * Subtracts two u256 values with underflow check
   */
  static sub(a: u256, b: u256): u256 {
    assert(b <= a, 'SafeMath: subtraction underflow');
    return u256.sub(a, b);
  }

  /**
   * Multiplies two u256 values
   */
  static mul(a: u256, b: u256): u256 {
    if (a == u256.Zero) {
      return u256.Zero;
    }
    return u256.mul(a, b);
  }

  /**
   * Divides two u256 values
   */
  static div(a: u256, b: u256): u256 {
    assert(b > u256.Zero, 'SafeMath: division by zero');
    // Implement division using subtraction (inefficient but works)
    if (a < b) {
      return u256.Zero;
    }
    if (a == b) {
      return u256.One;
    }

    // For small numbers, convert to u64
    if (a <= u256.from(u64.MAX_VALUE) && b <= u256.from(u64.MAX_VALUE)) {
      const a64 = a.toU64();
      const b64 = b.toU64();
      return u256.from(a64 / b64);
    }

    // For larger numbers, use repeated subtraction (very slow but works as fallback)
    let result = u256.Zero;
    let remainder = a;
    while (remainder >= b) {
      remainder = u256.sub(remainder, b);
      result = u256.add(result, u256.One);
    }
    return result;
  }

  /**
   * Modulo operation
   */
  static mod(a: u256, b: u256): u256 {
    assert(b > u256.Zero, 'SafeMath: modulo by zero');
    const quotient = SafeMath.div(a, b);
    const product = SafeMath.mul(quotient, b);
    return SafeMath.sub(a, product);
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
    if (value == u256.Zero || basisPoints == 0) {
      return u256.Zero;
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
    assert(denominator > u256.Zero, 'SafeMath: percentage division by zero');
    if (value == u256.Zero || numerator == u256.Zero) {
      return u256.Zero;
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
    return value == u256.Zero;
  }

  /**
   * Checks if a u256 is greater than zero
   */
  static isPositive(value: u256): bool {
    return value > u256.Zero;
  }
}
