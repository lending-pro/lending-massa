import { useState, useEffect } from 'react';
import { useWallet, Args } from '../contexts/WalletContext';
import { WMAS_ADDRESS } from '../utils/constants';
import { parseAmount, formatAmount } from '../utils/formatting';
import { getERC20Balance } from '../utils/web3Provider';

interface WrapUnwrapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WrapUnwrapModal({ isOpen, onClose }: WrapUnwrapModalProps) {
  const { account, connected, client } = useWallet();
  const [mode, setMode] = useState<'wrap' | 'unwrap'>('wrap');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');
  const [masBalance, setMasBalance] = useState<bigint>(0n);
  const [wmasBalance, setWmasBalance] = useState<bigint>(0n);
  const [loadingBalances, setLoadingBalances] = useState(false);

  const WMAS_DECIMALS = 9;

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!account || !client) return;

      setLoadingBalances(true);
      try {
        // Get native MAS balance
        const masBalance = await client.balance(false);
        setMasBalance(masBalance);

        // Get WMAS balance
        const wmas = await getERC20Balance(WMAS_ADDRESS, account);
        setWmasBalance(wmas);
      } catch (err) {
        console.error('Error fetching balances:', err);
      } finally {
        setLoadingBalances(false);
      }
    };

    if (isOpen && connected) {
      fetchBalances();
    }
  }, [isOpen, account, connected, client]);

  const handleWrap = async () => {
    if (!account || !client || !amount) return;

    setLoading(true);
    setTxStatus('');

    try {
      const amountBigInt = parseAmount(amount, WMAS_DECIMALS);

      // Call deposit() on WMAS contract with coins
      const operation = await client.callSC({
        target: WMAS_ADDRESS,
        func: 'deposit',
        parameter: new Args().serialize(),
        maxGas: BigInt(100_000_000),
        coins: amountBigInt, // Send MAS as coins
      });

      console.log('Wrap operation:', operation.id);

      const status = await operation.waitSpeculativeExecution();
      if (status === 3) {
        throw new Error('Wrap transaction failed');
      }

      setTxStatus('Successfully wrapped MAS to WMAS!');
      setAmount('');

      // Refresh balances
      const masBalance = await client.balance(false);
      setMasBalance(masBalance);
      const wmas = await getERC20Balance(WMAS_ADDRESS, account);
      setWmasBalance(wmas);
    } catch (err) {
      console.error('Wrap error:', err);
      setTxStatus(err instanceof Error ? err.message : 'Failed to wrap MAS');
    } finally {
      setLoading(false);
    }
  };

  const handleUnwrap = async () => {
    if (!account || !client || !amount) return;

    setLoading(true);
    setTxStatus('');

    try {
      const amountBigInt = parseAmount(amount, WMAS_DECIMALS);

      // Call withdraw(amount, recipient) on WMAS contract
      // WMAS expects u64 for amount and string for recipient
      const args = new Args().addU64(amountBigInt).addString(account);

      const operation = await client.callSC({
        target: WMAS_ADDRESS,
        func: 'withdraw',
        parameter: args.serialize(),
        maxGas: BigInt(100_000_000),
        coins: BigInt(0),
      });

      console.log('Unwrap operation:', operation.id);

      const status = await operation.waitSpeculativeExecution();
      if (status === 3) {
        throw new Error('Unwrap transaction failed');
      }

      setTxStatus('Successfully unwrapped WMAS to MAS!');
      setAmount('');

      // Refresh balances
      const masBalance = await client.balance(false);
      setMasBalance(masBalance);
      const wmas = await getERC20Balance(WMAS_ADDRESS, account);
      setWmasBalance(wmas);
    } catch (err) {
      console.error('Unwrap error:', err);
      setTxStatus(err instanceof Error ? err.message : 'Failed to unwrap WMAS');
    } finally {
      setLoading(false);
    }
  };

  const handleMaxClick = () => {
    if (mode === 'wrap') {
      // Leave some MAS for gas fees (0.1 MAS)
      const maxWrap = masBalance > BigInt(100_000_000) ? masBalance - BigInt(100_000_000) : 0n;
      setAmount(formatAmount(maxWrap, WMAS_DECIMALS));
    } else {
      setAmount(formatAmount(wmasBalance, WMAS_DECIMALS));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'wrap') {
      handleWrap();
    } else {
      handleUnwrap();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-semibold text-white">Wrap / Unwrap MAS</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!connected || !account ? (
          <p className="text-center text-slate-400 py-8">Connect your wallet to wrap/unwrap MAS</p>
        ) : (
          <>
            {/* Balances */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Native MAS</p>
                <p className="text-lg font-medium text-white">
                  {loadingBalances ? '...' : formatAmount(masBalance, WMAS_DECIMALS, 4)}
                </p>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">WMAS</p>
                <p className="text-lg font-medium text-white">
                  {loadingBalances ? '...' : formatAmount(wmasBalance, WMAS_DECIMALS, 4)}
                </p>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex space-x-2 mb-6 bg-slate-900 p-1 rounded-lg">
              <button
                onClick={() => { setMode('wrap'); setAmount(''); setTxStatus(''); }}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                  mode === 'wrap'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Wrap MAS
              </button>
              <button
                onClick={() => { setMode('unwrap'); setAmount(''); setTxStatus(''); }}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                  mode === 'unwrap'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unwrap WMAS
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="input-field pr-24"
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
                    <span className="text-slate-400">{mode === 'wrap' ? 'MAS' : 'WMAS'}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Available: {loadingBalances ? '...' : formatAmount(mode === 'wrap' ? masBalance : wmasBalance, WMAS_DECIMALS, 4)} {mode === 'wrap' ? 'MAS' : 'WMAS'}
                </p>
              </div>

              {/* Arrow indicator */}
              <div className="flex justify-center">
                <div className="p-2 bg-slate-900 rounded-full">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              {/* Output preview */}
              <div className="p-4 bg-slate-900 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">You will receive</p>
                <p className="text-xl font-medium text-white">
                  {amount || '0'} {mode === 'wrap' ? 'WMAS' : 'MAS'}
                </p>
              </div>

              {/* Submit Button */}
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
                ) : mode === 'wrap' ? (
                  'Wrap MAS to WMAS'
                ) : (
                  'Unwrap WMAS to MAS'
                )}
              </button>

              {/* Status Message */}
              {txStatus && (
                <div className={`p-4 rounded-lg ${
                  txStatus.includes('Successfully')
                    ? 'bg-green-900/20 border border-green-800'
                    : 'bg-red-900/20 border border-red-800'
                }`}>
                  <p className={`text-sm ${
                    txStatus.includes('Successfully') ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {txStatus}
                  </p>
                </div>
              )}
            </form>

            {/* Info */}
            <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400">
                {mode === 'wrap'
                  ? 'Wrapping converts native MAS to WMAS (ERC20 token) so it can be used in DeFi protocols.'
                  : 'Unwrapping converts WMAS back to native MAS.'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
