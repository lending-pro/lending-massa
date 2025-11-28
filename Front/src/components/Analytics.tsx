import { useState, useEffect, useCallback } from 'react';
import { useLendingPool } from '../hooks/useLendingPool';
import { DEFAULT_ASSETS, PROTOCOL_PARAMS, ANALYTICS_STORAGE_KEY, MAX_ANALYTICS_HISTORY } from '../utils/constants';
import { formatAmount } from '../utils/formatting';
import TokenIcon from './TokenIcon';

interface ProtocolStats {
  timestamp: number;
  totalTVL: bigint;
  totalBorrowed: bigint;
  totalAvailable: bigint;
  utilization: number;
  assetStats: AssetStat[];
}

interface AssetStat {
  symbol: string;
  address: string;
  tvl: bigint;
  borrowed: bigint;
  available: bigint;
  utilization: number;
  supplyAPY: number;
  borrowAPY: number;
  logo?: string;
}

interface HistoricalData {
  timestamp: number;
  tvl: string;
  borrowed: string;
  utilization: number;
}

export default function Analytics() {
  const { getMarketInfo } = useLendingPool();
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  // Load historical data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setHistoricalData(parsed);
      } catch (e) {
        console.error('Failed to parse analytics data:', e);
      }
    }
  }, []);

  // Save historical data point
  const saveDataPoint = useCallback((newStats: ProtocolStats) => {
    const dataPoint: HistoricalData = {
      timestamp: newStats.timestamp,
      tvl: newStats.totalTVL.toString(),
      borrowed: newStats.totalBorrowed.toString(),
      utilization: newStats.utilization,
    };

    setHistoricalData(prev => {
      // Only add if last data point is older than 1 hour
      const lastPoint = prev[prev.length - 1];
      if (lastPoint && newStats.timestamp - lastPoint.timestamp < 3600000) {
        return prev;
      }

      const updated = [...prev, dataPoint].slice(-MAX_ANALYTICS_HISTORY);
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Load current stats
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      let totalTVL = 0n;
      let totalBorrowed = 0n;
      const assetStats: AssetStat[] = [];

      for (const asset of DEFAULT_ASSETS) {
        const info = await getMarketInfo(asset.address, asset.decimals);
        if (info) {
          const tvl = info.tvlUSD || 0n;
          const borrowed = info.borrowedUSD || 0n;
          const available = info.availableUSD || 0n;

          totalTVL += tvl;
          totalBorrowed += borrowed;

          assetStats.push({
            symbol: asset.symbol,
            address: asset.address,
            tvl,
            borrowed,
            available,
            utilization: info.utilization || 0,
            supplyAPY: info.supplyAPY || 0,
            borrowAPY: info.borrowAPY || 0,
            logo: asset.logo,
          });
        }
      }

      const totalAvailable = totalTVL > totalBorrowed ? totalTVL - totalBorrowed : 0n;
      const utilization = totalTVL > 0n
        ? Number((totalBorrowed * 10000n) / totalTVL) / 100
        : 0;

      const newStats: ProtocolStats = {
        timestamp: Date.now(),
        totalTVL,
        totalBorrowed,
        totalAvailable,
        utilization,
        assetStats,
      };

      setStats(newStats);
      saveDataPoint(newStats);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [getMarketInfo, saveDataPoint]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [loadStats]);

  // Filter historical data by timeframe
  const filteredHistory = historicalData.filter(d => {
    const now = Date.now();
    switch (activeTimeframe) {
      case '24h': return d.timestamp > now - 86400000;
      case '7d': return d.timestamp > now - 604800000;
      case '30d': return d.timestamp > now - 2592000000;
      default: return true;
    }
  });

  // Calculate changes
  const calculateChange = (current: bigint, history: HistoricalData[]): number => {
    if (history.length < 2) return 0;
    const oldest = BigInt(history[0].tvl);
    if (oldest === 0n) return 0;
    return Number(((current - oldest) * 10000n) / oldest) / 100;
  };

  const tvlChange = stats ? calculateChange(stats.totalTVL, filteredHistory) : 0;
  const borrowedChange = stats ? calculateChange(stats.totalBorrowed, filteredHistory.map(h => ({ ...h, tvl: h.borrowed }))) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Protocol Analytics</h2>
          <p className="text-sm text-slate-400 mt-1">Real-time protocol statistics and historical data</p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm text-slate-300">Refresh</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-400">Total Value Locked</p>
            {tvlChange !== 0 && (
              <span className={`text-xs px-2 py-0.5 rounded ${tvlChange >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {tvlChange >= 0 ? '+' : ''}{tvlChange.toFixed(2)}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-white">
            ${stats ? formatAmount(stats.totalTVL, 18, 2) : '...'}
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-400">Total Borrowed</p>
            {borrowedChange !== 0 && (
              <span className={`text-xs px-2 py-0.5 rounded ${borrowedChange >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {borrowedChange >= 0 ? '+' : ''}{borrowedChange.toFixed(2)}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-white">
            ${stats ? formatAmount(stats.totalBorrowed, 18, 2) : '...'}
          </p>
        </div>

        <div className="stat-card">
          <p className="text-sm text-slate-400 mb-2">Available Liquidity</p>
          <p className="text-2xl font-bold text-white">
            ${stats ? formatAmount(stats.totalAvailable, 18, 2) : '...'}
          </p>
        </div>

        <div className="stat-card">
          <p className="text-sm text-slate-400 mb-2">Protocol Utilization</p>
          <p className="text-2xl font-bold text-white">
            {stats ? stats.utilization.toFixed(2) : '...'}%
          </p>
          <div className="mt-2 w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                (stats?.utilization || 0) > 80 ? 'bg-red-500' :
                (stats?.utilization || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(stats?.utilization || 0, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Protocol Parameters */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Protocol Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Collateral Factor</p>
            <p className="text-lg font-medium text-white">{PROTOCOL_PARAMS.COLLATERAL_FACTOR / 100}%</p>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Liquidation Threshold</p>
            <p className="text-lg font-medium text-white">{PROTOCOL_PARAMS.LIQUIDATION_THRESHOLD / 100}%</p>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Reserve Factor</p>
            <p className="text-lg font-medium text-white">{PROTOCOL_PARAMS.RESERVE_FACTOR / 100}%</p>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Flash Loan Fee</p>
            <p className="text-lg font-medium text-white">{PROTOCOL_PARAMS.FLASH_LOAN_FEE / 100}%</p>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Close Factor</p>
            <p className="text-lg font-medium text-white">{PROTOCOL_PARAMS.CLOSE_FACTOR / 100}%</p>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Liq. Bonus (Min)</p>
            <p className="text-lg font-medium text-white">{PROTOCOL_PARAMS.LIQUIDATION_BONUS_MIN / 100}%</p>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Liq. Bonus (Max)</p>
            <p className="text-lg font-medium text-white">{PROTOCOL_PARAMS.LIQUIDATION_BONUS_MAX / 100}%</p>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Supported Assets</p>
            <p className="text-lg font-medium text-white">{DEFAULT_ASSETS.length}</p>
          </div>
        </div>
      </div>

      {/* Asset Breakdown */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Asset Breakdown</h3>
        {loading && !stats ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            <p className="mt-2 text-sm text-slate-400">Loading assets...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Asset</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">TVL</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Borrowed</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Available</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Utilization</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Supply APY</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Borrow APY</th>
                </tr>
              </thead>
              <tbody>
                {stats?.assetStats.map((asset) => (
                  <tr key={asset.address} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <TokenIcon symbol={asset.symbol} logo={asset.logo} size="md" />
                        <span className="font-medium text-white">{asset.symbol}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-white">
                      ${formatAmount(asset.tvl, 18, 2)}
                    </td>
                    <td className="py-4 px-4 text-right text-white">
                      ${formatAmount(asset.borrowed, 18, 2)}
                    </td>
                    <td className="py-4 px-4 text-right text-white">
                      ${formatAmount(asset.available, 18, 2)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={`${
                        asset.utilization > 80 ? 'text-red-400' :
                        asset.utilization > 60 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {asset.utilization.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-green-400">
                      {asset.supplyAPY.toFixed(2)}%
                    </td>
                    <td className="py-4 px-4 text-right text-primary-400">
                      {asset.borrowAPY.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historical Data */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Historical Data</h3>
          <div className="flex space-x-2">
            {(['24h', '7d', '30d', 'all'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  activeTimeframe === tf
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {tf === 'all' ? 'All' : tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-slate-400">No historical data yet</p>
            <p className="text-sm text-slate-500 mt-1">Data will accumulate over time</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Date</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">TVL</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Borrowed</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.slice(-20).reverse().map((data, idx) => (
                  <tr key={data.timestamp + idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-4 text-slate-300">
                      {new Date(data.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      ${formatAmount(BigInt(data.tvl), 18, 2)}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      ${formatAmount(BigInt(data.borrowed), 18, 2)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      {data.utilization.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-400">About Analytics</h4>
            <p className="text-xs text-blue-300/80 mt-1">
              Historical data is stored locally in your browser. Data points are recorded hourly to track
              protocol growth over time. Clear your browser data to reset the analytics history.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
