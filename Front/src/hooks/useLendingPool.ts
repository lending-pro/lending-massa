import { useState, useCallback } from 'react';
import { useWallet, Args } from '../contexts/WalletContext';
import { LENDING_POOL_ADDRESS } from '../utils/constants';
import { UserPosition } from '../types';
import { getERC20Balance, getERC20Allowance, readSmartContract, readStorageKeys, storageToU256 } from '../utils/web3Provider';

export function useLendingPool() {
  const { account, callContract } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = (err: any, action: string) => {
    const message = err instanceof Error ? err.message : `Failed to ${action}`;
    setError(message);
    console.error(`${action} error:`, err);
    throw new Error(message);
  };

  const depositCollateral = useCallback(
    async (tokenAddress: string, amount: bigint) => {
      setLoading(true);
      setError(null);
      try {
        console.log('Depositing collateral:', {
          tokenAddress,
          amount: amount.toString(),
          lendingPool: LENDING_POOL_ADDRESS,
        });

        const args = new Args().addString(tokenAddress).addU256(amount);
        console.log('Serialized args:', Array.from(args.serialize()));

        const result = await callContract(LENDING_POOL_ADDRESS, 'depositCollateral', args);
        console.log('Deposit result:', result);
        return result;
      } catch (err) {
        console.error('Deposit error details:', err);
        handleError(err, 'deposit collateral');
      } finally {
        setLoading(false);
      }
    },
    [callContract]
  );

  const withdrawCollateral = useCallback(
    async (tokenAddress: string, amount: bigint) => {
      setLoading(true);
      setError(null);
      try {
        const args = new Args().addString(tokenAddress).addU256(amount);
        const result = await callContract(LENDING_POOL_ADDRESS, 'withdrawCollateral', args);
        return result;
      } catch (err) {
        handleError(err, 'withdraw collateral');
      } finally {
        setLoading(false);
      }
    },
    [callContract]
  );

  const borrow = useCallback(
    async (tokenAddress: string, amount: bigint) => {
      setLoading(true);
      setError(null);
      try {
        const args = new Args().addString(tokenAddress).addU256(amount);
        const result = await callContract(LENDING_POOL_ADDRESS, 'borrow', args);
        return result;
      } catch (err) {
        handleError(err, 'borrow');
      } finally {
        setLoading(false);
      }
    },
    [callContract]
  );

  const repay = useCallback(
    async (tokenAddress: string, amount: bigint) => {
      setLoading(true);
      setError(null);
      try {
        const args = new Args().addString(tokenAddress).addU256(amount);
        const result = await callContract(LENDING_POOL_ADDRESS, 'repay', args);
        return result;
      } catch (err) {
        handleError(err, 'repay');
      } finally {
        setLoading(false);
      }
    },
    [callContract]
  );

  const liquidate = useCallback(
    async (
      borrower: string,
      collateralToken: string,
      debtToken: string,
      debtAmount: bigint
    ) => {
      setLoading(true);
      setError(null);
      try {
        const args = new Args()
          .addString(borrower)
          .addString(collateralToken)
          .addString(debtToken)
          .addU256(debtAmount);
        const result = await callContract(LENDING_POOL_ADDRESS, 'liquidate', args);
        return result;
      } catch (err) {
        handleError(err, 'liquidate');
      } finally {
        setLoading(false);
      }
    },
    [callContract]
  );

  const getUserCollateral = useCallback(
    async (userAddress: string, tokenAddress: string): Promise<bigint> => {
      try {
        // Read from storage directly: user_collateral:{userAddress}:{tokenAddress}
        const key = `user_collateral:${userAddress}:${tokenAddress}`;
        const results = await readStorageKeys(LENDING_POOL_ADDRESS, [key]);

        console.log('getUserCollateral storage read:', {
          key,
          hasData: !!results[0],
          dataLength: results[0]?.length,
          data: results[0] ? Array.from(results[0]) : [],
        });

        const value = storageToU256(results[0]);
        console.log('getUserCollateral parsed value:', value.toString());

        return value;
      } catch (err) {
        console.error('Get user collateral error:', err);
        return 0n;
      }
    },
    []
  );

  const getUserDebt = useCallback(
    async (userAddress: string, tokenAddress: string): Promise<bigint> => {
      try {
        // Read from storage directly: user_debt:{userAddress}:{tokenAddress}
        const key = `user_debt:${userAddress}:${tokenAddress}`;
        const results = await readStorageKeys(LENDING_POOL_ADDRESS, [key]);

        console.log('getUserDebt storage read:', {
          key,
          hasData: !!results[0],
          dataLength: results[0]?.length,
        });

        const value = storageToU256(results[0]);
        console.log('getUserDebt parsed value:', value.toString());

        return value;
      } catch (err) {
        console.error('Get user debt error:', err);
        return 0n;
      }
    },
    []
  );

  const getBorrowRate = useCallback(
    async (tokenAddress: string): Promise<number> => {
      try {
        // getBorrowRate is calculated dynamically, not stored
        // For now, return a hardcoded rate of 200 basis points (2%)
        // TODO: Calculate client-side using utilization and interest rate model parameters
        console.log('getBorrowRate: returning hardcoded 200 basis points (2%) for', tokenAddress);
        return 200; // 2% APR
      } catch (err) {
        console.error('Get borrow rate error:', err);
        return 0;
      }
    },
    []
  );

  const getAccountHealth = useCallback(
    async (userAddress: string): Promise<{ collateralValue: bigint; debtValue: bigint; healthFactor: bigint; isHealthy: boolean } | null> => {
      try {
        const args = new Args().addString(userAddress);
        const result = await readSmartContract(LENDING_POOL_ADDRESS, 'getAccountHealth', args, userAddress);

        if (result && result.value && result.value.length > 0) {
          // SC uses .add() which serializes each value as string
          const resultArgs = new Args(result.value);
          const collateralValue = BigInt(resultArgs.nextString());
          const debtValue = BigInt(resultArgs.nextString());
          const healthFactor = BigInt(resultArgs.nextString());
          const isHealthy = resultArgs.nextBool();

          return {
            collateralValue,
            debtValue,
            healthFactor,
            isHealthy,
          };
        }
        return null;
      } catch (err) {
        console.error('Get account health error:', err);
        return null;
      }
    },
    []
  );

  const getUserPosition = useCallback(
    async (tokenAddress: string): Promise<UserPosition | null> => {
      if (!account) return null;

      try {
        const [collateral, debt] = await Promise.all([
          getUserCollateral(account, tokenAddress),
          getUserDebt(account, tokenAddress),
        ]);

        // Get account health for complete info
        const health = await getAccountHealth(account);

        return {
          collateral: collateral.toString(),
          debt: debt.toString(),
          collateralValue: health?.collateralValue.toString() || '0',
          debtValue: health?.debtValue.toString() || '0',
          healthFactor: health?.healthFactor.toString() || '0',
          maxBorrow: '0', // TODO: Calculate based on collateral factor
          availableWithdraw: '0', // TODO: Calculate based on health factor
        };
      } catch (err) {
        console.error('Get user position error:', err);
        return null;
      }
    },
    [account, getUserCollateral, getUserDebt, getAccountHealth]
  );

  const getTotalCollateral = useCallback(
    async (tokenAddress: string): Promise<bigint> => {
      try {
        // Read from storage directly: total_collateral:{tokenAddress}
        const key = `total_collateral:${tokenAddress}`;
        const results = await readStorageKeys(LENDING_POOL_ADDRESS, [key]);

        console.log('getTotalCollateral storage read:', {
          key,
          tokenAddress,
          hasData: !!results[0],
          dataLength: results[0]?.length,
          data: results[0] ? Array.from(results[0]) : [],
        });

        const value = storageToU256(results[0]);
        console.log('getTotalCollateral parsed value:', value.toString());

        return value;
      } catch (err) {
        console.error('Get total collateral error:', err);
        return 0n;
      }
    },
    []
  );

  const getTotalBorrows = useCallback(
    async (tokenAddress: string): Promise<bigint> => {
      try {
        // Read from storage directly: total_borrows:{tokenAddress}
        const key = `total_borrows:${tokenAddress}`;
        const results = await readStorageKeys(LENDING_POOL_ADDRESS, [key]);

        console.log('getTotalBorrows storage read:', {
          key,
          tokenAddress,
          hasData: !!results[0],
          dataLength: results[0]?.length,
        });

        const value = storageToU256(results[0]);
        console.log('getTotalBorrows parsed value:', value.toString());

        return value;
      } catch (err) {
        console.error('Get total borrows error:', err);
        return 0n;
      }
    },
    []
  );

  const getAssetPrice = useCallback(
    async (tokenAddress: string): Promise<bigint> => {
      //       if (tokenAddress == 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ') return 1000000000000000000n
      // try {
      //   const args = new Args().addString(tokenAddress);
      //   const result = await readSmartContract(LENDING_POOL_ADDRESS, 'getAssetPrice', args);

      //   if (result && result.value) {
      //     const resultArgs = new Args(result.value);
      //     const price = BigInt(resultArgs.nextU256());

      //     if (price === 0n) {
      //       console.warn(`Price oracle returned 0 for token: ${tokenAddress}. Oracle may not be configured.`);
      //     }

      //     return price;
      //   }
      //   return 0n;
      // } catch (err) {
      //   console.error('Get asset price error:', err);
      //   return 0n;
      // }
      // Hardcoded prices - oracle not configured yet
      // USDC = $1, WMAS = $0.10, WETH = $2500 (update these as needed)
      const PRICES: { [key: string]: bigint } = {
        'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ': 1000000000000000000n, // USDC = $1
        'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU': 100000000000000000n,  // WMAS = $0.10
        'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk': 2500000000000000000000n, // WETH = $2500
      };

      // Return hardcoded price directly (oracle not set up)
      return PRICES[tokenAddress] || 0n;
    },
    []
  );

  const getMarketInfo = useCallback(
    async (tokenAddress: string, decimals: number) => {
      try {
        const [totalCollateral, totalBorrows, borrowRateBP, price] = await Promise.all([
          getTotalCollateral(tokenAddress),
          getTotalBorrows(tokenAddress),
          getBorrowRate(tokenAddress),
          getAssetPrice(tokenAddress),
        ]);

        // Calculate utilization rate
        const utilization = totalCollateral > 0n
          ? Number((totalBorrows * 10000n) / totalCollateral) / 100
          : 0;

        // Calculate TVL in USD (price is in 1e18 format)
        const tvlUSD = totalCollateral > 0n && price > 0n
          ? (totalCollateral * price) / BigInt(10 ** decimals)
          : 0n;

        // Calculate available liquidity
        const available = totalCollateral - totalBorrows;
        const availableUSD = available > 0n && price > 0n
          ? (available * price) / BigInt(10 ** decimals)
          : 0n;

        // Supply APY = Borrow APY × Utilization Rate
        const borrowAPY = calculateAPY(borrowRateBP);
        const supplyAPY = borrowAPY * (utilization / 100);

        return {
          totalCollateral,
          totalBorrows,
          borrowRateBP,
          borrowAPY,
          supplyAPY,
          utilization,
          tvlUSD,
          available,
          availableUSD,
          price,
        };
      } catch (err) {
        console.error('Get market info error:', err);
        return null;
      }
    },
    [getTotalCollateral, getTotalBorrows, getBorrowRate, getAssetPrice]
  );

  const getTokenBalance = useCallback(
    async (tokenAddress: string, userAddress: string): Promise<bigint> => {
      try {
        // Use the web3Provider for read-only ERC20 balance fetching
        return await getERC20Balance(tokenAddress, userAddress);
      } catch (err) {
        console.error('Get token balance error:', err);
        return 0n;
      }
    },
    []
  );

  const getAllowance = useCallback(
    async (tokenAddress: string, ownerAddress: string, spenderAddress: string): Promise<bigint> => {
      try {
        return await getERC20Allowance(tokenAddress, ownerAddress, spenderAddress);
      } catch (err) {
        console.error('Get allowance error:', err);
        return 0n;
      }
    },
    []
  );

  const approveToken = useCallback(
    async (tokenAddress: string, spenderAddress: string, amount: bigint) => {
      setLoading(true);
      setError(null);
      try {
        const args = new Args().addString(spenderAddress).addU256(amount);
        const result = await callContract(tokenAddress, 'increaseAllowance', args);
        console.log('Approval result:', result);
        return result;
      } catch (err) {
        handleError(err, 'approve token');
      } finally {
        setLoading(false);
      }
    },
    [callContract]
  );

  return {
    loading,
    error,
    depositCollateral,
    withdrawCollateral,
    borrow,
    repay,
    liquidate,
    getUserCollateral,
    getUserDebt,
    getBorrowRate,
    getUserPosition,
    getAccountHealth,
    getTotalCollateral,
    getTotalBorrows,
    getAssetPrice,
    getMarketInfo,
    getTokenBalance,
    getAllowance,
    approveToken,
  };
}

// Helper function to calculate APY from APR basis points
function calculateAPY(aprBasisPoints: number): number {
  // Safeguard against invalid values
  if (!aprBasisPoints || aprBasisPoints < 0 || aprBasisPoints > 100000 || !isFinite(aprBasisPoints)) {
    return 0;
  }

  const apr = aprBasisPoints / 10000; // Convert to decimal
  const compoundingPeriods = 365; // Daily compounding

  try {
    const apy = Math.pow(1 + apr / compoundingPeriods, compoundingPeriods) - 1;

    // Check for overflow or unrealistic values
    if (!isFinite(apy) || apy < 0 || apy > 1000) {
      console.warn(`Unrealistic APY calculated from ${aprBasisPoints} basis points`);
      return 0;
    }

    return apy * 100; // Return as percentage
  } catch (err) {
    console.error('APY calculation error:', err);
    return 0;
  }
}
