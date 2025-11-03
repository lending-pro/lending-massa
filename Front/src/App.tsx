import { useState, useEffect } from 'react';
import { WalletProvider } from './contexts/WalletContext';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import DepositWithdraw from './components/DepositWithdraw';
import BorrowRepay from './components/BorrowRepay';
import Liquidations from './components/Liquidations';
import { useLendingPool } from './hooks/useLendingPool';
import { DEFAULT_ASSETS } from './utils/constants';
import { formatAmount } from './utils/formatting';

type Tab = 'dashboard' | 'supply' | 'borrow' | 'liquidate';

interface MarketData {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  supplyAPY: number;
  borrowAPY: number;
  tvlUSD: bigint;
  availableUSD: bigint;
  utilization: number;
  loading: boolean;
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [oracleConfigured, setOracleConfigured] = useState(true);
  const { getMarketInfo } = useLendingPool();

  useEffect(() => {
    loadMarketData();
    const interval = setInterval(loadMarketData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMarketData = async () => {
    const data = await Promise.all(
      DEFAULT_ASSETS.map(async (asset) => {
        const info = await getMarketInfo(asset.address, asset.decimals);
        return {
          symbol: asset.symbol,
          name: asset.name,
          address: asset.address,
          decimals: asset.decimals,
          supplyAPY: info?.supplyAPY || 0,
          borrowAPY: info?.borrowAPY || 0,
          tvlUSD: info?.tvlUSD || 0n,
          availableUSD: info?.availableUSD || 0n,
          utilization: info?.utilization || 0,
          loading: false,
          price: info?.price || 0n,
        };
      })
    );
    setMarketData(data);

    // Check if oracle is configured (all prices are 0)
    const allPricesZero = data.every(d => d.price === 0n);
    setOracleConfigured(!allPricesZero);
  };

  const tabs = [
    { id: 'dashboard' as Tab, name: 'Dashboard', icon: '📊' },
    { id: 'supply' as Tab, name: 'Supply', icon: '💰' },
    { id: 'borrow' as Tab, name: 'Borrow', icon: '🏦' },
    { id: 'liquidate' as Tab, name: 'Liquidate', icon: '⚡' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Oracle Warning */}
        {!oracleConfigured && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-yellow-400">Price Oracle Not Configured</h4>
                <p className="text-xs text-yellow-300/80 mt-1">
                  The price oracle is not configured, so USD values and APYs will show as $0. You can still deposit and withdraw tokens, but prices need to be set by the contract owner.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'supply' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DepositWithdraw />
              <div className="card">
                <h3 className="text-xl font-semibold text-white mb-4">Supply Markets</h3>
                <div className="space-y-3">
                  {marketData.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                      <p className="mt-2 text-sm text-slate-400">Loading markets...</p>
                    </div>
                  ) : (
                    marketData.map((market) => (
                      <div key={market.symbol} className="p-4 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                              <span className="text-sm font-bold text-white">{market.symbol[0]}</span>
                            </div>
                            <div>
                              <p className="font-medium text-white">{market.symbol}</p>
                              <p className="text-xs text-slate-400">Supply APY</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-500">
                              {market.supplyAPY > 0 ? market.supplyAPY.toFixed(2) : '0.00'}%
                            </p>
                            <p className="text-xs text-slate-400">
                              TVL: ${formatAmount(market.tvlUSD, 18, 2)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Util: {market.utilization.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'borrow' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BorrowRepay />
              <div className="card">
                <h3 className="text-xl font-semibold text-white mb-4">Borrow Markets</h3>
                <div className="space-y-3">
                  {marketData.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                      <p className="mt-2 text-sm text-slate-400">Loading markets...</p>
                    </div>
                  ) : (
                    marketData.map((market) => (
                      <div key={market.symbol} className="p-4 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                              <span className="text-sm font-bold text-white">{market.symbol[0]}</span>
                            </div>
                            <div>
                              <p className="font-medium text-white">{market.symbol}</p>
                              <p className="text-xs text-slate-400">Borrow APY</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary-400">
                              {market.borrowAPY > 0 ? market.borrowAPY.toFixed(2) : '0.00'}%
                            </p>
                            <p className="text-xs text-slate-400">
                              Available: ${formatAmount(market.availableUSD, 18, 2)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Util: {market.utilization.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'liquidate' && <Liquidations />}
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4 text-sm text-slate-400">
              <a href="https://massa.net" target="_blank" rel="noopener noreferrer" className="hover:text-primary-400">
                Massa Network
              </a>
              <span>•</span>
              <a href="#" className="hover:text-primary-400">Docs</a>
              <span>•</span>
              <a href="#" className="hover:text-primary-400">GitHub</a>
            </div>
            <p className="text-sm text-slate-500">
              Built on Massa Blockchain • Testnet
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App;
