import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { DEFAULT_ASSETS, PROTOCOL_PARAMS } from '../utils/constants';
import { parseAmount, formatAmount, formatPercentage, shortenAddress } from '../utils/formatting';
import { LiquidationCandidate } from '../types';
import HealthFactorGauge from './HealthFactorGauge';

export default function Liquidations() {
  const { account, connected } = useWallet();
  const { liquidate, loading, getAccountHealth, getUserCollateral, getUserDebt } = useLendingPool();
  const [liquidationCandidates, setLiquidationCandidates] = useState<LiquidationCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<LiquidationCandidate | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [txStatus, setTxStatus] = useState<string>('');
  const [checkAddress, setCheckAddress] = useState('');
  const [checking, setChecking] = useState(false);
  const [userHealth, setUserHealth] = useState<{
    collateralValue: bigint;
    debtValue: bigint;
    healthFactor: bigint;
    isHealthy: boolean;
  } | null>(null);

  // Load user's own health status
  const loadUserHealth = useCallback(async () => {
    if (!account) return;
    const health = await getAccountHealth(account);
    setUserHealth(health);
  }, [account, getAccountHealth]);

  useEffect(() => {
    if (connected && account) {
      loadUserHealth();
    }
  }, [connected, account, loadUserHealth]);

  // Check if an address is liquidatable
  const checkAddressForLiquidation = async () => {
    if (!checkAddress.trim()) return;

    setChecking(true);
    setTxStatus('');

    try {
      const health = await getAccountHealth(checkAddress.trim());

      if (!health) {
        setTxStatus('Could not retrieve health data for this address.');
        setChecking(false);
        return;
      }

      if (health.isHealthy) {
        setTxStatus(`Position is healthy (Health Factor: ${formatAmount(health.healthFactor, 18, 2)}). Cannot liquidate.`);
        setChecking(false);
        return;
      }

      // Position is unhealthy - gather details for all assets
      const candidates: LiquidationCandidate[] = [];

      for (const collateralAsset of DEFAULT_ASSETS) {
        const collateral = await getUserCollateral(checkAddress.trim(), collateralAsset.address);
        if (collateral <= 0n) continue;

        for (const debtAsset of DEFAULT_ASSETS) {
          const debt = await getUserDebt(checkAddress.trim(), debtAsset.address);
          if (debt <= 0n) continue;

          candidates.push({
            borrower: checkAddress.trim(),
            collateralToken: collateralAsset.address,
            debtToken: debtAsset.address,
            collateralAmount: collateral.toString(),
            debtAmount: debt.toString(),
            healthFactor: formatAmount(health.healthFactor, 18, 2),
          });
        }
      }

      if (candidates.length > 0) {
        setLiquidationCandidates(prev => {
          // Remove existing entries for this borrower and add new ones
          const filtered = prev.filter(c => c.borrower !== checkAddress.trim());
          return [...filtered, ...candidates];
        });
        setTxStatus(`Found ${candidates.length} liquidation opportunity(ies) for this address!`);
      } else {
        setTxStatus('Position is unhealthy but no collateral/debt positions found.');
      }
    } catch (err) {
      console.error('Error checking address:', err);
      setTxStatus('Error checking address. Please verify it is a valid Massa address.');
    }

    setChecking(false);
  };

  const handleLiquidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !selectedCandidate || !repayAmount) return;

    setTxStatus('');
    try {
      const debtToken = DEFAULT_ASSETS.find(a => a.address === selectedCandidate.debtToken);
      if (!debtToken) return;

      const amountBigInt = parseAmount(repayAmount, debtToken.decimals);

      await liquidate(
        selectedCandidate.borrower,
        selectedCandidate.collateralToken,
        selectedCandidate.debtToken,
        amountBigInt
      );

      setTxStatus('Liquidation successful!');
      setRepayAmount('');
      setSelectedCandidate(null);
    } catch (err) {
      setTxStatus('Liquidation failed. Please try again.');
    }
  };

  if (!connected || !account) {
    return (
      <div className="card">
        <p className="text-center text-slate-400">Connect your wallet to participate in liquidations</p>
      </div>
    );
  }

  // Calculate user's health factor for display
  const userHealthFactor = userHealth
    ? formatAmount(userHealth.healthFactor, 18, 2)
    : '∞';

  return (
    <div className="space-y-6">
      {/* User's Own Health Status */}
      {userHealth && userHealth.debtValue > 0n && (
        <div className={`card ${!userHealth.isHealthy ? 'border-red-500 bg-red-900/10' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Your Position Health</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Collateral Value</p>
                  <p className="text-white font-medium">${formatAmount(userHealth.collateralValue, 18, 2)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Debt Value</p>
                  <p className="text-white font-medium">${formatAmount(userHealth.debtValue, 18, 2)}</p>
                </div>
              </div>
              {!userHealth.isHealthy && (
                <div className="mt-3 p-2 bg-red-900/30 rounded text-red-400 text-sm">
                  Your position is at risk of liquidation. Consider repaying some debt or adding collateral.
                </div>
              )}
            </div>
            <HealthFactorGauge healthFactor={userHealthFactor} size="md" />
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-yellow-400">Liquidation Rewards</h4>
            <p className="text-xs text-yellow-300/80 mt-1">
              Earn a {formatPercentage(PROTOCOL_PARAMS.LIQUIDATION_PENALTY)} bonus by liquidating unhealthy positions (Health Factor {'<'} 1.0)
            </p>
          </div>
        </div>
      </div>

      {/* Check Address Form */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Check Address for Liquidation</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={checkAddress}
            onChange={(e) => setCheckAddress(e.target.value)}
            placeholder="Enter Massa address (AS...)"
            className="input-field flex-1"
          />
          <button
            onClick={checkAddressForLiquidation}
            disabled={checking || !checkAddress.trim()}
            className="btn-primary px-6"
          >
            {checking ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking...
              </span>
            ) : 'Check'}
          </button>
        </div>
        {txStatus && !selectedCandidate && (
          <p className={`mt-3 text-sm ${txStatus.includes('Found') ? 'text-green-400' : txStatus.includes('healthy') ? 'text-yellow-400' : 'text-red-400'}`}>
            {txStatus}
          </p>
        )}
      </div>

      {/* Liquidation Candidates */}
      <div className="card">
        <h3 className="text-xl font-semibold text-white mb-6">Liquidation Opportunities</h3>

        {liquidationCandidates.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2 text-slate-400">No liquidation opportunities available</p>
            <p className="text-sm text-slate-500 mt-1">All positions are healthy</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Borrower</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Collateral</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Debt</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Health Factor</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Profit</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {liquidationCandidates.map((candidate, idx) => {
                  const collateralAsset = DEFAULT_ASSETS.find(a => a.address === candidate.collateralToken);
                  const debtAsset = DEFAULT_ASSETS.find(a => a.address === candidate.debtToken);

                  return (
                    <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm text-white">
                          {shortenAddress(candidate.borrower)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <p className="text-white">
                          {formatAmount(candidate.collateralAmount, collateralAsset?.decimals || 18)}
                        </p>
                        <p className="text-xs text-slate-400">{collateralAsset?.symbol}</p>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <p className="text-white">
                          {formatAmount(candidate.debtAmount, debtAsset?.decimals || 18)}
                        </p>
                        <p className="text-xs text-slate-400">{debtAsset?.symbol}</p>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-medium text-red-500">
                          {candidate.healthFactor}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-medium text-green-500">
                          +{formatPercentage(PROTOCOL_PARAMS.LIQUIDATION_PENALTY)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setSelectedCandidate(candidate)}
                            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                          >
                            Liquidate
                          </button>
                          <button
                            onClick={() => setLiquidationCandidates(prev => prev.filter(c => c !== candidate))}
                            className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Liquidation Form Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-semibold text-white">Liquidate Position</h3>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleLiquidate} className="space-y-4">
              <div className="p-4 bg-slate-900 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Borrower:</span>
                  <span className="text-white font-mono">{shortenAddress(selectedCandidate.borrower)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Health Factor:</span>
                  <span className="text-red-500 font-medium">{selectedCandidate.healthFactor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max Liquidation:</span>
                  <span className="text-white">50% of debt</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Repay Amount
                </label>
                <input
                  type="number"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  placeholder="0.0"
                  step="any"
                  min="0"
                  className="input-field"
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  You will receive collateral + {formatPercentage(PROTOCOL_PARAMS.LIQUIDATION_PENALTY)} bonus
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !repayAmount}
                className="w-full btn-primary"
              >
                {loading ? 'Processing...' : 'Confirm Liquidation'}
              </button>

              {txStatus && (
                <div className={`p-4 rounded-lg ${
                  txStatus.includes('failed')
                    ? 'bg-red-900/20 border border-red-800'
                    : 'bg-green-900/20 border border-green-800'
                }`}>
                  <p className={`text-sm ${
                    txStatus.includes('failed') ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {txStatus}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
