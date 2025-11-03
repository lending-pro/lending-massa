import { u256 } from 'as-bignum/assembly';
import { SafeMath } from './SafeMath';
import { Context } from '@massalabs/massa-as-sdk';

/**
 * Interest Rate Model using a two-slope model based on utilization
 *
 * The model works as follows:
 * - Below optimal utilization: baseRate + (utilization * slope1)
 * - Above optimal utilization: baseRate + (optimalUtil * slope1) + ((utilization - optimalUtil) * slope2)
 *
 * All rates are in basis points (10000 = 100%)
 */
export class InterestRateModel {
  /**
   * Calculates the utilization rate of a pool
   * @param totalBorrows - Total amount borrowed
   * @param totalDeposits - Total amount deposited
   * @returns Utilization rate in basis points (0-10000)
   */
  static calculateUtilization(totalBorrows: u256, totalDeposits: u256): u32 {
    if (SafeMath.isZero(totalDeposits)) {
      return 0;
    }

    // Calculate (totalBorrows * 10000) / totalDeposits
    const tenThousand = u256.from(10000);
    const utilization = SafeMath.div(
      SafeMath.mul(totalBorrows, tenThousand),
      totalDeposits
    );

    // Cap at 10000 (100%)
    if (utilization > tenThousand) {
      return 10000;
    }

    // Convert to u32 (safe because we capped at 10000)
    return u32(utilization.toU64());
  }

  /**
   * Calculates the borrow interest rate based on utilization
   * @param utilizationRate - Current utilization rate in basis points
   * @param baseRate - Base interest rate in basis points (e.g., 200 = 2% APY)
   * @param optimalUtilization - Optimal utilization rate in basis points (e.g., 8000 = 80%)
   * @param slope1 - Interest rate slope before optimal utilization (e.g., 400 = 4%)
   * @param slope2 - Interest rate slope after optimal utilization (e.g., 6000 = 60%)
   * @returns Borrow interest rate per year in basis points
   */
  static calculateBorrowRate(
    utilizationRate: u32,
    baseRate: u32,
    optimalUtilization: u32,
    slope1: u32,
    slope2: u32
  ): u32 {
    if (utilizationRate == 0) {
      return baseRate;
    }

    if (utilizationRate <= optimalUtilization) {
      // Below optimal: baseRate + (utilization * slope1 / optimalUtilization)
      const rateFromUtilization = (utilizationRate * slope1) / optimalUtilization;
      return baseRate + rateFromUtilization;
    } else {
      // Above optimal: baseRate + slope1 + ((utilization - optimal) * slope2 / (10000 - optimal))
      const excessUtilization = utilizationRate - optimalUtilization;
      const maxExcessUtilization = 10000 - optimalUtilization;
      const excessRate = (excessUtilization * slope2) / maxExcessUtilization;
      return baseRate + slope1 + excessRate;
    }
  }

  /**
   * Calculates the supply interest rate based on borrow rate and utilization
   * Supply rate = Borrow rate * Utilization rate
   * @param borrowRate - Current borrow rate in basis points
   * @param utilizationRate - Current utilization rate in basis points
   * @returns Supply interest rate per year in basis points
   */
  static calculateSupplyRate(borrowRate: u32, utilizationRate: u32): u32 {
    // supplyRate = (borrowRate * utilizationRate) / 10000
    return (borrowRate * utilizationRate) / 10000;
  }

  /**
   * Calculates accrued interest on a principal amount
   * @param principal - The principal amount
   * @param rate - Annual interest rate in basis points
   * @param timeDelta - Time elapsed in milliseconds
   * @returns Accrued interest amount
   */
  static calculateAccruedInterest(
    principal: u256,
    rate: u32,
    timeDelta: u64
  ): u256 {
    if (SafeMath.isZero(principal) || rate == 0 || timeDelta == 0) {
      return u256.Zero;
    }

    // Convert annual rate to per-second rate
    // rate is in basis points (10000 = 100%)
    // seconds per year = 365.25 * 24 * 60 * 60 = 31557600
    const SECONDS_PER_YEAR: u64 = 31557600;
    const timeInSeconds = timeDelta / 1000; // Convert milliseconds to seconds

    // Calculate interest = principal * rate * time / (10000 * SECONDS_PER_YEAR)
    const rateU256 = u256.from(rate);
    const timeU256 = u256.from(timeInSeconds);
    const secondsPerYearU256 = u256.from(SECONDS_PER_YEAR);
    const tenThousand = u256.from(10000);

    // interest = (principal * rate * time) / (10000 * SECONDS_PER_YEAR)
    const numerator = SafeMath.mul(SafeMath.mul(principal, rateU256), timeU256);
    const denominator = SafeMath.mul(tenThousand, secondsPerYearU256);

    return SafeMath.div(numerator, denominator);
  }

  /**
   * Calculates the new balance with compound interest
   * Uses simple interest approximation: newBalance = principal + interest
   * @param principal - The principal amount
   * @param rate - Annual interest rate in basis points
   * @param lastUpdateTime - Last update timestamp in milliseconds
   * @param currentTime - Current timestamp in milliseconds (optional, uses Context.timestamp() if not provided)
   * @returns New balance with accrued interest
   */
  static calculateBalanceWithInterest(
    principal: u256,
    rate: u32,
    lastUpdateTime: u64,
    currentTime: u64 = 0
  ): u256 {
    const now = currentTime > 0 ? currentTime : Context.timestamp();

    if (now <= lastUpdateTime) {
      return principal;
    }

    const timeDelta = now - lastUpdateTime;
    const interest = InterestRateModel.calculateAccruedInterest(principal, rate, timeDelta);

    return SafeMath.add(principal, interest);
  }

  /**
   * Validates interest rate parameters
   * @param baseRate - Base interest rate in basis points
   * @param optimalUtilization - Optimal utilization rate in basis points
   * @param slope1 - Interest rate slope before optimal
   * @param slope2 - Interest rate slope after optimal
   * @returns true if parameters are valid
   */
  static validateParameters(
    baseRate: u32,
    optimalUtilization: u32,
    slope1: u32,
    slope2: u32
  ): bool {
    // Base rate should be reasonable (less than 50%)
    if (baseRate > 5000) return false;

    // Optimal utilization should be between 50% and 95%
    if (optimalUtilization < 5000 || optimalUtilization > 9500) return false;

    // Slopes should be positive and reasonable
    if (slope1 == 0 || slope1 > 10000) return false;
    if (slope2 == 0 || slope2 > 20000) return false;

    // Slope2 should typically be higher than slope1
    // (but we won't enforce this as a hard rule)

    return true;
  }
}
