import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { DEFAULT_ASSETS, LENDING_POOL_ADDRESS } from '../utils/constants';
import { parseAmount, formatAmount } from '../utils/formatting';

export default function DepositWithdraw() {
  const { account, connected } = useWallet();
  const { depositCollateral, withdrawCollateral, loading, error, getTokenBalance, getAllowance, approveToken, getUserCollateral, getMaxWithdraw } = useLendingPool();
  const [selectedAsset, setSelectedAsset] = useState(DEFAULT_ASSETS[0]);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [txStatus, setTxStatus] = useState<string>('');
  const [balance, setBalance] = useState<bigint>(0n);
  const [depositedBalance, setDepositedBalance] = useState<bigint>(0n);
  const [maxWithdrawable, setMaxWithdrawable] = useState<bigint>(0n);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [needsApproval, setNeedsApproval] = useState(false);

  // Fetch token balance, deposited balance, and allowance when account or selected asset changes
  useEffect(() => {
    const fetchData = async () => {
      if (!account) {
        setBalance(0n);
        setDepositedBalance(0n);
        setMaxWithdrawable(0n);
        setAllowance(0n);
        return;
      }

      setLoadingBalance(true);
      try {
        const [bal, deposited, allow, maxWithdraw] = await Promise.all([
          getTokenBalance(selectedAsset.address, account),
          getUserCollateral(account, selectedAsset.address),
          getAllowance(selectedAsset.address, account, LENDING_POOL_ADDRESS),
          getMaxWithdraw(account, selectedAsset.address),
        ]);
        setBalance(bal);
        setDepositedBalance(deposited);
        setMaxWithdrawable(maxWithdraw);
        setAllowance(allow);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setBalance(0n);
        setDepositedBalance(0n);
        setMaxWithdrawable(0n);
        setAllowance(0n);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchData();
  }, [account, selectedAsset.address, getTokenBalance, getAllowance, getUserCollateral, getMaxWithdraw]);

  // Check if approval is needed when amount changes
  useEffect(() => {
    if (!amount || mode !== 'deposit') {
      setNeedsApproval(false);
      return;
    }

    try {
      const amountBigInt = parseAmount(amount, selectedAsset.decimals);
      setNeedsApproval(allowance < amountBigInt);
    } catch {
      setNeedsApproval(false);
    }
  }, [amount, allowance, mode, selectedAsset.decimals]);

  const handleApprove = async () => {
    if (!account || !amount) return;

    setTxStatus('');
    try {
      const amountBigInt = parseAmount(amount, selectedAsset.decimals);
      await approveToken(selectedAsset.address, LENDING_POOL_ADDRESS, amountBigInt);
      setTxStatus('Approval successful! You can now deposit.');

      // Refetch allowance after approval
      const newAllowance = await getAllowance(selectedAsset.address, account, LENDING_POOL_ADDRESS);
      setAllowance(newAllowance);
    } catch (err) {
      console.error('Approval error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Approval failed. Please try again.';
      setTxStatus(errorMessage);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !amount) return;

    setTxStatus('');
    try {
      const amountBigInt = parseAmount(amount, selectedAsset.decimals);

      if (mode === 'deposit') {
        await depositCollateral(selectedAsset.address, amountBigInt);
        setTxStatus('Collateral deposited successfully!');
      } else {
        await withdrawCollateral(selectedAsset.address, amountBigInt);
        setTxStatus('Collateral withdrawn successfully!');
      }

      setAmount('');

      // Refetch balances after successful transaction
      const [newBalance, newDeposited, newAllowance] = await Promise.all([
        getTokenBalance(selectedAsset.address, account),
        getUserCollateral(account, selectedAsset.address),
        getAllowance(selectedAsset.address, account, LENDING_POOL_ADDRESS),
      ]);
      setBalance(newBalance);
      setDepositedBalance(newDeposited);
      setAllowance(newAllowance);
    } catch (err) {
      console.error('Transaction error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed. Please try again.';
      setTxStatus(errorMessage);
    }
  };

  const handleMaxClick = () => {
    // Use wallet balance for deposit, safe max withdraw for withdraw
    const maxAmount = mode === 'deposit' ? balance : maxWithdrawable;
    if (maxAmount > 0n) {
      setAmount(formatAmount(maxAmount, selectedAsset.decimals));
    }
  };

  if (!connected || !account) {
    return (
      <div className="card">
        <p className="text-center text-slate-400">Connect your wallet to deposit or withdraw collateral</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-xl font-semibold text-white mb-6">Manage Collateral</h3>

      {/* Mode Toggle */}
      <div className="flex space-x-2 mb-6 bg-slate-900 p-1 rounded-lg">
        <button
          onClick={() => setMode('deposit')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            mode === 'deposit'
              ? 'bg-primary-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setMode('withdraw')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            mode === 'withdraw'
              ? 'bg-primary-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Withdraw
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Asset Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Select Asset
          </label>
          <select
            value={selectedAsset.address}
            onChange={(e) => {
              const asset = DEFAULT_ASSETS.find(a => a.address === e.target.value);
              if (asset) setSelectedAsset(asset);
            }}
            className="input-field"
          >
            {DEFAULT_ASSETS.map((asset) => (
              <option key={asset.address} value={asset.address}>
                {asset.symbol} - {asset.name}
              </option>
            ))}
          </select>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              step="any"
              min="0"
              className="input-field pr-20"
              required
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
              <button
                type="button"
                onClick={handleMaxClick}
                className="text-xs text-primary-400 hover:text-primary-300 font-medium"
              >
                MAX
              </button>
              <span className="text-slate-400">{selectedAsset.symbol}</span>
            </div>
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>
              {mode === 'deposit' ? 'Wallet Balance' : 'Deposited'}: {loadingBalance ? '...' : formatAmount(mode === 'deposit' ? balance : depositedBalance, selectedAsset.decimals)} {selectedAsset.symbol}
            </span>
            {mode === 'withdraw' && depositedBalance > 0n && (
              <span className="text-primary-400">
                Safe Max: {loadingBalance ? '...' : formatAmount(maxWithdrawable, selectedAsset.decimals)} {selectedAsset.symbol}
              </span>
            )}
          </div>
        </div>

        {/* Approve/Submit Buttons */}
        {mode === 'deposit' && needsApproval ? (
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading || !amount}
            className="w-full btn-primary py-3 text-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Approving...
              </span>
            ) : (
              `Approve ${selectedAsset.symbol}`
            )}
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading || !amount}
            className="w-full btn-primary py-3 text-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </span>
            ) : mode === 'deposit' ? (
              'Deposit Collateral'
            ) : (
              'Withdraw Collateral'
            )}
          </button>
        )}

        {/* Status Messages */}
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {txStatus && (
          <div className={`p-4 rounded-lg ${
            txStatus.toLowerCase().includes('failed') || txStatus.toLowerCase().includes('error')
              ? 'bg-red-900/20 border border-red-800'
              : 'bg-green-900/20 border border-green-800'
          }`}>
            <p className={`text-sm ${
              txStatus.toLowerCase().includes('failed') || txStatus.toLowerCase().includes('error')
                ? 'text-red-400'
                : 'text-green-400'
            }`}>
              {txStatus}
            </p>
          </div>
        )}
      </form>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-2">
          {mode === 'deposit' ? 'Deposit Info' : 'Withdraw Info'}
        </h4>
        <ul className="text-xs text-slate-400 space-y-1">
          {mode === 'deposit' ? (
            <>
              <li>• Deposited collateral can be used to borrow other assets</li>
              <li>• Maximum LTV (Loan-to-Value) is 75%</li>
              <li>• You can withdraw anytime if your health factor remains above 1</li>
            </>
          ) : (
            <>
              <li>• Withdrawals must maintain a healthy position (HF {'>'} 1)</li>
              <li>• Partial withdrawals are allowed</li>
              <li>• Repay debt to unlock more collateral</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
