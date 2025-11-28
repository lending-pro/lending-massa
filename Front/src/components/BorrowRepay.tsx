import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useRefresh } from '../contexts/RefreshContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { DEFAULT_ASSETS, PROTOCOL_PARAMS, LENDING_POOL_ADDRESS } from '../utils/constants';
import { parseAmount, formatPercentage, formatAmount } from '../utils/formatting';

export default function BorrowRepay() {
  const { account, connected } = useWallet();
  const { triggerRefresh } = useRefresh();
  const { borrow, repay, loading, error, getUserDebt, getTokenBalance, getAllowance, approveToken, getMaxBorrow, getAccountHealth, getBorrowRate } = useLendingPool();
  const [selectedAsset, setSelectedAsset] = useState(DEFAULT_ASSETS[0]);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'borrow' | 'repay'>('borrow');
  const [txStatus, setTxStatus] = useState<string>('');
  const [debt, setDebt] = useState<bigint>(0n);
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);
  const [maxBorrowable, setMaxBorrowable] = useState<bigint>(0n);
  const [borrowLimitUsed, setBorrowLimitUsed] = useState(0);
  const [loadingData, setLoadingData] = useState(false);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [borrowRateBP, setBorrowRateBP] = useState(200); // Basis points

  // Fetch user debt, token balance, max borrow, and allowance
  useEffect(() => {
    const fetchData = async () => {
      if (!account) {
        setDebt(0n);
        setTokenBalance(0n);
        setMaxBorrowable(0n);
        setBorrowLimitUsed(0);
        setAllowance(0n);
        return;
      }

      setLoadingData(true);
      try {
        const [userDebt, balance, allow, maxBorrow, health, rate] = await Promise.all([
          getUserDebt(account, selectedAsset.address),
          getTokenBalance(selectedAsset.address, account),
          getAllowance(selectedAsset.address, account, LENDING_POOL_ADDRESS),
          getMaxBorrow(account, selectedAsset.address),
          getAccountHealth(account),
          getBorrowRate(selectedAsset.address),
        ]);
        setDebt(userDebt);
        setTokenBalance(balance);
        setMaxBorrowable(maxBorrow);
        setAllowance(allow);
        setBorrowRateBP(rate);

        // Calculate borrow limit used percentage
        if (health && health.collateralValue > 0n) {
          const maxBorrowValue = (health.collateralValue * BigInt(PROTOCOL_PARAMS.COLLATERAL_FACTOR)) / 10000n;
          if (maxBorrowValue > 0n) {
            const used = Number((health.debtValue * 10000n) / maxBorrowValue) / 100;
            setBorrowLimitUsed(Math.min(used, 100));
          } else {
            setBorrowLimitUsed(0);
          }
        } else {
          setBorrowLimitUsed(0);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setDebt(0n);
        setTokenBalance(0n);
        setMaxBorrowable(0n);
        setBorrowLimitUsed(0);
        setAllowance(0n);
        setBorrowRateBP(200);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [account, selectedAsset.address, getUserDebt, getTokenBalance, getAllowance, getMaxBorrow, getAccountHealth, getBorrowRate]);

  // Check if approval is needed for repay mode
  useEffect(() => {
    if (!amount || mode !== 'repay') {
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
      setTxStatus('Approval successful! You can now repay.');

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

      if (mode === 'borrow') {
        await borrow(selectedAsset.address, amountBigInt);
        setTxStatus('Borrow successful!');
      } else {
        await repay(selectedAsset.address, amountBigInt);
        setTxStatus('Repayment successful!');
      }

      setAmount('');

      // Refetch all data after successful transaction
      const [userDebt, balance, newAllowance, maxBorrow, health] = await Promise.all([
        getUserDebt(account, selectedAsset.address),
        getTokenBalance(selectedAsset.address, account),
        getAllowance(selectedAsset.address, account, LENDING_POOL_ADDRESS),
        getMaxBorrow(account, selectedAsset.address),
        getAccountHealth(account),
      ]);
      setDebt(userDebt);
      setTokenBalance(balance);
      setAllowance(newAllowance);
      setMaxBorrowable(maxBorrow);

      // Update borrow limit used
      if (health && health.collateralValue > 0n) {
        const maxBorrowValue = (health.collateralValue * BigInt(PROTOCOL_PARAMS.COLLATERAL_FACTOR)) / 10000n;
        if (maxBorrowValue > 0n) {
          const used = Number((health.debtValue * 10000n) / maxBorrowValue) / 100;
          setBorrowLimitUsed(Math.min(used, 100));
        } else {
          setBorrowLimitUsed(0);
        }
      } else {
        setBorrowLimitUsed(0);
      }

      // Trigger global refresh for Dashboard and other components
      triggerRefresh();
    } catch (err) {
      console.error('Transaction error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed. Please try again.';
      setTxStatus(errorMessage);
    }
  };

  const handleMaxClick = () => {
    if (mode === 'repay' && debt > 0n) {
      // For repay mode, set amount to min(debt, tokenBalance)
      const maxAmount = debt < tokenBalance ? debt : tokenBalance;
      setAmount(formatAmount(maxAmount, selectedAsset.decimals));
    } else if (mode === 'borrow' && maxBorrowable > 0n) {
      // For borrow mode, use calculated max borrowable
      setAmount(formatAmount(maxBorrowable, selectedAsset.decimals));
    }
  };

  if (!connected || !account) {
    return (
      <div className="card">
        <p className="text-center text-slate-400">Connect your wallet to borrow or repay</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-xl font-semibold text-white mb-6">Borrow & Repay</h3>

      {/* Mode Toggle */}
      <div className="flex space-x-2 mb-6 bg-slate-900 p-1 rounded-lg">
        <button
          onClick={() => setMode('borrow')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            mode === 'borrow'
              ? 'bg-primary-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Borrow
        </button>
        <button
          onClick={() => setMode('repay')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            mode === 'repay'
              ? 'bg-primary-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Repay
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
              {mode === 'borrow' ? 'Max Borrow' : 'Current debt'}: {loadingData ? '...' : formatAmount(mode === 'borrow' ? maxBorrowable : debt, selectedAsset.decimals)} {selectedAsset.symbol}
            </span>
            <span className="text-primary-400">
              APR: {formatPercentage(borrowRateBP)}
            </span>
          </div>
          {mode === 'borrow' && (
            <p className="mt-1 text-xs text-slate-500">
              Wallet Balance: {loadingData ? '...' : formatAmount(tokenBalance, selectedAsset.decimals)} {selectedAsset.symbol}
            </p>
          )}
        </div>

        {/* Borrow Limit (only for borrow mode) */}
        {mode === 'borrow' && (
          <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">Borrow Limit Used</span>
              <span className={`text-sm font-medium ${
                borrowLimitUsed >= 80 ? 'text-red-400' :
                borrowLimitUsed >= 60 ? 'text-yellow-400' :
                'text-green-400'
              }`}>{borrowLimitUsed.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  borrowLimitUsed >= 80 ? 'bg-gradient-to-r from-yellow-500 to-red-500' :
                  borrowLimitUsed >= 60 ? 'bg-gradient-to-r from-green-500 to-yellow-500' :
                  'bg-gradient-to-r from-green-500 to-green-400'
                }`}
                style={{ width: `${Math.min(borrowLimitUsed, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>0%</span>
              <span className="text-yellow-500">75%</span>
              <span className="text-red-500">100%</span>
            </div>
          </div>
        )}

        {/* Approve/Submit Buttons */}
        {mode === 'repay' && needsApproval ? (
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
            ) : mode === 'borrow' ? (
              'Borrow Assets'
            ) : (
              'Repay Debt'
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
          {mode === 'borrow' ? 'Borrowing Info' : 'Repayment Info'}
        </h4>
        <ul className="text-xs text-slate-400 space-y-1">
          {mode === 'borrow' ? (
            <>
              <li>• Borrow up to {formatPercentage(PROTOCOL_PARAMS.COLLATERAL_FACTOR)} of your collateral value</li>
              <li>• Interest accrues continuously based on utilization rate</li>
              <li>• Maintain health factor above 1 to avoid liquidation</li>
            </>
          ) : (
            <>
              <li>• Repay anytime to reduce debt and improve health factor</li>
              <li>• Interest continues to accrue until fully repaid</li>
              <li>• Partial repayments are allowed</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
