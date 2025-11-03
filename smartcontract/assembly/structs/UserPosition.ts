import { Args, Serializable, Result } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';

/**
 * Represents a user's lending position
 */
export class UserPosition implements Serializable {
  constructor(
    public collateralAmount: u256 = u256.Zero,
    public borrowedAmount: u256 = u256.Zero,
    public lastUpdateTimestamp: u64 = 0
  ) {}

  serialize(): StaticArray<u8> {
    const args = new Args()
      .add(this.collateralAmount)
      .add(this.borrowedAmount)
      .add(this.lastUpdateTimestamp);
    return args.serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    const collateralResult = args.nextU256();
    if (collateralResult.isErr()) {
      return new Result(offset, 'Failed to deserialize collateralAmount');
    }
    this.collateralAmount = collateralResult.unwrap();

    const borrowedResult = args.nextU256();
    if (borrowedResult.isErr()) {
      return new Result(offset, 'Failed to deserialize borrowedAmount');
    }
    this.borrowedAmount = borrowedResult.unwrap();

    const timestampResult = args.nextU64();
    if (timestampResult.isErr()) {
      return new Result(offset, 'Failed to deserialize lastUpdateTimestamp');
    }
    this.lastUpdateTimestamp = timestampResult.unwrap();

    return new Result(args.offset);
  }
}

/**
 * Represents account health information
 */
export class AccountHealth implements Serializable {
  constructor(
    public totalCollateralValue: u256 = u256.Zero,
    public totalBorrowValue: u256 = u256.Zero,
    public healthFactor: u256 = u256.Zero, // Scaled by 1e18
    public isHealthy: bool = true
  ) {}

  serialize(): StaticArray<u8> {
    const args = new Args()
      .add(this.totalCollateralValue)
      .add(this.totalBorrowValue)
      .add(this.healthFactor)
      .add(this.isHealthy);
    return args.serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    const collateralValueResult = args.nextU256();
    if (collateralValueResult.isErr()) {
      return new Result(offset, 'Failed to deserialize totalCollateralValue');
    }
    this.totalCollateralValue = collateralValueResult.unwrap();

    const borrowValueResult = args.nextU256();
    if (borrowValueResult.isErr()) {
      return new Result(offset, 'Failed to deserialize totalBorrowValue');
    }
    this.totalBorrowValue = borrowValueResult.unwrap();

    const healthFactorResult = args.nextU256();
    if (healthFactorResult.isErr()) {
      return new Result(offset, 'Failed to deserialize healthFactor');
    }
    this.healthFactor = healthFactorResult.unwrap();

    const isHealthyResult = args.nextBool();
    if (isHealthyResult.isErr()) {
      return new Result(offset, 'Failed to deserialize isHealthy');
    }
    this.isHealthy = isHealthyResult.unwrap();

    return new Result(args.offset);
  }
}

/**
 * Represents an asset's configuration
 */
export class AssetConfig implements Serializable {
  constructor(
    public tokenAddress: string = '',
    public isSupported: bool = false,
    public collateralFactor: u32 = 0, // Basis points (7500 = 75%)
    public liquidationThreshold: u32 = 0, // Basis points (8000 = 80%)
    public liquidationPenalty: u32 = 0, // Basis points (1000 = 10%)
    public decimals: u8 = 18
  ) {}

  serialize(): StaticArray<u8> {
    const args = new Args()
      .add(this.tokenAddress)
      .add(this.isSupported)
      .add(this.collateralFactor)
      .add(this.liquidationThreshold)
      .add(this.liquidationPenalty)
      .add(this.decimals);
    return args.serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    const tokenAddressResult = args.nextString();
    if (tokenAddressResult.isErr()) {
      return new Result(offset, 'Failed to deserialize tokenAddress');
    }
    this.tokenAddress = tokenAddressResult.unwrap();

    const isSupportedResult = args.nextBool();
    if (isSupportedResult.isErr()) {
      return new Result(offset, 'Failed to deserialize isSupported');
    }
    this.isSupported = isSupportedResult.unwrap();

    const collateralFactorResult = args.nextU32();
    if (collateralFactorResult.isErr()) {
      return new Result(offset, 'Failed to deserialize collateralFactor');
    }
    this.collateralFactor = collateralFactorResult.unwrap();

    const liquidationThresholdResult = args.nextU32();
    if (liquidationThresholdResult.isErr()) {
      return new Result(offset, 'Failed to deserialize liquidationThreshold');
    }
    this.liquidationThreshold = liquidationThresholdResult.unwrap();

    const liquidationPenaltyResult = args.nextU32();
    if (liquidationPenaltyResult.isErr()) {
      return new Result(offset, 'Failed to deserialize liquidationPenalty');
    }
    this.liquidationPenalty = liquidationPenaltyResult.unwrap();

    const decimalsResult = args.nextU8();
    if (decimalsResult.isErr()) {
      return new Result(offset, 'Failed to deserialize decimals');
    }
    this.decimals = decimalsResult.unwrap();

    return new Result(args.offset);
  }
}

/**
 * Interest rate model parameters
 */
export class InterestRateParams implements Serializable {
  constructor(
    public baseRate: u32 = 0, // Basis points (200 = 2% APY)
    public optimalUtilization: u32 = 0, // Basis points (8000 = 80%)
    public slope1: u32 = 0, // Basis points (400 = 4%)
    public slope2: u32 = 0 // Basis points (6000 = 60%)
  ) {}

  serialize(): StaticArray<u8> {
    const args = new Args()
      .add(this.baseRate)
      .add(this.optimalUtilization)
      .add(this.slope1)
      .add(this.slope2);
    return args.serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    const baseRateResult = args.nextU32();
    if (baseRateResult.isErr()) {
      return new Result(offset, 'Failed to deserialize baseRate');
    }
    this.baseRate = baseRateResult.unwrap();

    const optimalUtilizationResult = args.nextU32();
    if (optimalUtilizationResult.isErr()) {
      return new Result(offset, 'Failed to deserialize optimalUtilization');
    }
    this.optimalUtilization = optimalUtilizationResult.unwrap();

    const slope1Result = args.nextU32();
    if (slope1Result.isErr()) {
      return new Result(offset, 'Failed to deserialize slope1');
    }
    this.slope1 = slope1Result.unwrap();

    const slope2Result = args.nextU32();
    if (slope2Result.isErr()) {
      return new Result(offset, 'Failed to deserialize slope2');
    }
    this.slope2 = slope2Result.unwrap();

    return new Result(args.offset);
  }
}
