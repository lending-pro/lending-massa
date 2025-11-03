import { Args, stringToBytes } from '@massalabs/massa-as-types';
import {
  constructor,
  depositCollateral,
  withdrawCollateral,
  borrow,
  repay,
  getUserCollateral,
  getUserDebt,
  getBorrowRate,
  addSupportedAsset,
  setAssetPrice,
} from '../contracts/LendingPool';
import { setDeployContext, Storage, resetStorage } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';

const OWNER_ADDRESS = 'AU12345678910';
const USER_ADDRESS = 'AU11111111111';
const TOKEN_ADDRESS = 'AS1token123456';

describe('Lending Pool Tests', () => {
  beforeEach(() => {
    resetStorage();
    setDeployContext(OWNER_ADDRESS);

    // Initialize contract
    const initArgs = new Args().add(OWNER_ADDRESS).serialize();
    constructor(initArgs);

    // Add supported asset
    const addAssetArgs = new Args().add(TOKEN_ADDRESS).serialize();
    addSupportedAsset(addAssetArgs);

    // Set asset price ($100 per token)
    const price = u256.fromU64(100).mul(u256.fromU64(1000000000000000000)); // $100 in 1e18
    const setPriceArgs = new Args()
      .add(TOKEN_ADDRESS)
      .add(price)
      .serialize();
    setAssetPrice(setPriceArgs);
  });

  describe('Constructor & Initialization', () => {
    test('should initialize with owner', () => {
      // Contract is initialized in beforeEach
      expect(Storage.has('owner')).toBe(true);
    });

    test('should set default parameters', () => {
      // Check that interest rate params are set
      const baseRate = Storage.get('base_rate');
      expect(baseRate).not.toBeNull();
    });
  });

  describe('Deposit Collateral', () => {
    test('should allow deposit of supported asset', () => {
      const depositAmount = u256.fromU64(1000);

      const args = new Args()
        .add(TOKEN_ADDRESS)
        .add(depositAmount)
        .serialize();

      // Note: In real test, would need to mock token.transferFrom
      // For now, this tests the argument structure
      expect(() => {
        depositCollateral(args);
      }).not.toThrow();
    });

    test('should reject deposit of unsupported asset', () => {
      const unsupportedToken = 'AS1unsupported';
      const depositAmount = u256.fromU64(1000);

      const args = new Args()
        .add(unsupportedToken)
        .add(depositAmount)
        .serialize();

      expect(() => {
        depositCollateral(args);
      }).toThrow();
    });
  });

  describe('Borrow Rate Calculation', () => {
    test('should return borrow rate for asset', () => {
      const args = new Args().add(TOKEN_ADDRESS).serialize();
      const result = getBorrowRate(args);

      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    test('should calculate rate based on utilization', () => {
      // Test that rate changes with utilization
      // This would require setting up deposits and borrows
      const args = new Args().add(TOKEN_ADDRESS).serialize();
      const rateAtZeroUtil = getBorrowRate(args);

      // After deposits and borrows, rate should be different
      // (Full implementation would test this)
      expect(rateAtZeroUtil).toBeTruthy();
    });
  });

  describe('View Functions', () => {
    test('should get user collateral', () => {
      const args = new Args()
        .add(USER_ADDRESS)
        .add(TOKEN_ADDRESS)
        .serialize();

      const result = getUserCollateral(args);
      expect(result).toBeTruthy();

      // Parse result
      const resultArgs = new Args(result);
      const collateral = resultArgs.nextU256();
      expect(collateral).toStrictEqual(u256.Zero);
    });

    test('should get user debt', () => {
      const args = new Args()
        .add(USER_ADDRESS)
        .add(TOKEN_ADDRESS)
        .serialize();

      const result = getUserDebt(args);
      expect(result).toBeTruthy();

      const resultArgs = new Args(result);
      const debt = resultArgs.nextU256();
      expect(debt).toStrictEqual(u256.Zero);
    });
  });

  describe('Access Control', () => {
    test('should allow owner to add asset', () => {
      const newToken = 'AS1newtoken';
      const args = new Args().add(newToken).serialize();

      setDeployContext(OWNER_ADDRESS);
      expect(() => {
        addSupportedAsset(args);
      }).not.toThrow();
    });

    test('should reject non-owner adding asset', () => {
      const newToken = 'AS1newtoken';
      const args = new Args().add(newToken).serialize();

      setDeployContext(USER_ADDRESS);
      expect(() => {
        addSupportedAsset(args);
      }).toThrow();
    });
  });

  // TODO: Add more comprehensive tests
  // - Test full deposit -> borrow -> repay flow
  // - Test liquidation logic
  // - Test interest accrual over time
  // - Test health factor calculations
  // - Test oracle integration
  // - Test edge cases (0 amounts, max amounts, etc.)
});

/**
 * NOTE: These are basic structural tests.
 * For production deployment, add:
 *
 * 1. Mock token contracts for transferFrom/transfer
 * 2. Full integration tests with multiple users
 * 3. Time-based tests for interest accrual
 * 4. Liquidation scenario tests
 * 5. Oracle price manipulation tests
 * 6. Gas usage tests
 * 7. Edge case tests (overflow, underflow, etc.)
 */
