import {
  Context,
  generateEvent,
  Storage,
  Address,
  transferredCoins,
  transferCoins
} from '@massalabs/massa-as-sdk';
import { Args, stringToBytes, bytesToString } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { SafeMath } from '../libraries/SafeMath';
import { InterestRateModel } from '../libraries/InterestRateModel';
import { BinHelper } from '../libraries/BinHelper';
import { IERC20, createTokenInterface } from '../interfaces/IERC20';
import { createDusaPairInterface } from '../interfaces/IDusaPair';
import {
  OWNER_KEY,
  INITIALIZED_KEY,
  PAUSED_KEY,
  BASE_RATE_KEY,
  OPTIMAL_UTILIZATION_KEY,
  SLOPE1_KEY,
  SLOPE2_KEY,
  COLLATERAL_FACTOR_KEY,
  LIQUIDATION_THRESHOLD_KEY,
  LIQUIDATION_PENALTY_KEY,
  UserCollateralStorage,
  UserDebtStorage,
  UserLastUpdateStorage,
  SupportedAssetsStorage,
  AssetPriceStorage,
  TotalCollateralStorage,
  TotalBorrowsStorage,
  UserAssetsStorage,
  SimpleStorage
} from '../storage/LendingPool';
import { UserPosition, AccountHealth } from '../structs/UserPosition';

// ============================================
// Constants
// ============================================

const BASIS_POINTS_DIVISOR: u32 = 10000; // 10000 = 100%
const PRICE_PRECISION: u256 = u256.fromU64(1000000000000000000); // 1e18
const ORACLE_ADDRESS_KEY = 'oracle_address';
const PRICE_MAX_AGE_KEY = 'price_max_age'; // Max age for price in milliseconds (default 10 minutes)
const TWAP_PERIOD_KEY = 'twap_period'; // TWAP period in milliseconds (default 5 minutes)
const ASSET_PAIR_PREFIX = 'asset_pair:'; // Prefix for storing Dusa pair addresses per asset

// ============================================
// Helper Functions
// ============================================

/**
 * Ensures the caller is the owner
 */
function onlyOwner(): void {
  const owner = SimpleStorage.getString(OWNER_KEY);
  assert(Context.caller().toString() == owner, 'Only owner can call this function');
}

/**
 * Ensures the contract is not paused
 */
function whenNotPaused(): void {
  assert(!SimpleStorage.getBool(PAUSED_KEY, false), 'Contract is paused');
}

/**
 * Ensures the contract is paused
 */
function whenPaused(): void {
  assert(SimpleStorage.getBool(PAUSED_KEY, false), 'Contract is not paused');
}

/**
 * Creates an event string from parameters
 */
function createEvent(name: string, params: string[]): string {
  return name + ':' + params.join(',');
}

// ============================================
// Constructor & Initialization
// ============================================

/**
 * Constructor - called once during deployment
 * Initializes the lending pool with default parameters
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  assert(Context.isDeployingContract(), 'Constructor can only be called during deployment');

  const args = new Args(binaryArgs);
  const owner = args.nextString().expect('Owner address is missing');

  // Set owner
  SimpleStorage.setString(OWNER_KEY, owner);
  SimpleStorage.setBool(INITIALIZED_KEY, true);
  SimpleStorage.setBool(PAUSED_KEY, false);

  // Set default interest rate parameters
  SimpleStorage.setU32(BASE_RATE_KEY, 200); // 2% base APY
  SimpleStorage.setU32(OPTIMAL_UTILIZATION_KEY, 8000); // 80% optimal utilization
  SimpleStorage.setU32(SLOPE1_KEY, 400); // 4% slope before optimal
  SimpleStorage.setU32(SLOPE2_KEY, 6000); // 60% slope after optimal

  // Set default risk parameters
  SimpleStorage.setU32(COLLATERAL_FACTOR_KEY, 7500); // 75% max LTV
  SimpleStorage.setU32(LIQUIDATION_THRESHOLD_KEY, 8000); // 80% liquidation threshold
  SimpleStorage.setU32(LIQUIDATION_PENALTY_KEY, 1000); // 10% liquidation penalty

  // Set default price staleness check (10 minutes)
  SimpleStorage.setU64(PRICE_MAX_AGE_KEY, 600000); // 10 minutes in milliseconds

  // Set default TWAP period (5 minutes)
  SimpleStorage.setU64(TWAP_PERIOD_KEY, 300); // 5 minutes in seconds

  generateEvent(createEvent('LendingPoolInitialized', [owner]));
}

// ============================================
// Core Lending Functions
// ============================================

/**
 * Deposit collateral into the lending pool
 * @param binaryArgs - Serialized arguments: tokenAddress (string), amount (u256)
 */
export function depositCollateral(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  whenNotPaused();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  // Validate
  assert(SupportedAssetsStorage.isSupported(tokenAddress), 'Asset not supported');
  assert(SafeMath.isPositive(amount), 'Amount must be greater than zero');

  const caller = Context.caller().toString();
  const currentTime = Context.timestamp();

  // Transfer tokens from caller to contract
  const token = createTokenInterface(tokenAddress);
  token.transferFrom(new Address(caller), Context.callee(), amount);

  // Update user collateral
  const currentCollateral = UserCollateralStorage.get(caller, tokenAddress);
  const newCollateral = SafeMath.add(currentCollateral, amount);
  UserCollateralStorage.set(caller, tokenAddress, newCollateral);

  // Track this asset for the user
  UserAssetsStorage.addAsset(caller, tokenAddress);

  // Update total collateral
  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  TotalCollateralStorage.set(tokenAddress, SafeMath.add(totalCollateral, amount));

  // Update timestamp
  UserLastUpdateStorage.set(caller, tokenAddress, currentTime);

  // Emit event
  generateEvent(createEvent('CollateralDeposited', [
    caller,
    tokenAddress,
    amount.toString()
  ]));

  return stringToBytes('Collateral deposited successfully');
}

/**
 * Withdraw collateral from the lending pool
 * @param binaryArgs - Serialized arguments: tokenAddress (string), amount (u256)
 */
export function withdrawCollateral(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  whenNotPaused();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  const caller = Context.caller().toString();
  const currentTime = Context.timestamp();

  // Get current collateral
  const currentCollateral = UserCollateralStorage.get(caller, tokenAddress);
  assert(currentCollateral >= amount, 'Insufficient collateral');

  // Update user debt with accrued interest before checking health
  _accrueInterest(caller, tokenAddress);

  // Calculate new collateral
  const newCollateral = SafeMath.sub(currentCollateral, amount);
  UserCollateralStorage.set(caller, tokenAddress, newCollateral);

  // Check account health after withdrawal
  const health = _calculateAccountHealth(caller);

  // If user has any debt, check health factor
  if (SafeMath.isPositive(health.totalBorrowValue)) {
    assert(health.isHealthy, 'Withdrawal would make account unhealthy');

    // Additional safety: require health factor > 1.1 (10% buffer)
    const minHealthFactor = SafeMath.mul(PRICE_PRECISION, u256.from(11));
    const minHealthFactorScaled = SafeMath.div(minHealthFactor, u256.from(10));
    assert(
      health.healthFactor >= minHealthFactorScaled,
      'Health factor too low after withdrawal (need >1.1)'
    );
  }

  // Update total collateral
  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  TotalCollateralStorage.set(tokenAddress, SafeMath.sub(totalCollateral, amount));

  // Transfer tokens to caller
  const token = createTokenInterface(tokenAddress);
  token.transfer(new Address(caller), amount);

  // Update timestamp
  UserLastUpdateStorage.set(caller, tokenAddress, currentTime);

  // Emit event
  generateEvent(createEvent('CollateralWithdrawn', [
    caller,
    tokenAddress,
    amount.toString()
  ]));

  return stringToBytes('Collateral withdrawn successfully');
}

/**
 * Borrow tokens against collateral
 * @param binaryArgs - Serialized arguments: tokenAddress (string), amount (u256)
 */
export function borrow(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  whenNotPaused();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  assert(SupportedAssetsStorage.isSupported(tokenAddress), 'Asset not supported');
  assert(SafeMath.isPositive(amount), 'Amount must be greater than zero');

  const caller = Context.caller().toString();
  const currentTime = Context.timestamp();

  // Accrue interest on existing debt
  _accrueInterest(caller, tokenAddress);

  // Update user debt
  const currentDebt = UserDebtStorage.get(caller, tokenAddress);
  const newDebt = SafeMath.add(currentDebt, amount);
  UserDebtStorage.set(caller, tokenAddress, newDebt);

  // Track this asset for the user
  UserAssetsStorage.addAsset(caller, tokenAddress);

  // Update total borrows
  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);
  TotalBorrowsStorage.set(tokenAddress, SafeMath.add(totalBorrows, amount));

  // Check account health after borrow
  const health = _calculateAccountHealth(caller);
  assert(health.isHealthy, 'Borrow would make account unhealthy');

  // Additional check: Ensure borrow doesn't exceed collateral factor
  const collateralFactor = SimpleStorage.getU32(COLLATERAL_FACTOR_KEY);
  const maxBorrowValue = SafeMath.mulBP(health.totalCollateralValue, collateralFactor);
  assert(
    health.totalBorrowValue <= maxBorrowValue,
    'Borrow exceeds maximum allowed (75% LTV)'
  );

  // Transfer tokens to caller
  const token = createTokenInterface(tokenAddress);
  token.transfer(new Address(caller), amount);

  // Update timestamp
  UserLastUpdateStorage.set(caller, tokenAddress, currentTime);

  // Emit event
  generateEvent(createEvent('TokensBorrowed', [
    caller,
    tokenAddress,
    amount.toString(),
    newDebt.toString()
  ]));

  return stringToBytes('Tokens borrowed successfully');
}

/**
 * Repay borrowed tokens
 * @param binaryArgs - Serialized arguments: tokenAddress (string), amount (u256)
 */
export function repay(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  whenNotPaused();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  const caller = Context.caller().toString();
  const currentTime = Context.timestamp();

  // Accrue interest on existing debt
  _accrueInterest(caller, tokenAddress);

  // Get current debt
  const currentDebt = UserDebtStorage.get(caller, tokenAddress);
  assert(SafeMath.isPositive(currentDebt), 'No debt to repay');

  // Calculate actual repay amount (can't repay more than debt)
  const actualAmount = SafeMath.min(amount, currentDebt);

  // Transfer tokens from caller to contract
  const token = createTokenInterface(tokenAddress);
  token.transferFrom(new Address(caller), Context.callee(), actualAmount);

  // Update user debt
  const newDebt = SafeMath.sub(currentDebt, actualAmount);
  UserDebtStorage.set(caller, tokenAddress, newDebt);

  // Update total borrows
  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);
  TotalBorrowsStorage.set(tokenAddress, SafeMath.sub(totalBorrows, actualAmount));

  // Update timestamp
  UserLastUpdateStorage.set(caller, tokenAddress, currentTime);

  // Emit event
  generateEvent(createEvent('DebtRepaid', [
    caller,
    tokenAddress,
    actualAmount.toString(),
    newDebt.toString()
  ]));

  return stringToBytes('Debt repaid successfully');
}

/**
 * Liquidate an unhealthy position
 * @param binaryArgs - Serialized arguments: borrower (string), collateralToken (string), debtToken (string), debtAmount (u256)
 */
export function liquidate(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  whenNotPaused();

  const args = new Args(binaryArgs);
  const borrower = args.nextString().expect('Borrower address is missing');
  const collateralToken = args.nextString().expect('Collateral token address is missing');
  const debtToken = args.nextString().expect('Debt token address is missing');
  const debtAmount = args.nextU256().expect('Debt amount is missing');

  const liquidator = Context.caller().toString();

  // Accrue interest on borrower's debt
  _accrueInterest(borrower, debtToken);

  // Check if borrower's position is unhealthy
  const health = _calculateAccountHealth(borrower);
  assert(!health.isHealthy, 'Position is healthy, cannot liquidate');

  // Get borrower's debt
  const borrowerDebt = UserDebtStorage.get(borrower, debtToken);
  assert(SafeMath.isPositive(borrowerDebt), 'No debt to liquidate');

  // Calculate actual liquidation amount (max 50% of debt)
  const maxLiquidation = SafeMath.div(borrowerDebt, u256.from(2));
  const actualLiquidationAmount = SafeMath.min(debtAmount, maxLiquidation);

  // Calculate collateral to seize
  const collateralPrice = AssetPriceStorage.get(collateralToken);
  const debtPrice = AssetPriceStorage.get(debtToken);
  assert(SafeMath.isPositive(collateralPrice), 'Collateral price not set');
  assert(SafeMath.isPositive(debtPrice), 'Debt price not set');

  // collateralToSeize = (debtAmount * debtPrice / collateralPrice) * (1 + liquidationPenalty)
  const debtValue = SafeMath.mul(actualLiquidationAmount, debtPrice);
  const collateralToSeize = SafeMath.div(debtValue, collateralPrice);

  const liquidationPenalty = SimpleStorage.getU32(LIQUIDATION_PENALTY_KEY);
  const collateralWithPenalty = SafeMath.add(
    collateralToSeize,
    SafeMath.mulBP(collateralToSeize, liquidationPenalty)
  );

  // Verify borrower has enough collateral
  const borrowerCollateral = UserCollateralStorage.get(borrower, collateralToken);
  assert(borrowerCollateral >= collateralWithPenalty, 'Insufficient collateral to seize');

  // Transfer debt tokens from liquidator to contract
  const debtTokenInterface = createTokenInterface(debtToken);
  debtTokenInterface.transferFrom(new Address(liquidator), Context.callee(), actualLiquidationAmount);

  // Update borrower's debt
  const newDebt = SafeMath.sub(borrowerDebt, actualLiquidationAmount);
  UserDebtStorage.set(borrower, debtToken, newDebt);

  // Update borrower's collateral
  const newCollateral = SafeMath.sub(borrowerCollateral, collateralWithPenalty);
  UserCollateralStorage.set(borrower, collateralToken, newCollateral);

  // Transfer collateral to liquidator
  const collateralTokenInterface = createTokenInterface(collateralToken);
  collateralTokenInterface.transfer(new Address(liquidator), collateralWithPenalty);

  // Update total borrows
  const totalBorrows = TotalBorrowsStorage.get(debtToken);
  TotalBorrowsStorage.set(debtToken, SafeMath.sub(totalBorrows, actualLiquidationAmount));

  // Update total collateral
  const totalCollateral = TotalCollateralStorage.get(collateralToken);
  TotalCollateralStorage.set(collateralToken, SafeMath.sub(totalCollateral, collateralWithPenalty));

  // Emit event
  generateEvent(createEvent('PositionLiquidated', [
    borrower,
    liquidator,
    debtToken,
    collateralToken,
    actualLiquidationAmount.toString(),
    collateralWithPenalty.toString()
  ]));

  return stringToBytes('Position liquidated successfully');
}

// ============================================
// Internal Helper Functions
// ============================================

/**
 * Accrues interest on a user's debt
 * @param user - User address
 * @param tokenAddress - Token address
 */
function _accrueInterest(user: string, tokenAddress: string): void {
  const currentDebt = UserDebtStorage.get(user, tokenAddress);

  if (SafeMath.isZero(currentDebt)) {
    return;
  }

  const lastUpdate = UserLastUpdateStorage.get(user, tokenAddress);
  const currentTime = Context.timestamp();

  if (currentTime <= lastUpdate) {
    return;
  }

  // Calculate current borrow rate
  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);
  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  const utilization = InterestRateModel.calculateUtilization(totalBorrows, totalCollateral);

  const baseRate = SimpleStorage.getU32(BASE_RATE_KEY);
  const optimalUtil = SimpleStorage.getU32(OPTIMAL_UTILIZATION_KEY);
  const slope1 = SimpleStorage.getU32(SLOPE1_KEY);
  const slope2 = SimpleStorage.getU32(SLOPE2_KEY);

  const borrowRate = InterestRateModel.calculateBorrowRate(
    utilization,
    baseRate,
    optimalUtil,
    slope1,
    slope2
  );

  // Calculate new debt with interest
  const newDebt = InterestRateModel.calculateBalanceWithInterest(
    currentDebt,
    borrowRate,
    lastUpdate,
    currentTime
  );

  // Update storage
  UserDebtStorage.set(user, tokenAddress, newDebt);
  UserLastUpdateStorage.set(user, tokenAddress, currentTime);
}

/**
 * Calculates account health for a user across all positions
 * @param user - User address
 * @returns AccountHealth struct
 */
function _calculateAccountHealth(user: string): AccountHealth {
  const health = new AccountHealth();
  let totalCollateralValue = u256.Zero;
  let totalBorrowValue = u256.Zero;

  // Get all assets the user has positions in
  const userAssets = UserAssetsStorage.getAssets(user);

  // Iterate through all user assets and calculate values
  for (let i = 0; i < userAssets.length; i++) {
    const tokenAddress = userAssets[i];

    // Skip if asset is not supported (edge case)
    if (!SupportedAssetsStorage.isSupported(tokenAddress)) {
      continue;
    }

    // Get asset price
    const price = _getAssetPrice(tokenAddress);
    if (SafeMath.isZero(price)) {
      // If price is not set, skip this asset (or could revert)
      continue;
    }

    // Calculate collateral value for this asset
    const collateral = UserCollateralStorage.get(user, tokenAddress);
    if (SafeMath.isPositive(collateral)) {
      const collateralValue = SafeMath.mul(collateral, price);
      const scaledCollateralValue = SafeMath.div(collateralValue, PRICE_PRECISION);
      totalCollateralValue = SafeMath.add(totalCollateralValue, scaledCollateralValue);
    }

    // Calculate debt value for this asset (with accrued interest)
    let debt = UserDebtStorage.get(user, tokenAddress);
    if (SafeMath.isPositive(debt)) {
      // Calculate debt with accrued interest
      const lastUpdate = UserLastUpdateStorage.get(user, tokenAddress);
      const currentTime = Context.timestamp();

      if (currentTime > lastUpdate) {
        // Get current borrow rate
        const totalBorrows = TotalBorrowsStorage.get(tokenAddress);
        const totalCollateralForAsset = TotalCollateralStorage.get(tokenAddress);
        const utilization = InterestRateModel.calculateUtilization(totalBorrows, totalCollateralForAsset);

        const baseRate = SimpleStorage.getU32(BASE_RATE_KEY);
        const optimalUtil = SimpleStorage.getU32(OPTIMAL_UTILIZATION_KEY);
        const slope1 = SimpleStorage.getU32(SLOPE1_KEY);
        const slope2 = SimpleStorage.getU32(SLOPE2_KEY);

        const borrowRate = InterestRateModel.calculateBorrowRate(
          utilization,
          baseRate,
          optimalUtil,
          slope1,
          slope2
        );

        // Calculate debt with interest
        debt = InterestRateModel.calculateBalanceWithInterest(
          debt,
          borrowRate,
          lastUpdate,
          currentTime
        );
      }

      const debtValue = SafeMath.mul(debt, price);
      const scaledDebtValue = SafeMath.div(debtValue, PRICE_PRECISION);
      totalBorrowValue = SafeMath.add(totalBorrowValue, scaledDebtValue);
    }
  }

  // Store values
  health.totalCollateralValue = totalCollateralValue;
  health.totalBorrowValue = totalBorrowValue;

  // Calculate health factor
  // Health Factor = (collateral * liquidationThreshold) / debt
  if (SafeMath.isZero(totalBorrowValue)) {
    // No debt = infinite health factor
    health.healthFactor = u256.from(0xFFFFFFFF); // Max value
    health.isHealthy = true;
  } else {
    const liquidationThreshold = SimpleStorage.getU32(LIQUIDATION_THRESHOLD_KEY);

    // Adjust collateral by liquidation threshold
    const adjustedCollateral = SafeMath.mulBP(totalCollateralValue, liquidationThreshold);

    // Calculate health factor (scaled by 1e18 for precision)
    // HF = (adjustedCollateral * 1e18) / totalBorrowValue
    const hfNumerator = SafeMath.mul(adjustedCollateral, PRICE_PRECISION);
    health.healthFactor = SafeMath.div(hfNumerator, totalBorrowValue);

    // Position is healthy if HF >= 1e18 (1.0)
    health.isHealthy = health.healthFactor >= PRICE_PRECISION;
  }

  return health;
}

/**
 * Gets asset price from storage or oracle
 * @param tokenAddress - Token address
 * @returns Price with 18 decimals
 */
function _getAssetPrice(tokenAddress: string): u256 {
  // First, check if we have a manually set price in storage
  const storedPrice = AssetPriceStorage.get(tokenAddress);

  // Try to get price from Dusa oracle
  const pairAddressKey = ASSET_PAIR_PREFIX + tokenAddress;
  const pairAddress = SimpleStorage.getString(pairAddressKey);

  if (pairAddress !== '') {
    const pair = createDusaPairInterface(pairAddress);

    // Get TWAP period (default 5 minutes)
    const twapPeriod = SimpleStorage.getU64(TWAP_PERIOD_KEY);

    // Get oracle samples for TWAP calculation
    // Sample 1: Current time
    const sample1 = pair.getOracleSampleFrom(0);

    // Sample 2: TWAP period ago
    const sample2 = pair.getOracleSampleFrom(twapPeriod);

    // Calculate time-weighted average bin ID
    const avgBinId = BinHelper.calculateTWAP(
      sample2.cumulativeId,
      sample1.cumulativeId,
      twapPeriod
    );

    // Get bin step for this pair
    const binStep = pair.getBinStep();

    // Convert bin ID to price (128.128 fixed point)
    const priceFixedPoint = BinHelper.getPriceFromId(avgBinId, binStep);

    // Convert to 18 decimals
    const price = BinHelper.toDecimal18(priceFixedPoint);

    // Validate price is reasonable
    if (SafeMath.isPositive(price)) {
      return price;
    }
  }

  if (SafeMath.isPositive(storedPrice)) {
    return storedPrice;
  }

  // No price found
  return u256.Zero;
}

// ============================================
// View Functions
// ============================================

/**
 * Get user's collateral balance for a specific token
 * @param binaryArgs - Serialized arguments: userAddress (string), tokenAddress (string)
 */
export function getUserCollateral(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args.nextString().expect('User address is missing');
  const tokenAddress = args.nextString().expect('Token address is missing');

  const collateral = UserCollateralStorage.get(userAddress, tokenAddress);

  return new Args().add(collateral).serialize();
}

/**
 * Get user's debt balance for a specific token (with accrued interest)
 * @param binaryArgs - Serialized arguments: userAddress (string), tokenAddress (string)
 */
export function getUserDebt(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args.nextString().expect('User address is missing');
  const tokenAddress = args.nextString().expect('Token address is missing');

  const currentDebt = UserDebtStorage.get(userAddress, tokenAddress);
  const lastUpdate = UserLastUpdateStorage.get(userAddress, tokenAddress);

  if (SafeMath.isZero(currentDebt)) {
    return new Args().add(u256.Zero).serialize();
  }

  // Calculate current borrow rate
  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);
  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  const utilization = InterestRateModel.calculateUtilization(totalBorrows, totalCollateral);

  const baseRate = SimpleStorage.getU32(BASE_RATE_KEY);
  const optimalUtil = SimpleStorage.getU32(OPTIMAL_UTILIZATION_KEY);
  const slope1 = SimpleStorage.getU32(SLOPE1_KEY);
  const slope2 = SimpleStorage.getU32(SLOPE2_KEY);

  const borrowRate = InterestRateModel.calculateBorrowRate(
    utilization,
    baseRate,
    optimalUtil,
    slope1,
    slope2
  );

  const currentTime = Context.timestamp();
  const debtWithInterest = InterestRateModel.calculateBalanceWithInterest(
    currentDebt,
    borrowRate,
    lastUpdate,
    currentTime
  );

  return new Args().add(debtWithInterest).serialize();
}

/**
 * Get current borrow rate for an asset
 * @param binaryArgs - Serialized arguments: tokenAddress (string)
 */
export function getBorrowRate(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');

  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);
  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  const utilization = InterestRateModel.calculateUtilization(totalBorrows, totalCollateral);

  const baseRate = SimpleStorage.getU32(BASE_RATE_KEY);
  const optimalUtil = SimpleStorage.getU32(OPTIMAL_UTILIZATION_KEY);
  const slope1 = SimpleStorage.getU32(SLOPE1_KEY);
  const slope2 = SimpleStorage.getU32(SLOPE2_KEY);

  const borrowRate = InterestRateModel.calculateBorrowRate(
    utilization,
    baseRate,
    optimalUtil,
    slope1,
    slope2
  );

  return new Args().add(borrowRate).serialize();
}

/**
 * Get total collateral for an asset
 * @param binaryArgs - Serialized arguments: tokenAddress (string)
 * @returns Serialized total collateral (u256)
 */
export function getTotalCollateral(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');

  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  return new Args().add(totalCollateral).serialize();
}

/**
 * Get total borrows for an asset
 * @param binaryArgs - Serialized arguments: tokenAddress (string)
 * @returns Serialized total borrows (u256)
 */
export function getTotalBorrows(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');

  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);
  return new Args().add(totalBorrows).serialize();
}

/**
 * Get asset price (public view of internal price function)
 * @param binaryArgs - Serialized arguments: tokenAddress (string)
 * @returns Serialized price with 18 decimals (u256)
 */
export function getAssetPrice(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');

  const price = _getAssetPrice(tokenAddress);
  return new Args().add(price).serialize();
}

// ============================================
// Admin Functions
// ============================================

/**
 * Add a supported asset
 * @param binaryArgs - Serialized arguments: tokenAddress (string)
 */
export function addSupportedAsset(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');

  SupportedAssetsStorage.add(tokenAddress);

  generateEvent(createEvent('AssetAdded', [tokenAddress]));

  return stringToBytes('Asset added successfully');
}

/**
 * Set asset price (in production, use an oracle)
 * @param binaryArgs - Serialized arguments: tokenAddress (string), price (u256)
 */
export function setAssetPrice(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const price = args.nextU256().expect('Price is missing');

  assert(SafeMath.isPositive(price), 'Price must be greater than zero');

  AssetPriceStorage.set(tokenAddress, price);

  generateEvent(createEvent('PriceUpdated', [tokenAddress, price.toString()]));

  return stringToBytes('Price updated successfully');
}

/**
 * Update interest rate parameters
 * @param binaryArgs - Serialized arguments: baseRate (u32), optimalUtil (u32), slope1 (u32), slope2 (u32)
 */
export function setInterestRateParams(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const baseRate = args.nextU32().expect('Base rate is missing');
  const optimalUtil = args.nextU32().expect('Optimal utilization is missing');
  const slope1 = args.nextU32().expect('Slope1 is missing');
  const slope2 = args.nextU32().expect('Slope2 is missing');

  assert(
    InterestRateModel.validateParameters(baseRate, optimalUtil, slope1, slope2),
    'Invalid interest rate parameters'
  );

  SimpleStorage.setU32(BASE_RATE_KEY, baseRate);
  SimpleStorage.setU32(OPTIMAL_UTILIZATION_KEY, optimalUtil);
  SimpleStorage.setU32(SLOPE1_KEY, slope1);
  SimpleStorage.setU32(SLOPE2_KEY, slope2);

  generateEvent(createEvent('InterestRateParamsUpdated', [
    baseRate.toString(),
    optimalUtil.toString(),
    slope1.toString(),
    slope2.toString()
  ]));

  return stringToBytes('Interest rate parameters updated successfully');
}

/**
 * Pause the contract
 */
export function pause(_: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();
  whenNotPaused();

  SimpleStorage.setBool(PAUSED_KEY, true);

  generateEvent('ContractPaused');

  return stringToBytes('Contract paused');
}

/**
 * Unpause the contract
 */
export function unpause(_: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();
  whenPaused();

  SimpleStorage.setBool(PAUSED_KEY, false);

  generateEvent('ContractUnpaused');

  return stringToBytes('Contract unpaused');
}

/**
 * Get contract owner
 */
export function getOwner(_: StaticArray<u8>): StaticArray<u8> {
  const owner = SimpleStorage.getString(OWNER_KEY);
  return stringToBytes(owner);
}

/**
 * Get account health for a user
 * @param binaryArgs - Serialized arguments: userAddress (string)
 */
export function getAccountHealth(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args.nextString().expect('User address is missing');

  const health = _calculateAccountHealth(userAddress);

  // Serialize the health data
  return new Args()
    .add(health.totalCollateralValue)
    .add(health.totalBorrowValue)
    .add(health.healthFactor)
    .add(health.isHealthy)
    .serialize();
}

/**
 * Set oracle address (owner only)
 * @param binaryArgs - Serialized arguments: oracleAddress (string)
 */
export function setOracleAddress(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const oracleAddress = args.nextString().expect('Oracle address is missing');

  SimpleStorage.setString(ORACLE_ADDRESS_KEY, oracleAddress);

  generateEvent(createEvent('OracleAddressUpdated', [oracleAddress]));

  return stringToBytes('Oracle address updated successfully');
}

/**
 * Set price max age (owner only)
 * @param binaryArgs - Serialized arguments: maxAge (u64) in milliseconds
 */
export function setPriceMaxAge(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const maxAge = args.nextU64().expect('Max age is missing');

  SimpleStorage.setU64(PRICE_MAX_AGE_KEY, maxAge);

  generateEvent(createEvent('PriceMaxAgeUpdated', [maxAge.toString()]));

  return stringToBytes('Price max age updated successfully');
}

/**
 * Set TWAP period (owner only)
 * @param binaryArgs - Serialized arguments: period (u64) in milliseconds
 */
export function setTWAPPeriod(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const period = args.nextU64().expect('Period is missing');

  assert(period > 0 && period <= 3600000, 'Period must be between 0 and 1 hour');

  SimpleStorage.setU64(TWAP_PERIOD_KEY, period);

  generateEvent(createEvent('TWAPPeriodUpdated', [period.toString()]));

  return stringToBytes('TWAP period updated successfully');
}

/**
 * Set Dusa pair address for an asset (owner only)
 * @param binaryArgs - Serialized arguments: tokenAddress (string), pairAddress (string)
 */
export function setAssetPair(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const pairAddress = args.nextString().expect('Pair address is missing');

  assert(SupportedAssetsStorage.isSupported(tokenAddress), 'Asset not supported');

  const pairAddressKey = ASSET_PAIR_PREFIX + tokenAddress;
  SimpleStorage.setString(pairAddressKey, pairAddress);

  generateEvent(createEvent('AssetPairUpdated', [tokenAddress, pairAddress]));

  return stringToBytes('Asset pair address updated successfully');
}

/**
 * Get user's active assets
 * @param binaryArgs - Serialized arguments: userAddress (string)
 */
export function getUserAssets(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args.nextString().expect('User address is missing');

  const assets = UserAssetsStorage.getAssets(userAddress);

  // Serialize array of strings
  const result = new Args();
  result.add(u32(assets.length));
  for (let i = 0; i < assets.length; i++) {
    result.add(assets[i]);
  }

  return result.serialize();
}

/**
 * Check if an address can be liquidated
 * @param binaryArgs - Serialized arguments: userAddress (string)
 */
export function canLiquidate(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args.nextString().expect('User address is missing');

  const health = _calculateAccountHealth(userAddress);

  return new Args().add(!health.isHealthy).serialize();
}
