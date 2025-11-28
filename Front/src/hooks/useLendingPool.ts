import { useState, useCallback } from 'react';
import { useWallet, Args } from '../contexts/WalletContext';
import { LENDING_POOL_ADDRESS, DEFAULT_ASSETS, PROTOCOL_PARAMS } from '../utils/constants';
import { UserPosition } from '../types';
import { getERC20Balance, getERC20Allowance, readSmartContract } from '../utils/web3Provider';
import { saveTransaction } from '../components/TransactionHistory';

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
        const args = new Args().addString(tokenAddress).addU256(amount);
        const result = await callContract(LENDING_POOL_ADDRESS, 'depositCollateral', args);

        // Save transaction
        saveTransaction({
          type: 'deposit',
          asset: tokenAddress,
          amount: amount.toString(),
          timestamp: Date.now(),
          txHash: result?.id || `tx_${Date.now()}`,
          status: 'success',
        });

        return result;
      } catch (err) {
        console.error('Deposit error details:', err);
        saveTransaction({
          type: 'deposit',
          asset: tokenAddress,
          amount: amount.toString(),
          timestamp: Date.now(),
          txHash: `failed_${Date.now()}`,
          status: 'failed',
        });
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

        saveTransaction({
          type: 'withdraw',
          asset: tokenAddress,
          amount: amount.toString(),
          timestamp: Date.now(),
          txHash: result?.id || `tx_${Date.now()}`,
          status: 'success',
        });

        return result;
      } catch (err) {
        saveTransaction({
          type: 'withdraw',
          asset: tokenAddress,
          amount: amount.toString(),
          timestamp: Date.now(),
          txHash: `failed_${Date.now()}`,
          status: 'failed',
        });
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

        saveTransaction({
          type: 'borrow',
          asset: tokenAddress,
          amount: amount.toString(),
          timestamp: Date.now(),
          txHash: result?.id || `tx_${Date.now()}`,
          status: 'success',
        });

        return result;
      } catch (err) {
        saveTransaction({
          type: 'borrow',
          asset: tokenAddress,
          amount: amount.toString(),
          timestamp: Date.now(),
          txHash: `failed_${Date.now()}`,
          status: 'failed',
        });
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

        saveTransaction({
          type: 'repay',
          asset: tokenAddress,
          amount: amount.toString(),
          timestamp: Date.now(),
          txHash: result?.id || `tx_${Date.now()}`,
          status: 'success',
        });

        return result;
      } catch (err) {
        saveTransaction({
          type: 'repay',
          asset: tokenAddress,
          amount: amount.toString(),
          timestamp: Date.now(),
          txHash: `failed_${Date.now()}`,
          status: 'failed',
        });
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

        saveTransaction({
          type: 'liquidate',
          asset: debtToken,
          amount: debtAmount.toString(),
          timestamp: Date.now(),
          txHash: result?.id || `tx_${Date.now()}`,
          status: 'success',
        });

        return result;
      } catch (err) {
        saveTransaction({
          type: 'liquidate',
          asset: debtToken,
          amount: debtAmount.toString(),
          timestamp: Date.now(),
          txHash: `failed_${Date.now()}`,
          status: 'failed',
        });
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
        // Call the smart contract's getUserCollateral function
        const args = new Args().addString(userAddress).addString(tokenAddress);
        const result = await readSmartContract(LENDING_POOL_ADDRESS, 'getUserCollateral', args, userAddress);

        // console.log('getUserCollateral SC read:', {
        //   userAddress,
        //   tokenAddress,
        //   hasValue: !!result?.value,
        //   valueLength: result?.value?.length,
        // });

        if (result?.value && result.value.length > 0) {
          const resultArgs = new Args(result.value);
          const value = resultArgs.nextU256();
          // console.log('getUserCollateral parsed value:', value.toString());
          return value;
        }
        return 0n;
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
        // Call the smart contract's getUserDebt function
        const args = new Args().addString(userAddress).addString(tokenAddress);
        const result = await readSmartContract(LENDING_POOL_ADDRESS, 'getUserDebt', args, userAddress);

        // console.log('getUserDebt SC read:', {
        //   userAddress,
        //   tokenAddress,
        //   hasValue: !!result?.value,
        //   valueLength: result?.value?.length,
        // });

        if (result?.value && result.value.length > 0) {
          const resultArgs = new Args(result.value);
          const value = resultArgs.nextU256();
          // console.log('getUserDebt parsed value:', value.toString());
          return value;
        }
        return 0n;
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
        const args = new Args().addString(tokenAddress);
        const result = await readSmartContract(LENDING_POOL_ADDRESS, 'getBorrowRate', args);

        if (result?.value && result.value.length >= 4) {
          const resultArgs = new Args(result.value);
          const rate = resultArgs.nextU32();
          // console.log('getBorrowRate for', tokenAddress, ':', rate, 'basis points');
          return Number(rate);
        }
        return 200; // fallback to 2% APR
      } catch (err) {
        console.error('Get borrow rate error:', err);
        return 200; // fallback to 2% APR
      }
    },
    []
  );

  const getSupplyRate = useCallback(
    async (tokenAddress: string): Promise<number> => {
      try {
        const args = new Args().addString(tokenAddress);
        const result = await readSmartContract(LENDING_POOL_ADDRESS, 'getSupplyRate', args);

        if (result?.value && result.value.length >= 4) {
          const resultArgs = new Args(result.value);
          const rate = resultArgs.nextU32();
          return Number(rate);
        }
        return 0; // No supply interest if no utilization
      } catch (err) {
        console.error('Get supply rate error:', err);
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
          // SC returns: totalCollateralValue (u256), totalBorrowValue (u256), healthFactor (u256), isHealthy (bool)
          const resultArgs = new Args(result.value);
          const collateralValue = resultArgs.nextU256();
          const debtValue = resultArgs.nextU256();
          const healthFactor = resultArgs.nextU256();
          const isHealthy = resultArgs.nextBool();

          // console.log('getAccountHealth:', {
          //   collateralValue: collateralValue.toString(),
          //   debtValue: debtValue.toString(),
          //   healthFactor: healthFactor.toString(),
          //   isHealthy,
          // });

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

  const getTotalCollateral = useCallback(
    async (tokenAddress: string): Promise<bigint> => {
      try {
        // Call the smart contract's getTotalCollateral function
        const args = new Args().addString(tokenAddress);
        const result = await readSmartContract(LENDING_POOL_ADDRESS, 'getTotalCollateral', args);

        // console.log('getTotalCollateral SC read:', {
        //   tokenAddress,
        //   hasValue: !!result?.value,
        //   valueLength: result?.value?.length,
        // });

        if (result?.value && result.value.length > 0) {
          const resultArgs = new Args(result.value);
          const value = resultArgs.nextU256();
          // console.log('getTotalCollateral parsed value:', value.toString());
          return value;
        }
        return 0n;
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
        // Call the smart contract's getTotalBorrows function
        const args = new Args().addString(tokenAddress);
        const result = await readSmartContract(LENDING_POOL_ADDRESS, 'getTotalBorrows', args);

        // console.log('getTotalBorrows SC read:', {
        //   tokenAddress,
        //   hasValue: !!result?.value,
        //   valueLength: result?.value?.length,
        // });

        if (result?.value && result.value.length > 0) {
          const resultArgs = new Args(result.value);
          const value = resultArgs.nextU256();
          // console.log('getTotalBorrows parsed value:', value.toString());
          return value;
        }
        return 0n;
      } catch (err) {
        console.error('Get total borrows error:', err);
        return 0n;
      }
    },
    []
  );

  const getAssetPrice = useCallback(
    async (tokenAddress: string): Promise<bigint> => {
      try {
        const args = new Args().addString(tokenAddress);
        const result = await readSmartContract(LENDING_POOL_ADDRESS, 'getAssetPrice', args);

        if (result?.value && result.value.length > 0) {
          const resultArgs = new Args(result.value);
          const price = resultArgs.nextU256();
          // console.log('getAssetPrice for', tokenAddress, ':', price.toString());

          if (price > 0n) {
            return price;
          }
        }
      } catch (err) {
        console.error('Get asset price error:', err);
      }

      // Fallback to hardcoded prices if contract returns 0 or fails
      const PRICES: { [key: string]: bigint } = {
        'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ': 1000000000000000000n, // USDC = $1
        'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU': 190000000000000000n,  // WMAS = $0.19
        'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk': 2500000000000000000000n, // WETH = $2500
      };

      return PRICES[tokenAddress] || 0n;
    },
    []
  );

  // Internal helper to calculate max withdraw without re-fetching data
  const getMaxWithdrawInternal = async (
    _userAddress: string,
    _tokenAddress: string,
    userCollateral: bigint,
    health: { collateralValue: bigint; debtValue: bigint; healthFactor: bigint; isHealthy: boolean } | null,
    price: bigint,
    decimals: number
  ): Promise<bigint> => {
    try {
      if (userCollateral <= 0n) return 0n;

      // If no debt or no health data, can withdraw all
      if (!health || health.debtValue <= 0n) return userCollateral;

      const { collateralValue, debtValue } = health;

      // Calculate minimum collateral value needed to maintain HF > 1.1
      // minCollateralValue = debtValue * 11000 / liquidationThreshold
      const liquidationThreshold = BigInt(PROTOCOL_PARAMS.LIQUIDATION_THRESHOLD);
      const minCollateralValue = (debtValue * 11000n) / liquidationThreshold;

      // Add 1% safety buffer
      const safeMinCollateralValue = minCollateralValue + minCollateralValue / 100n;

      // Max withdrawable value in USD
      const maxWithdrawValueUSD = collateralValue > safeMinCollateralValue
        ? collateralValue - safeMinCollateralValue
        : 0n;

      if (maxWithdrawValueUSD <= 0n) return 0n;

      if (price <= 0n) return 0n;

      const tokenPrecision = BigInt(10 ** decimals);
      const maxWithdrawTokens = (maxWithdrawValueUSD * tokenPrecision) / price;

      // Can't withdraw more than deposited
      return maxWithdrawTokens < userCollateral ? maxWithdrawTokens : userCollateral;
    } catch (err) {
      console.error('Get max withdraw internal error:', err);
      return 0n;
    }
  };

  const getUserPosition = useCallback(
    async (tokenAddress: string): Promise<UserPosition | null> => {
      if (!account) return null;

      try {
        const [collateral, debt, price] = await Promise.all([
          getUserCollateral(account, tokenAddress),
          getUserDebt(account, tokenAddress),
          getAssetPrice(tokenAddress),
        ]);

        // Get token decimals from DEFAULT_ASSETS
        const asset = DEFAULT_ASSETS.find((a: { address: string }) => a.address === tokenAddress);
        const decimals = asset?.decimals || 18;

        // Calculate per-asset USD values (price is 18 decimals, result should be 18 decimals)
        // USD Value = amount * price / 10^tokenDecimals
        const tokenPrecision = BigInt(10 ** decimals);
        const collateralValue = (collateral * price) / tokenPrecision;
        const debtValue = (debt * price) / tokenPrecision;

        // Calculate max borrow (75% of collateral value)
        const maxBorrowValue = (collateralValue * 75n) / 100n;
        // Convert back to token amount: maxBorrowTokens = maxBorrowValue * 10^decimals / price
        const maxBorrow = price > 0n ? (maxBorrowValue * tokenPrecision) / price : 0n;

        // Get account health for health factor
        const health = await getAccountHealth(account);

        // Calculate max withdrawable amount using getMaxWithdraw
        const availableWithdraw = await getMaxWithdrawInternal(account, tokenAddress, collateral, health, price, decimals);

        return {
          collateral: collateral.toString(),
          debt: debt.toString(),
          collateralValue: collateralValue.toString(),
          debtValue: debtValue.toString(),
          healthFactor: health?.healthFactor.toString() || '0',
          maxBorrow: maxBorrow.toString(),
          availableWithdraw: availableWithdraw.toString(),
        };
      } catch (err) {
        console.error('Get user position error:', err);
        return null;
      }
    },
    [account, getUserCollateral, getUserDebt, getAssetPrice, getAccountHealth]
  );

  const getMarketInfo = useCallback(
    async (tokenAddress: string, decimals: number) => {
      try {
        const [totalCollateral, totalBorrows, borrowRateBP, supplyRateBP, price] = await Promise.all([
          getTotalCollateral(tokenAddress),
          getTotalBorrows(tokenAddress),
          getBorrowRate(tokenAddress),
          getSupplyRate(tokenAddress),
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

        // Get APY from contract rates (basis points to percentage)
        const borrowAPY = calculateAPY(borrowRateBP);
        const supplyAPY = calculateAPY(supplyRateBP);

        return {
          totalCollateral,
          totalBorrows,
          borrowRateBP,
          supplyRateBP,
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
    [getTotalCollateral, getTotalBorrows, getBorrowRate, getSupplyRate, getAssetPrice]
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
        // console.log('Approval result:', result);
        return result;
      } catch (err) {
        handleError(err, 'approve token');
      } finally {
        setLoading(false);
      }
    },
    [callContract]
  );

  // Calculate maximum borrowable amount for a specific asset
  // maxBorrow = (totalCollateralValue * collateralFactor / 10000 - totalDebtValue) * tokenPrecision / tokenPrice
  const getMaxBorrow = useCallback(
    async (userAddress: string, tokenAddress: string): Promise<bigint> => {
      try {
        // Get account health to get total collateral and debt values
        const health = await getAccountHealth(userAddress);
        if (!health) return 0n;

        const { collateralValue, debtValue } = health;

        // Calculate available borrow capacity in USD (18 decimals)
        // availableUSD = collateralValue * collateralFactor / 10000 - debtValue
        const collateralFactor = BigInt(PROTOCOL_PARAMS.COLLATERAL_FACTOR);
        const maxBorrowValueUSD = (collateralValue * collateralFactor) / 10000n - debtValue;

        if (maxBorrowValueUSD <= 0n) return 0n;

        // Get token price and decimals
        const price = await getAssetPrice(tokenAddress);
        if (price <= 0n) return 0n;

        const asset = DEFAULT_ASSETS.find(a => a.address === tokenAddress);
        const decimals = asset?.decimals || 18;
        const tokenPrecision = BigInt(10 ** decimals);

        // Convert USD value to token amount
        // maxBorrowTokens = maxBorrowValueUSD * tokenPrecision / price
        const maxBorrowTokens = (maxBorrowValueUSD * tokenPrecision) / price;

        // Also check pool liquidity
        const totalCollateral = await getTotalCollateral(tokenAddress);
        const totalBorrows = await getTotalBorrows(tokenAddress);
        const availableLiquidity = totalCollateral > totalBorrows ? totalCollateral - totalBorrows : 0n;

        // Return minimum of calculated max and available liquidity
        return maxBorrowTokens < availableLiquidity ? maxBorrowTokens : availableLiquidity;
      } catch (err) {
        console.error('Get max borrow error:', err);
        return 0n;
      }
    },
    [getAccountHealth, getAssetPrice, getTotalCollateral, getTotalBorrows]
  );

  // Calculate maximum withdrawable amount while keeping health factor > 1.1
  // Contract requires HF > 1.1 after withdrawal
  // HF = (collateralValue * liquidationThreshold / 10000) / debtValue
  // For HF > 1.1: collateralValue > debtValue * 11000 / liquidationThreshold
  const getMaxWithdraw = useCallback(
    async (userAddress: string, tokenAddress: string): Promise<bigint> => {
      try {
        // Get user's collateral for this asset
        const userCollateral = await getUserCollateral(userAddress, tokenAddress);
        if (userCollateral <= 0n) return 0n;

        // Get account health
        const health = await getAccountHealth(userAddress);
        if (!health) return userCollateral; // No debt, can withdraw all

        const { collateralValue, debtValue } = health;

        // If no debt, can withdraw all
        if (debtValue <= 0n) return userCollateral;

        // Calculate minimum collateral value needed to maintain HF > 1.1
        // minCollateralValue = debtValue * 11000 / liquidationThreshold
        // (11000 = 10000 * 1.1 for the 1.1 HF requirement)
        const liquidationThreshold = BigInt(PROTOCOL_PARAMS.LIQUIDATION_THRESHOLD);
        const minCollateralValue = (debtValue * 11000n) / liquidationThreshold;

        // Add 1% safety buffer for interest accrual and rounding
        const safetyBuffer = minCollateralValue / 100n;
        const safeMinCollateralValue = minCollateralValue + safetyBuffer;

        // Max withdrawable value in USD (with safety margin)
        const maxWithdrawValueUSD = collateralValue > safeMinCollateralValue
          ? collateralValue - safeMinCollateralValue
          : 0n;

        if (maxWithdrawValueUSD <= 0n) return 0n;

        // Get token price and decimals
        const price = await getAssetPrice(tokenAddress);
        if (price <= 0n) return 0n;

        const asset = DEFAULT_ASSETS.find(a => a.address === tokenAddress);
        const decimals = asset?.decimals || 18;
        const tokenPrecision = BigInt(10 ** decimals);

        // Convert USD value to token amount
        const maxWithdrawTokens = (maxWithdrawValueUSD * tokenPrecision) / price;

        // Can't withdraw more than deposited
        return maxWithdrawTokens < userCollateral ? maxWithdrawTokens : userCollateral;
      } catch (err) {
        console.error('Get max withdraw error:', err);
        return 0n;
      }
    },
    [getUserCollateral, getAccountHealth, getAssetPrice]
  );

  // Get all positions for multi-asset collateral view
  const getAllPositions = useCallback(
    async (userAddress: string) => {
      try {
        const positions = await Promise.all(
          DEFAULT_ASSETS.map(async (asset) => {
            const [collateral, debt, price] = await Promise.all([
              getUserCollateral(userAddress, asset.address),
              getUserDebt(userAddress, asset.address),
              getAssetPrice(asset.address),
            ]);

            const tokenPrecision = BigInt(10 ** asset.decimals);
            const collateralValueUSD = price > 0n ? (collateral * price) / tokenPrecision : 0n;
            const debtValueUSD = price > 0n ? (debt * price) / tokenPrecision : 0n;

            return {
              asset,
              collateral,
              debt,
              collateralValueUSD,
              debtValueUSD,
              price,
            };
          })
        );

        // Filter out positions with no activity
        return positions.filter(p => p.collateral > 0n || p.debt > 0n);
      } catch (err) {
        console.error('Get all positions error:', err);
        return [];
      }
    },
    [getUserCollateral, getUserDebt, getAssetPrice]
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
    getSupplyRate,
    getUserPosition,
    getAccountHealth,
    getTotalCollateral,
    getTotalBorrows,
    getAssetPrice,
    getMarketInfo,
    getTokenBalance,
    getAllowance,
    approveToken,
    getMaxBorrow,
    getMaxWithdraw,
    getAllPositions,
  };
}

// Helper function to convert APR basis points to percentage
// The smart contract uses simple interest, so we display APR (not compounded APY)
function calculateAPY(aprBasisPoints: number): number {
  // Safeguard against invalid values
  if (!aprBasisPoints || aprBasisPoints < 0 || aprBasisPoints > 100000 || !isFinite(aprBasisPoints)) {
    return 0;
  }

  // Simple conversion: basis points to percentage
  // 10000 basis points = 100%, so divide by 100 to get percentage
  const apr = aprBasisPoints / 100;

  // Check for unrealistic values
  if (!isFinite(apr) || apr < 0 || apr > 1000) {
    console.warn(`Unrealistic APR calculated from ${aprBasisPoints} basis points`);
    return 0;
  }

  return apr; // Return as percentage (e.g., 200 basis points = 2%)
}
