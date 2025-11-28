import {
  Context,
  generateEvent,
  Address,
} from '@massalabs/massa-as-sdk';
import { Args, stringToBytes } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { SafeMath } from '../libraries/SafeMath';
import { InterestRateModel } from '../libraries/InterestRateModel';
import { BinHelper } from '../libraries/BinHelper';
import { createTokenInterface } from '../interfaces/IERC20';
import { createDusaPairInterface } from '../interfaces/IDusaPair';
import { createFlashLoanCallbackInterface } from '../interfaces/IFlashLoanCallback';
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
  RESERVE_FACTOR_KEY,
  TREASURY_KEY,
  CLOSE_FACTOR_KEY,
  LIQUIDATION_BONUS_MIN_KEY,
  LIQUIDATION_BONUS_MAX_KEY,
  FLASH_LOAN_FEE_KEY,
  FLASH_LOAN_ENABLED_KEY,
  REENTRANCY_GUARD_KEY,
  UserCollateralStorage,
  UserDebtStorage,
  UserLastUpdateStorage,
  SupportedAssetsStorage,
  AssetPriceStorage,
  TotalCollateralStorage,
  TotalBorrowsStorage,
  UserAssetsStorage,
  TreasuryReservesStorage,
  SupplyIndexStorage,
  UserSupplyIndexStorage,
  SimpleStorage
} from '../storage/LendingPool';
import { AccountHealth } from '../structs/UserPosition';

// ============================================
// Constants
// ============================================

const PRICE_PRECISION: u256 = u256.fromU64(1000000000000000000); // 1e18
const ORACLE_ADDRESS_KEY = 'oracle_address';
const PRICE_MAX_AGE_KEY = 'price_max_age'; // Max age for price in milliseconds (default 10 minutes)
const TWAP_PERIOD_KEY = 'twap_period'; // TWAP period in milliseconds (default 5 minutes)
const ASSET_PAIR_PREFIX = 'asset_pair:'; // Prefix for storing Dusa pair addresses per asset
const MAX_ASSETS_PER_USER: i32 = 10; // Maximum number of assets a user can have positions in

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
 * Reentrancy guard - acquire lock
 */
function nonReentrantStart(): void {
  assert(!SimpleStorage.getBool(REENTRANCY_GUARD_KEY, false), 'Reentrant call');
  SimpleStorage.setBool(REENTRANCY_GUARD_KEY, true);
}

/**
 * Reentrancy guard - release lock
 */
function nonReentrantEnd(): void {
  SimpleStorage.setBool(REENTRANCY_GUARD_KEY, false);
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

  // Set reserve factor (protocol fee on interest)
  SimpleStorage.setU32(RESERVE_FACTOR_KEY, 1000); // 10% of interest goes to protocol
  SimpleStorage.setString(TREASURY_KEY, owner); // Treasury initially set to owner

  // Set liquidation tuning parameters
  SimpleStorage.setU32(CLOSE_FACTOR_KEY, 5000); // 50% max liquidation at once
  SimpleStorage.setU32(LIQUIDATION_BONUS_MIN_KEY, 500); // 5% min bonus
  SimpleStorage.setU32(LIQUIDATION_BONUS_MAX_KEY, 1500); // 15% max bonus

  // Set flash loan parameters
  SimpleStorage.setU32(FLASH_LOAN_FEE_KEY, 9); // 0.09% flash loan fee
  SimpleStorage.setBool(FLASH_LOAN_ENABLED_KEY, true); // Flash loans enabled by default

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
  nonReentrantStart();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  // Validate
  assert(SupportedAssetsStorage.isSupported(tokenAddress), 'Asset not supported');
  assert(SafeMath.isPositive(amount), 'Amount must be greater than zero');

  const caller = Context.caller().toString();
  const currentTime = Context.timestamp();

  // Update supply index first (accrue interest for all depositors)
  _updateSupplyIndex(tokenAddress);

  // Transfer tokens from caller to contract
  const token = createTokenInterface(tokenAddress);
  token.transferFrom(new Address(caller), Context.callee(), amount);

  // Get current supply index
  const currentIndex = SupplyIndexStorage.get(tokenAddress);

  // If user has existing collateral, accrue their interest first
  const currentCollateral = UserCollateralStorage.get(caller, tokenAddress);
  let newCollateral = amount;

  if (SafeMath.isPositive(currentCollateral)) {
    // Calculate user's actual collateral with accrued interest
    const userIndex = UserSupplyIndexStorage.get(caller, tokenAddress);
    // actualCollateral = currentCollateral × currentIndex / userIndex
    const actualCollateral = SafeMath.div(
      SafeMath.mul(currentCollateral, currentIndex),
      userIndex
    );
    newCollateral = SafeMath.add(actualCollateral, amount);
  }

  UserCollateralStorage.set(caller, tokenAddress, newCollateral);

  // Update user's supply index to current (they are now "caught up")
  UserSupplyIndexStorage.set(caller, tokenAddress, currentIndex);

  // Track this asset for the user (with limit check)
  if (!UserAssetsStorage.hasAsset(caller, tokenAddress)) {
    const currentAssets = UserAssetsStorage.getAssets(caller);
    assert(currentAssets.length < MAX_ASSETS_PER_USER, 'Maximum assets per user exceeded');
  }
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

  nonReentrantEnd();
  return stringToBytes('Collateral deposited successfully');
}

/**
 * Withdraw collateral from the lending pool
 * @param binaryArgs - Serialized arguments: tokenAddress (string), amount (u256)
 */
export function withdrawCollateral(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  whenNotPaused();
  nonReentrantStart();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  const caller = Context.caller().toString();
  const currentTime = Context.timestamp();

  // Update supply index first (accrue interest for all depositors)
  _updateSupplyIndex(tokenAddress);

  // Get current supply index
  const currentIndex = SupplyIndexStorage.get(tokenAddress);

  // Get user's stored collateral
  const storedCollateral = UserCollateralStorage.get(caller, tokenAddress);

  // Calculate user's actual collateral with accrued interest
  // actualCollateral = storedCollateral × currentIndex / userIndex
  const userIndex = UserSupplyIndexStorage.get(caller, tokenAddress);
  const actualCollateral = SafeMath.div(
    SafeMath.mul(storedCollateral, currentIndex),
    userIndex
  );

  assert(actualCollateral >= amount, 'Insufficient collateral');

  // Update user debt with accrued interest before checking health
  _accrueInterest(caller, tokenAddress);

  // Calculate new collateral after withdrawal
  const newCollateral = SafeMath.sub(actualCollateral, amount);
  UserCollateralStorage.set(caller, tokenAddress, newCollateral);

  // Update user's supply index to current (they are now "caught up")
  UserSupplyIndexStorage.set(caller, tokenAddress, currentIndex);

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

  // if user has no collateral AND no debt in this asset, remove it from their list
  if (SafeMath.isZero(newCollateral)) {
    const debt = UserDebtStorage.get(caller, tokenAddress);
    if (SafeMath.isZero(debt)) {
      UserAssetsStorage.removeAsset(caller, tokenAddress);
    }
  }

  // Emit event
  generateEvent(createEvent('CollateralWithdrawn', [
    caller,
    tokenAddress,
    amount.toString()
  ]));

  nonReentrantEnd();
  return stringToBytes('Collateral withdrawn successfully');
}

/**
 * Check if a user has any debt across all assets
 * @param user - User address
 * @returns true if user has debt in any asset
 */
function _userHasAnyDebt(user: string): bool {
  const userAssets = UserAssetsStorage.getAssets(user);
  for (let i = 0; i < userAssets.length; i++) {
    const debt = UserDebtStorage.get(user, userAssets[i]);
    if (SafeMath.isPositive(debt)) {
      return true;
    }
  }
  return false;
}

/**
 * Emergency withdrawal when oracle is unavailable
 * Only allows users with NO debt to withdraw their collateral
 * This prevents users from being locked when oracle fails
 * @param binaryArgs - Serialized arguments: tokenAddress (string), amount (u256)
 */
export function emergencyWithdraw(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  // Emergency withdrawals work even when paused (that's the point)
  nonReentrantStart();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  const caller = Context.caller().toString();
  const currentTime = Context.timestamp();

  // Only allow emergency withdrawal if user has NO debt
  assert(!_userHasAnyDebt(caller), 'Emergency withdrawal not allowed: user has outstanding debt');

  // Update supply index first (accrue interest for all depositors)
  _updateSupplyIndex(tokenAddress);

  // Get current supply index
  const currentIndex = SupplyIndexStorage.get(tokenAddress);

  // Get user's stored collateral
  const storedCollateral = UserCollateralStorage.get(caller, tokenAddress);

  // Calculate user's actual collateral with accrued interest
  const userIndex = UserSupplyIndexStorage.get(caller, tokenAddress);
  const actualCollateral = SafeMath.div(
    SafeMath.mul(storedCollateral, currentIndex),
    userIndex
  );

  assert(actualCollateral >= amount, 'Insufficient collateral');

  // Calculate new collateral after withdrawal
  const newCollateral = SafeMath.sub(actualCollateral, amount);
  UserCollateralStorage.set(caller, tokenAddress, newCollateral);

  // Update user's supply index to current
  UserSupplyIndexStorage.set(caller, tokenAddress, currentIndex);

  // Update total collateral
  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  TotalCollateralStorage.set(tokenAddress, SafeMath.sub(totalCollateral, amount));

  // Transfer tokens to caller
  const token = createTokenInterface(tokenAddress);
  token.transfer(new Address(caller), amount);

  // Update timestamp
  UserLastUpdateStorage.set(caller, tokenAddress, currentTime);

  // if user has no collateral in this asset, remove it from their list
  if (SafeMath.isZero(newCollateral)) {
    UserAssetsStorage.removeAsset(caller, tokenAddress);
  }

  // Emit event
  generateEvent(createEvent('EmergencyWithdrawal', [
    caller,
    tokenAddress,
    amount.toString()
  ]));

  nonReentrantEnd();
  return stringToBytes('Emergency withdrawal successful');
}

/**
 * Borrow tokens against collateral
 * @param binaryArgs - Serialized arguments: tokenAddress (string), amount (u256)
 */
export function borrow(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  whenNotPaused();
  nonReentrantStart();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  assert(SupportedAssetsStorage.isSupported(tokenAddress), 'Asset not supported');
  assert(SafeMath.isPositive(amount), 'Amount must be greater than zero');

  const caller = Context.caller().toString();
  const currentTime = Context.timestamp();

  // Update supply index first (so depositors get interest from borrows)
  _updateSupplyIndex(tokenAddress);

  // Accrue interest on existing debt
  _accrueInterest(caller, tokenAddress);

  // Update user debt
  const currentDebt = UserDebtStorage.get(caller, tokenAddress);
  const newDebt = SafeMath.add(currentDebt, amount);
  UserDebtStorage.set(caller, tokenAddress, newDebt);

  // Track this asset for the user (with limit check)
  if (!UserAssetsStorage.hasAsset(caller, tokenAddress)) {
    const currentAssets = UserAssetsStorage.getAssets(caller);
    assert(currentAssets.length < MAX_ASSETS_PER_USER, 'Maximum assets per user exceeded');
  }
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

  nonReentrantEnd();
  return stringToBytes('Tokens borrowed successfully');
}

/**
 * Repay borrowed tokens
 * @param binaryArgs - Serialized arguments: tokenAddress (string), amount (u256)
 */
export function repay(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  whenNotPaused();
  nonReentrantStart();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  const caller = Context.caller().toString();
  const currentTime = Context.timestamp();

  // Update supply index first (so depositors get interest from repayments)
  _updateSupplyIndex(tokenAddress);

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

  // if user has no debt AND no collateral in this asset, remove it from their list
  if (SafeMath.isZero(newDebt)) {
    const collateral = UserCollateralStorage.get(caller, tokenAddress);
    if (SafeMath.isZero(collateral)) {
      UserAssetsStorage.removeAsset(caller, tokenAddress);
    }
  }

  // Emit event
  generateEvent(createEvent('DebtRepaid', [
    caller,
    tokenAddress,
    actualAmount.toString(),
    newDebt.toString()
  ]));

  nonReentrantEnd();
  return stringToBytes('Debt repaid successfully');
}

/**
 * Calculate dynamic liquidation bonus based on health factor
 * Lower health factor = higher bonus to incentivize liquidators
 * @param healthFactor - User's health factor (1e18 scaled)
 * @returns Liquidation bonus in basis points
 */
function _calculateLiquidationBonus(healthFactor: u256): u32 {
  const minBonus = SimpleStorage.getU32(LIQUIDATION_BONUS_MIN_KEY);
  const maxBonus = SimpleStorage.getU32(LIQUIDATION_BONUS_MAX_KEY);

  // If health factor >= 1.0 (1e18), use minimum bonus
  if (healthFactor >= PRICE_PRECISION) {
    return minBonus;
  }

  // If health factor <= 0.5 (5e17), use maximum bonus
  const halfPrecision = SafeMath.div(PRICE_PRECISION, u256.from(2));
  if (healthFactor <= halfPrecision) {
    return maxBonus;
  }

  // Linear interpolation between min and max bonus
  // bonus = maxBonus - ((healthFactor - 0.5) / 0.5) * (maxBonus - minBonus)
  // Rewritten for better precision: bonus = maxBonus - (hfAboveHalf * bonusRange / halfPrecision)
  const bonusRange = u256.fromU32(maxBonus - minBonus);
  const hfAboveHalf = SafeMath.sub(healthFactor, halfPrecision);

  // Calculate bonusReduction = (hfAboveHalf * bonusRange) / halfPrecision
  // This maintains precision by doing multiplication before division
  const numerator = SafeMath.mul(hfAboveHalf, bonusRange);
  const bonusReductionU256 = SafeMath.div(numerator, halfPrecision);

  // Safe conversion to u32 - bonusReduction should be <= bonusRange which is <= 5000
  const bonusReduction = u32(bonusReductionU256.toU64());

  // Ensure we don't underflow
  if (bonusReduction >= maxBonus - minBonus) {
    return minBonus;
  }

  return maxBonus - bonusReduction;
}

/**
 * Liquidate an unhealthy position
 * @param binaryArgs - Serialized arguments: borrower (string), collateralToken (string), debtToken (string), debtAmount (u256)
 */
export function liquidate(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  whenNotPaused();
  nonReentrantStart();

  const args = new Args(binaryArgs);
  const borrower = args.nextString().expect('Borrower address is missing');
  const collateralToken = args.nextString().expect('Collateral token address is missing');
  const debtToken = args.nextString().expect('Debt token address is missing');
  const debtAmount = args.nextU256().expect('Debt amount is missing');

  const liquidator = Context.caller().toString();

  // Update supply indices for both tokens (so depositors get accurate interest)
  _updateSupplyIndex(collateralToken);
  _updateSupplyIndex(debtToken);

  // Accrue interest on borrower's debt
  _accrueInterest(borrower, debtToken);

  // Check if borrower's position is unhealthy
  const health = _calculateAccountHealth(borrower);
  assert(!health.isHealthy, 'Position is healthy, cannot liquidate');

  // Get borrower's debt
  const borrowerDebt = UserDebtStorage.get(borrower, debtToken);
  assert(SafeMath.isPositive(borrowerDebt), 'No debt to liquidate');

  // Calculate actual liquidation amount based on close factor
  const closeFactor = SimpleStorage.getU32(CLOSE_FACTOR_KEY);
  const maxLiquidation = SafeMath.mulBP(borrowerDebt, closeFactor);
  const actualLiquidationAmount = SafeMath.min(debtAmount, maxLiquidation);

  // Calculate collateral to seize (use oracle integration)
  const collateralPrice = _getAssetPrice(collateralToken);
  const debtPrice = _getAssetPrice(debtToken);
  assert(SafeMath.isPositive(collateralPrice), 'Collateral price not available');
  assert(SafeMath.isPositive(debtPrice), 'Debt price not available');

  // collateralToSeize = (debtAmount * debtPrice / collateralPrice) * (1 + liquidationBonus)
  const debtValue = SafeMath.mul(actualLiquidationAmount, debtPrice);
  const collateralToSeize = SafeMath.div(debtValue, collateralPrice);

  // Calculate dynamic liquidation bonus based on health factor
  const liquidationBonus = _calculateLiquidationBonus(health.healthFactor);
  const collateralWithBonus = SafeMath.add(
    collateralToSeize,
    SafeMath.mulBP(collateralToSeize, liquidationBonus)
  );

  // Verify borrower has enough collateral
  const borrowerCollateral = UserCollateralStorage.get(borrower, collateralToken);
  assert(borrowerCollateral >= collateralWithBonus, 'Insufficient collateral to seize');

  // Transfer debt tokens from liquidator to contract
  const debtTokenInterface = createTokenInterface(debtToken);
  debtTokenInterface.transferFrom(new Address(liquidator), Context.callee(), actualLiquidationAmount);

  // Update borrower's debt
  const newDebt = SafeMath.sub(borrowerDebt, actualLiquidationAmount);
  UserDebtStorage.set(borrower, debtToken, newDebt);

  // Update borrower's collateral
  const newCollateral = SafeMath.sub(borrowerCollateral, collateralWithBonus);
  UserCollateralStorage.set(borrower, collateralToken, newCollateral);

  // Transfer collateral to liquidator
  const collateralTokenInterface = createTokenInterface(collateralToken);
  collateralTokenInterface.transfer(new Address(liquidator), collateralWithBonus);

  // Update total borrows
  const totalBorrows = TotalBorrowsStorage.get(debtToken);
  TotalBorrowsStorage.set(debtToken, SafeMath.sub(totalBorrows, actualLiquidationAmount));

  // Update total collateral
  const totalCollateral = TotalCollateralStorage.get(collateralToken);
  TotalCollateralStorage.set(collateralToken, SafeMath.sub(totalCollateral, collateralWithBonus));

  // Emit event
  generateEvent(createEvent('PositionLiquidated', [
    borrower,
    liquidator,
    debtToken,
    collateralToken,
    actualLiquidationAmount.toString(),
    collateralWithBonus.toString(),
    liquidationBonus.toString()
  ]));

  nonReentrantEnd();
  return stringToBytes('Position liquidated successfully');
}

// ============================================
// Internal Helper Functions
// ============================================

// Last time supply index was updated per asset
const SUPPLY_INDEX_LAST_UPDATE_PREFIX = 'supply_index_last_update:';

/**
 * Updates the global supply index for an asset
 * Supply interest = borrowRate × utilization × (1 - reserveFactor)
 * This should be called before any deposit/withdraw operation
 * @param tokenAddress - Token address
 */
function _updateSupplyIndex(tokenAddress: string): void {
  const lastUpdateKey = SUPPLY_INDEX_LAST_UPDATE_PREFIX + tokenAddress;
  const lastUpdate = SimpleStorage.getU64(lastUpdateKey, 0);
  const currentTime = Context.timestamp();

  if (currentTime <= lastUpdate) {
    return;
  }

  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);

  // Only accrue if there are deposits and borrows
  if (SafeMath.isZero(totalCollateral) || SafeMath.isZero(totalBorrows)) {
    SimpleStorage.setU64(lastUpdateKey, currentTime);
    return;
  }

  // Calculate utilization and rates
  const utilization = InterestRateModel.calculateUtilization(totalBorrows, totalCollateral);
  const baseRate = SimpleStorage.getU32(BASE_RATE_KEY);
  const optimalUtil = SimpleStorage.getU32(OPTIMAL_UTILIZATION_KEY);
  const slope1 = SimpleStorage.getU32(SLOPE1_KEY);
  const slope2 = SimpleStorage.getU32(SLOPE2_KEY);
  const reserveFactor = SimpleStorage.getU32(RESERVE_FACTOR_KEY);

  const borrowRate = InterestRateModel.calculateBorrowRate(
    utilization,
    baseRate,
    optimalUtil,
    slope1,
    slope2
  );

  // Supply rate = borrowRate × utilization × (1 - reserveFactor) / 10000
  // In basis points: supplyRate = borrowRate × utilization × (10000 - reserveFactor) / 10000 / 10000
  const supplyRateFactor = (10000 - reserveFactor);
  const supplyRate = (borrowRate * utilization * supplyRateFactor) / (10000 * 10000);

  if (supplyRate == 0) {
    SimpleStorage.setU64(lastUpdateKey, currentTime);
    return;
  }

  // Calculate time elapsed
  const timeDelta = currentTime - lastUpdate;
  if (timeDelta == 0) {
    return;
  }

  // Update supply index
  // newIndex = currentIndex × (1 + supplyRate × timeDelta / SECONDS_PER_YEAR / 10000)
  const currentIndex = SupplyIndexStorage.get(tokenAddress);
  const SECONDS_PER_YEAR: u64 = 31557600;
  const INDEX_PRECISION = u256.fromU64(1000000000000000000); // 1e18

  // indexIncrease = currentIndex × supplyRate × timeDelta / (SECONDS_PER_YEAR × 10000)
  const timeInSeconds = timeDelta / 1000;
  const numerator = SafeMath.mul(
    SafeMath.mul(currentIndex, u256.from(supplyRate)),
    u256.from(timeInSeconds)
  );
  const denominator = SafeMath.mul(u256.from(SECONDS_PER_YEAR), u256.from(10000));
  const indexIncrease = SafeMath.div(numerator, denominator);

  const newIndex = SafeMath.add(currentIndex, indexIncrease);
  SupplyIndexStorage.set(tokenAddress, newIndex);
  SimpleStorage.setU64(lastUpdateKey, currentTime);
}

/**
 * Accrues interest on a user's debt and collects protocol fees
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

  // Calculate interest accrued
  const interestAccrued = SafeMath.sub(newDebt, currentDebt);

  // Only proceed if there's actually interest accrued
  if (SafeMath.isPositive(interestAccrued)) {
    // Calculate protocol fee (reserve factor)
    const reserveFactor = SimpleStorage.getU32(RESERVE_FACTOR_KEY);
    if (reserveFactor > 0) {
      const protocolFee = SafeMath.mulBP(interestAccrued, reserveFactor);
      // Add to treasury reserves
      TreasuryReservesStorage.add(tokenAddress, protocolFee);
    }

    // Also update total borrows to include accrued interest
    // This ensures that when users repay (including interest), totalBorrows
    // doesn't underflow
    const updatedTotalBorrows = SafeMath.add(totalBorrows, interestAccrued);
    TotalBorrowsStorage.set(tokenAddress, updatedTotalBorrows);
  }

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

    // Get stored collateral and debt for this asset
    const storedCollateral = UserCollateralStorage.get(user, tokenAddress);
    let debt = UserDebtStorage.get(user, tokenAddress);

    // Calculate actual collateral with accrued interest
    let collateral = storedCollateral;
    if (SafeMath.isPositive(storedCollateral)) {
      const currentIndex = _calculateCurrentSupplyIndex(tokenAddress);
      const userIndex = UserSupplyIndexStorage.get(user, tokenAddress);
      // actualCollateral = storedCollateral × currentIndex / userIndex
      collateral = SafeMath.div(
        SafeMath.mul(storedCollateral, currentIndex),
        userIndex
      );
    }

    // Get asset price
    const price = _getAssetPrice(tokenAddress);

    // If user has debt in this asset, price MUST be valid
    // Otherwise debt would be hidden and position could appear healthy when it's not
    if (SafeMath.isPositive(debt)) {
      assert(SafeMath.isPositive(price), 'Price not set for asset with debt: ' + tokenAddress);
    }

    // If price is zero but user only has collateral, skip it
    // (conservative - collateral won't help but also won't hurt)
    if (SafeMath.isZero(price)) {
      continue;
    }

    // Calculate collateral value for this asset (with accrued interest)
    if (SafeMath.isPositive(collateral)) {
      // Get token decimals to normalize value to 18 decimals
      const token = createTokenInterface(tokenAddress);
      const tokenDecimals = token.decimals();
      const tokenPrecision = u256.fromU64(10 ** tokenDecimals);

      // USD Value (18 decimals) = amount * price / 10^tokenDecimals
      const collateralValue = SafeMath.mul(collateral, price);
      const scaledCollateralValue = SafeMath.div(collateralValue, tokenPrecision);
      totalCollateralValue = SafeMath.add(totalCollateralValue, scaledCollateralValue);
    }

    // Calculate debt value for this asset (with accrued interest)
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

      // Get token decimals to normalize value to 18 decimals
      const token = createTokenInterface(tokenAddress);
      const tokenDecimals = token.decimals();
      const tokenPrecision = u256.fromU64(10 ** tokenDecimals);

      // USD Value (18 decimals) = amount * price / 10^tokenDecimals
      const debtValue = SafeMath.mul(debt, price);
      const scaledDebtValue = SafeMath.div(debtValue, tokenPrecision);
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
 * Get user's collateral balance for a specific token (with accrued interest)
 * @param binaryArgs - Serialized arguments: userAddress (string), tokenAddress (string)
 */
export function getUserCollateral(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args.nextString().expect('User address is missing');
  const tokenAddress = args.nextString().expect('Token address is missing');

  const storedCollateral = UserCollateralStorage.get(userAddress, tokenAddress);

  if (SafeMath.isZero(storedCollateral)) {
    return new Args().add(u256.Zero).serialize();
  }

  // Calculate actual collateral with accrued interest
  // First, simulate updating the supply index without actually writing
  const currentIndex = _calculateCurrentSupplyIndex(tokenAddress);
  const userIndex = UserSupplyIndexStorage.get(userAddress, tokenAddress);

  // actualCollateral = storedCollateral × currentIndex / userIndex
  const actualCollateral = SafeMath.div(
    SafeMath.mul(storedCollateral, currentIndex),
    userIndex
  );

  return new Args().add(actualCollateral).serialize();
}

/**
 * Calculate current supply index without writing to storage (for view functions)
 * @param tokenAddress - Token address
 * @returns Current supply index
 */
function _calculateCurrentSupplyIndex(tokenAddress: string): u256 {
  const lastUpdateKey = SUPPLY_INDEX_LAST_UPDATE_PREFIX + tokenAddress;
  const lastUpdate = SimpleStorage.getU64(lastUpdateKey, 0);
  const currentTime = Context.timestamp();

  const currentIndex = SupplyIndexStorage.get(tokenAddress);

  if (currentTime <= lastUpdate) {
    return currentIndex;
  }

  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);

  // Only accrue if there are deposits and borrows
  if (SafeMath.isZero(totalCollateral) || SafeMath.isZero(totalBorrows)) {
    return currentIndex;
  }

  // Calculate utilization and rates
  const utilization = InterestRateModel.calculateUtilization(totalBorrows, totalCollateral);
  const baseRate = SimpleStorage.getU32(BASE_RATE_KEY);
  const optimalUtil = SimpleStorage.getU32(OPTIMAL_UTILIZATION_KEY);
  const slope1 = SimpleStorage.getU32(SLOPE1_KEY);
  const slope2 = SimpleStorage.getU32(SLOPE2_KEY);
  const reserveFactor = SimpleStorage.getU32(RESERVE_FACTOR_KEY);

  const borrowRate = InterestRateModel.calculateBorrowRate(
    utilization,
    baseRate,
    optimalUtil,
    slope1,
    slope2
  );

  // Supply rate = borrowRate × utilization × (1 - reserveFactor) / 10000
  const supplyRateFactor = (10000 - reserveFactor);
  const supplyRate = (borrowRate * utilization * supplyRateFactor) / (10000 * 10000);

  if (supplyRate == 0) {
    return currentIndex;
  }

  // Calculate time elapsed
  const timeDelta = currentTime - lastUpdate;
  if (timeDelta == 0) {
    return currentIndex;
  }

  // Calculate new index
  const SECONDS_PER_YEAR: u64 = 31557600;
  const timeInSeconds = timeDelta / 1000;
  const numerator = SafeMath.mul(
    SafeMath.mul(currentIndex, u256.from(supplyRate)),
    u256.from(timeInSeconds)
  );
  const denominator = SafeMath.mul(u256.from(SECONDS_PER_YEAR), u256.from(10000));
  const indexIncrease = SafeMath.div(numerator, denominator);

  return SafeMath.add(currentIndex, indexIncrease);
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
 * Get current supply rate for an asset (APY for depositors)
 * Supply rate = borrowRate × utilization × (1 - reserveFactor)
 * @param binaryArgs - Serialized arguments: tokenAddress (string)
 * @returns Serialized supply rate in basis points (u32)
 */
export function getSupplyRate(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');

  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);
  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  const utilization = InterestRateModel.calculateUtilization(totalBorrows, totalCollateral);

  const baseRate = SimpleStorage.getU32(BASE_RATE_KEY);
  const optimalUtil = SimpleStorage.getU32(OPTIMAL_UTILIZATION_KEY);
  const slope1 = SimpleStorage.getU32(SLOPE1_KEY);
  const slope2 = SimpleStorage.getU32(SLOPE2_KEY);
  const reserveFactor = SimpleStorage.getU32(RESERVE_FACTOR_KEY);

  const borrowRate = InterestRateModel.calculateBorrowRate(
    utilization,
    baseRate,
    optimalUtil,
    slope1,
    slope2
  );

  // Supply rate = borrowRate × utilization × (1 - reserveFactor) / 10000 / 10000
  // Result in basis points
  const supplyRateFactor = (10000 - reserveFactor);
  const supplyRate: u32 = u32((u64(borrowRate) * u64(utilization) * u64(supplyRateFactor)) / (10000 * 10000));

  return new Args().add(supplyRate).serialize();
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
 * Transfer ownership to a new address (owner only)
 * @param binaryArgs - Serialized arguments: newOwner (string)
 */
export function transferOwnership(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const newOwner = args.nextString().expect('New owner address is missing');

  assert(newOwner != '', 'New owner cannot be empty');

  const oldOwner = SimpleStorage.getString(OWNER_KEY);
  SimpleStorage.setString(OWNER_KEY, newOwner);

  generateEvent(createEvent('OwnershipTransferred', [oldOwner, newOwner]));

  return stringToBytes('Ownership transferred successfully');
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

// ============================================
// Flash Loan Functions
// ============================================

/**
 * Execute a flash loan (based on https://github.com/dusaprotocol/v1-core/blob/main/assembly/contracts/Pair.ts)
 *
 * @param binaryArgs - Serialized arguments: receiver (string), tokenAddress (string), amount (u256)
 */
export function flashLoan(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  whenNotPaused();
  nonReentrantStart();

  // Check if flash loans are enabled
  assert(SimpleStorage.getBool(FLASH_LOAN_ENABLED_KEY, true), 'Flash loans are disabled');

  const args = new Args(binaryArgs);
  const receiverAddress = args.nextString().expect('Receiver address is missing');
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  assert(SupportedAssetsStorage.isSupported(tokenAddress), 'Asset not supported');
  assert(SafeMath.isPositive(amount), 'Amount must be greater than zero');

  // Get available liquidity
  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);
  const availableLiquidity = SafeMath.sub(totalCollateral, totalBorrows);
  assert(availableLiquidity >= amount, 'Insufficient liquidity for flash loan');

  // Calculate fee
  const flashLoanFee = SimpleStorage.getU32(FLASH_LOAN_FEE_KEY);
  const feeAmount = SafeMath.mulBP(amount, flashLoanFee);

  // Get token interface
  const token = createTokenInterface(tokenAddress);

  // Get balance before transfer
  const balanceBefore = token.balanceOf(Context.callee());

  // Transfer tokens to receiver
  token.transfer(new Address(receiverAddress), amount);

  // Call the receiver's flashLoanCallback function
  // Receiver must implement: flashLoanCallback(sender: Address, token: Address, amount: u256, fee: u256) => bool
  const receiver = createFlashLoanCallbackInterface(receiverAddress);
  const callbackSuccess = receiver.flashLoanCallback(
    Context.caller(),
    new Address(tokenAddress),
    amount,
    feeAmount
  );

  assert(callbackSuccess, 'Flash loan callback failed');

  // Verify repayment: balance must have increased by at least the fee amount
  // (receiver must have transferred back amount + fee)
  const balanceAfter = token.balanceOf(Context.callee());
  const expectedBalance = SafeMath.add(balanceBefore, feeAmount);

  assert(
    balanceAfter >= expectedBalance,
    'Flash loan not repaid: insufficient balance'
  );

  // Add fee to treasury reserves
  TreasuryReservesStorage.add(tokenAddress, feeAmount);

  // Emit event
  generateEvent(createEvent('FlashLoan', [
    Context.caller().toString(),
    receiverAddress,
    tokenAddress,
    amount.toString(),
    feeAmount.toString()
  ]));

  nonReentrantEnd();
  return stringToBytes('Flash loan executed successfully');
}

// ============================================
// Treasury & Reserve Factor Admin Functions
// ============================================

/**
 * Set reserve factor (owner only)
 * @param binaryArgs - Serialized arguments: reserveFactor (u32) in basis points
 */
export function setReserveFactor(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const reserveFactor = args.nextU32().expect('Reserve factor is missing');

  assert(reserveFactor <= 5000, 'Reserve factor cannot exceed 50%');

  SimpleStorage.setU32(RESERVE_FACTOR_KEY, reserveFactor);

  generateEvent(createEvent('ReserveFactorUpdated', [reserveFactor.toString()]));

  return stringToBytes('Reserve factor updated successfully');
}

/**
 * Set treasury address (owner only)
 * @param binaryArgs - Serialized arguments: treasuryAddress (string)
 */
export function setTreasuryAddress(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const treasuryAddress = args.nextString().expect('Treasury address is missing');

  SimpleStorage.setString(TREASURY_KEY, treasuryAddress);

  generateEvent(createEvent('TreasuryAddressUpdated', [treasuryAddress]));

  return stringToBytes('Treasury address updated successfully');
}

/**
 * Withdraw treasury reserves (owner only)
 * @param binaryArgs - Serialized arguments: tokenAddress (string), amount (u256)
 */
export function withdrawTreasuryReserves(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();
  nonReentrantStart();

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');
  const amount = args.nextU256().expect('Amount is missing');

  const currentReserves = TreasuryReservesStorage.get(tokenAddress);
  assert(currentReserves >= amount, 'Insufficient treasury reserves');

  // CRITICAL: Check that withdrawal won't drain user funds
  // Available liquidity = totalCollateral - totalBorrows
  const totalCollateral = TotalCollateralStorage.get(tokenAddress);
  const totalBorrows = TotalBorrowsStorage.get(tokenAddress);
  const availableLiquidity = totalCollateral > totalBorrows
    ? SafeMath.sub(totalCollateral, totalBorrows)
    : u256.Zero;

  assert(availableLiquidity >= amount, 'Insufficient pool liquidity for treasury withdrawal');

  const treasuryAddress = SimpleStorage.getString(TREASURY_KEY);
  assert(treasuryAddress != '', 'Treasury address not set');

  // Update reserves
  TreasuryReservesStorage.set(tokenAddress, SafeMath.sub(currentReserves, amount));

  // Transfer to treasury
  const token = createTokenInterface(tokenAddress);
  token.transfer(new Address(treasuryAddress), amount);

  generateEvent(createEvent('TreasuryWithdrawal', [
    tokenAddress,
    amount.toString(),
    treasuryAddress
  ]));

  nonReentrantEnd();
  return stringToBytes('Treasury reserves withdrawn successfully');
}

/**
 * Get treasury reserves for an asset
 * @param binaryArgs - Serialized arguments: tokenAddress (string)
 */
export function getTreasuryReserves(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('Token address is missing');

  const reserves = TreasuryReservesStorage.get(tokenAddress);

  return new Args().add(reserves).serialize();
}

/**
 * Get reserve factor
 */
export function getReserveFactor(_: StaticArray<u8>): StaticArray<u8> {
  const reserveFactor = SimpleStorage.getU32(RESERVE_FACTOR_KEY);
  return new Args().add(reserveFactor).serialize();
}

// ============================================
// Liquidation Tuning Admin Functions
// ============================================

/**
 * Set close factor (owner only)
 * @param binaryArgs - Serialized arguments: closeFactor (u32) in basis points
 */
export function setCloseFactor(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const closeFactor = args.nextU32().expect('Close factor is missing');

  assert(closeFactor >= 1000 && closeFactor <= 10000, 'Close factor must be between 10% and 100%');

  SimpleStorage.setU32(CLOSE_FACTOR_KEY, closeFactor);

  generateEvent(createEvent('CloseFactorUpdated', [closeFactor.toString()]));

  return stringToBytes('Close factor updated successfully');
}

/**
 * Set liquidation bonus range (owner only)
 * @param binaryArgs - Serialized arguments: minBonus (u32), maxBonus (u32) in basis points
 */
export function setLiquidationBonusRange(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const minBonus = args.nextU32().expect('Min bonus is missing');
  const maxBonus = args.nextU32().expect('Max bonus is missing');

  assert(minBonus <= maxBonus, 'Min bonus must be <= max bonus');
  assert(maxBonus <= 5000, 'Max bonus cannot exceed 50%');

  SimpleStorage.setU32(LIQUIDATION_BONUS_MIN_KEY, minBonus);
  SimpleStorage.setU32(LIQUIDATION_BONUS_MAX_KEY, maxBonus);

  generateEvent(createEvent('LiquidationBonusRangeUpdated', [minBonus.toString(), maxBonus.toString()]));

  return stringToBytes('Liquidation bonus range updated successfully');
}

/**
 * Get liquidation parameters
 */
export function getLiquidationParams(_: StaticArray<u8>): StaticArray<u8> {
  const closeFactor = SimpleStorage.getU32(CLOSE_FACTOR_KEY);
  const minBonus = SimpleStorage.getU32(LIQUIDATION_BONUS_MIN_KEY);
  const maxBonus = SimpleStorage.getU32(LIQUIDATION_BONUS_MAX_KEY);
  const liquidationThreshold = SimpleStorage.getU32(LIQUIDATION_THRESHOLD_KEY);

  return new Args()
    .add(closeFactor)
    .add(minBonus)
    .add(maxBonus)
    .add(liquidationThreshold)
    .serialize();
}

// ============================================
// Flash Loan Admin Functions
// ============================================

/**
 * Set flash loan fee (owner only)
 * @param binaryArgs - Serialized arguments: fee (u32) in basis points
 */
export function setFlashLoanFee(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const fee = args.nextU32().expect('Fee is missing');

  assert(fee <= 100, 'Flash loan fee cannot exceed 1%');

  SimpleStorage.setU32(FLASH_LOAN_FEE_KEY, fee);

  generateEvent(createEvent('FlashLoanFeeUpdated', [fee.toString()]));

  return stringToBytes('Flash loan fee updated successfully');
}

/**
 * Enable/disable flash loans (owner only)
 * @param binaryArgs - Serialized arguments: enabled (bool)
 */
export function setFlashLoanEnabled(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();

  const args = new Args(binaryArgs);
  const enabled = args.nextBool().expect('Enabled flag is missing');

  SimpleStorage.setBool(FLASH_LOAN_ENABLED_KEY, enabled);

  generateEvent(createEvent('FlashLoanEnabledUpdated', [enabled ? 'true' : 'false']));

  return stringToBytes(enabled ? 'Flash loans enabled' : 'Flash loans disabled');
}

/**
 * Get flash loan parameters
 */
export function getFlashLoanParams(_: StaticArray<u8>): StaticArray<u8> {
  const fee = SimpleStorage.getU32(FLASH_LOAN_FEE_KEY);
  const enabled = SimpleStorage.getBool(FLASH_LOAN_ENABLED_KEY, true);

  return new Args().add(fee).add(enabled).serialize();
}
