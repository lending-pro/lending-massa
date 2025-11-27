import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { formatAmount, formatAPY, calculateHealthFactor } from '../utils/formatting';
import { DEFAULT_ASSETS, PROTOCOL_PARAMS } from '../utils/constants';
import HealthFactorGauge from './HealthFactorGauge';
import TransactionHistory from './TransactionHistory';

export default function Dashboard() {
  const { account, connected } = useWallet();
  const { getUserPosition, getBorrowRate, getMarketInfo } = useLendingPool();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    if (!account) return;

    setLoading(true);
    setError(null);
    try {
      const positionPromises = DEFAULT_ASSETS.map(async (asset) => {
        const [position, borrowRate, marketInfo] = await Promise.all([
          getUserPosition(asset.address),
          getBorrowRate(asset.address),
          getMarketInfo(asset.address, asset.decimals),
        ]);

        return {
          asset,
          position,
          borrowRate,
          supplyAPY: marketInfo?.supplyAPY || 0,
        };
      });

      const results = await Promise.all(positionPromises);
      setPositions(results.filter(r => r.position !== null));
    } catch (err) {
      console.error('Failed to load positions:', err);
      setError('Failed to load positions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [account, getUserPosition, getBorrowRate, getMarketInfo]);

  useEffect(() => {
    if (connected && account) {
      loadPositions();
    } else {
      setPositions([]);
      setLoading(false);
    }
  }, [connected, account, loadPositions]);

  if (!connected || !account) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 className="mt-2 text-lg font-medium text-white">Connect Your Wallet</h3>
        <p className="mt-1 text-sm text-slate-400">
          Connect your Massa wallet to view your lending positions
        </p>
      </div>
    );
  }

  const totalCollateral = positions.reduce((sum, p) => {
    return sum + BigInt(p.position?.collateralValue || '0');
  }, 0n);

  const totalDebt = positions.reduce((sum, p) => {
    return sum + BigInt(p.position?.debtValue || '0');
  }, 0n);

  const healthFactor = calculateHealthFactor(
    totalCollateral,
    totalDebt,
    PROTOCOL_PARAMS.LIQUIDATION_THRESHOLD
  );

  const utilizationRate = totalCollateral > 0n
    ? Number((totalDebt * 10000n) / totalCollateral) / 100
    : 0;

  // Calculate weighted average borrow APY
  const avgBorrowRate = positions.length > 0
    ? positions.reduce((sum, p) => sum + (p.borrowRate || 0), 0) / positions.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Left stats */}
        <div className="stat-card">
          <p className="text-sm text-slate-400 mb-1">Total Collateral</p>
          <p className="text-2xl font-bold text-white">
            ${formatAmount(totalCollateral, 18, 2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {PROTOCOL_PARAMS.COLLATERAL_FACTOR / 100}% available as collateral
          </p>
        </div>

        <div className="stat-card">
          <p className="text-sm text-slate-400 mb-1">Total Borrowed</p>
          <p className="text-2xl font-bold text-white">
            ${formatAmount(totalDebt, 18, 2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {avgBorrowRate > 0 ? `~${formatAPY(avgBorrowRate)} APY (accruing)` : 'No active loans'}
          </p>
        </div>

        {/* Health Factor Gauge */}
        <div className="stat-card flex items-center justify-center py-2">
          <HealthFactorGauge healthFactor={healthFactor} size="sm" />
        </div>

        <div className="stat-card">
          <p className="text-sm text-slate-400 mb-1">Utilization</p>
          <p className="text-2xl font-bold text-white">
            {utilizationRate.toFixed(2)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Liquidation at {PROTOCOL_PARAMS.LIQUIDATION_THRESHOLD / 100}%
          </p>
        </div>
      </div>

      {/* Interest Accrual Info */}
      {totalDebt > 0n && (
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-blue-400">Interest Accrual</h4>
              <p className="text-xs text-blue-300/80 mt-1">
                Your debt accrues interest continuously based on the borrow rate. The displayed debt balance includes all accrued interest.
                Repay regularly to minimize interest accumulation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={loadPositions}
              className="text-sm text-red-400 hover:text-red-300 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Positions Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Your Positions</h3>
          <button
            onClick={loadPositions}
            disabled={loading}
            className="flex items-center space-x-1 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            <p className="mt-2 text-sm text-slate-400">Loading positions...</p>
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400">No positions found</p>
            <p className="text-sm text-slate-500 mt-1">Deposit collateral to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Asset</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Collateral</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Borrowed</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Borrow APY</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Max Borrow</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(({ asset, position, borrowRate }) => (
                  <tr key={asset.address} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-white">{asset.symbol[0]}</span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{asset.symbol}</p>
                          <p className="text-xs text-slate-400">{asset.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="font-medium text-white">
                        {formatAmount(position.collateral, asset.decimals, 4)}
                      </p>
                      <p className="text-xs text-slate-400">
                        ${formatAmount(position.collateralValue, 18, 2)}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="font-medium text-white">
                        {formatAmount(position.debt, asset.decimals, 4)}
                      </p>
                      <p className="text-xs text-slate-400">
                        ${formatAmount(position.debtValue, 18, 2)}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-right text-primary-400 font-medium">
                      {formatAPY(borrowRate)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="font-medium text-white">
                        {formatAmount(position.maxBorrow, asset.decimals, 4)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multi-Asset Collateral Summary */}
      {positions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Collateral Breakdown */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Collateral Breakdown</h3>
            <div className="space-y-3">
              {positions.filter(p => BigInt(p.position?.collateral || '0') > 0n).map(({ asset, position, supplyAPY }) => {
                const collateralValue = BigInt(position?.collateralValue || '0');
                const percentage = totalCollateral > 0n
                  ? Number((collateralValue * 10000n) / totalCollateral) / 100
                  : 0;
                return (
                  <div key={asset.address} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{asset.symbol[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{asset.symbol}</p>
                        <p className="text-xs text-slate-400">
                          {formatAmount(position.collateral, asset.decimals, 4)} tokens
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">
                        ${formatAmount(collateralValue, 18, 2)}
                      </p>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-green-400">{supplyAPY > 0 ? supplyAPY.toFixed(2) : '0.00'}% APY</span>
                        <span className="text-xs text-slate-500">|</span>
                        <span className="text-xs text-slate-400">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {positions.filter(p => BigInt(p.position?.collateral || '0') > 0n).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No collateral deposited</p>
              )}
            </div>
          </div>

          {/* Debt Breakdown */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Debt Breakdown</h3>
            <div className="space-y-3">
              {positions.filter(p => BigInt(p.position?.debt || '0') > 0n).map(({ asset, position, borrowRate }) => {
                const debtValue = BigInt(position?.debtValue || '0');
                const percentage = totalDebt > 0n
                  ? Number((debtValue * 10000n) / totalDebt) / 100
                  : 0;
                return (
                  <div key={asset.address} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-700 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{asset.symbol[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{asset.symbol}</p>
                        <p className="text-xs text-slate-400">
                          {formatAmount(position.debt, asset.decimals, 4)} @ {formatAPY(borrowRate)} APY
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">
                        ${formatAmount(debtValue, 18, 2)}
                      </p>
                      <p className="text-xs text-slate-400">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
              {positions.filter(p => BigInt(p.position?.debt || '0') > 0n).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No active loans</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <TransactionHistory limit={5} />
    </div>
  );
}
