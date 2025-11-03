import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { formatAmount, formatAPY, calculateHealthFactor } from '../utils/formatting';
import { DEFAULT_ASSETS, PROTOCOL_PARAMS } from '../utils/constants';

export default function Dashboard() {
  const { account } = useWallet();
  const { getUserPosition, getBorrowRate } = useLendingPool();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (account) {
      loadPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const loadPositions = async () => {
    setLoading(true);
    try {
      const positionPromises = DEFAULT_ASSETS.map(async (asset) => {
        const position = await getUserPosition(asset.address);
        const borrowRate = await getBorrowRate(asset.address);

        return {
          asset,
          position,
          borrowRate,
        };
      });

      const results = await Promise.all(positionPromises);
      setPositions(results.filter(r => r.position !== null));
    } catch (error) {
      console.error('Failed to load positions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
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

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-slate-400 mb-1">Total Collateral</p>
          <p className="text-2xl font-bold text-white">
            ${formatAmount(totalCollateral, 18, 2)}
          </p>
        </div>

        <div className="stat-card">
          <p className="text-sm text-slate-400 mb-1">Total Borrowed</p>
          <p className="text-2xl font-bold text-white">
            ${formatAmount(totalDebt, 18, 2)}
          </p>
        </div>

        <div className="stat-card">
          <p className="text-sm text-slate-400 mb-1">Health Factor</p>
          <p className={`text-2xl font-bold ${
            parseFloat(healthFactor) < 1.2 ? 'text-red-500' :
            parseFloat(healthFactor) < 1.5 ? 'text-yellow-500' :
            'text-green-500'
          }`}>
            {healthFactor}
          </p>
        </div>

        <div className="stat-card">
          <p className="text-sm text-slate-400 mb-1">Utilization</p>
          <p className="text-2xl font-bold text-white">
            {utilizationRate.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Positions Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Your Positions</h3>

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
    </div>
  );
}
