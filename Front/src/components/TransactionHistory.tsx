import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { DEFAULT_ASSETS } from '../utils/constants';
import { formatAmount, shortenAddress } from '../utils/formatting';
import { Transaction } from '../types';

// Local storage key for transactions
const TX_STORAGE_KEY = 'massa_lending_transactions';

// Get transactions from localStorage
function getStoredTransactions(): Transaction[] {
  try {
    const stored = localStorage.getItem(TX_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save transaction to localStorage
export function saveTransaction(tx: Transaction): void {
  try {
    const transactions = getStoredTransactions();
    transactions.unshift(tx); // Add to beginning
    // Keep only last 50 transactions
    const trimmed = transactions.slice(0, 50);
    localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(trimmed));
    // Dispatch event to notify components
    window.dispatchEvent(new CustomEvent('transactionAdded', { detail: tx }));
  } catch (err) {
    console.error('Failed to save transaction:', err);
  }
}

// Clear all transactions
export function clearTransactions(): void {
  localStorage.removeItem(TX_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('transactionsCleared'));
}

interface TransactionHistoryProps {
  compact?: boolean;
  limit?: number;
}

export default function TransactionHistory({ compact = false, limit = 10 }: TransactionHistoryProps) {
  const { account } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Load and listen for transaction updates
  useEffect(() => {
    const loadTransactions = () => {
      const stored = getStoredTransactions();
      // Filter by current account if connected
      const filtered = account
        ? stored.filter(tx => !tx.txHash.startsWith('pending_') || true) // Show all for now
        : stored;
      setTransactions(filtered.slice(0, limit));
    };

    loadTransactions();

    // Listen for new transactions
    const handleNewTx = () => loadTransactions();
    window.addEventListener('transactionAdded', handleNewTx);
    window.addEventListener('transactionsCleared', handleNewTx);

    return () => {
      window.removeEventListener('transactionAdded', handleNewTx);
      window.removeEventListener('transactionsCleared', handleNewTx);
    };
  }, [account, limit]);

  const getTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit': return '📥';
      case 'withdraw': return '📤';
      case 'borrow': return '🏦';
      case 'repay': return '💳';
      case 'liquidate': return '⚡';
      default: return '📄';
    }
  };

  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit': return 'text-green-400';
      case 'withdraw': return 'text-orange-400';
      case 'borrow': return 'text-blue-400';
      case 'repay': return 'text-purple-400';
      case 'liquidate': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const getAssetInfo = (address: string) => {
    return DEFAULT_ASSETS.find(a => a.address === address);
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (transactions.length === 0) {
    return (
      <div className={compact ? '' : 'card'}>
        {!compact && <h3 className="text-lg font-semibold text-white mb-4">Transaction History</h3>}
        <div className="text-center py-6">
          <svg className="mx-auto h-10 w-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-2 text-sm text-slate-400">No transactions yet</p>
          <p className="text-xs text-slate-500">Your lending activity will appear here</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {transactions.map((tx, idx) => {
          const asset = getAssetInfo(tx.asset);
          return (
            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span>{getTypeIcon(tx.type)}</span>
                <span className={`text-sm font-medium capitalize ${getTypeColor(tx.type)}`}>
                  {tx.type}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">
                  {formatAmount(tx.amount, asset?.decimals || 18, 4)} {asset?.symbol || '???'}
                </p>
                <p className="text-xs text-slate-500">{formatTime(tx.timestamp)}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Transaction History</h3>
        {transactions.length > 0 && (
          <button
            onClick={clearTransactions}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-2 text-xs font-medium text-slate-400">Type</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-slate-400">Asset</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-slate-400">Amount</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-slate-400">Time</th>
              <th className="text-center py-2 px-2 text-xs font-medium text-slate-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, idx) => {
              const asset = getAssetInfo(tx.asset);
              return (
                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <span>{getTypeIcon(tx.type)}</span>
                      <span className={`text-sm font-medium capitalize ${getTypeColor(tx.type)}`}>
                        {tx.type}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-sm text-white">{asset?.symbol || shortenAddress(tx.asset)}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="text-sm text-white font-mono">
                      {formatAmount(tx.amount, asset?.decimals || 18, 4)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="text-xs text-slate-400">{formatTime(tx.timestamp)}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor(tx.status)}`}></span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
