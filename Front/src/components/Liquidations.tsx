import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { DEFAULT_ASSETS, PROTOCOL_PARAMS } from '../utils/constants';
import { parseAmount, formatAmount, formatPercentage, shortenAddress } from '../utils/formatting';
import { LiquidationCandidate } from '../types';

export default function Liquidations() {
  const { account } = useWallet();
  const { liquidate, loading } = useLendingPool();
  const [liquidationCandidates] = useState<LiquidationCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<LiquidationCandidate | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [txStatus, setTxStatus] = useState<string>('');

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

  if (!account) {
    return (
      <div className="card">
        <p className="text-center text-slate-400">Connect your wallet to participate in liquidations</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                        <button
                          onClick={() => setSelectedCandidate(candidate)}
                          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                        >
                          Liquidate
                        </button>
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
