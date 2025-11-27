import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { shortenAddress } from '../utils/formatting';

export default function Header() {
  const {
    account,
    accounts,
    isConnecting,
    connected,
    connect,
    disconnect,
    switchAccount,
    providerList,
    selectedProvider,
    setSelectedProvider,
    network,
    refreshProviders,
  } = useWallet();

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const handleConnectWallet = async (provider: typeof providerList[0]) => {
    setSelectedProvider(provider);
    await connect(provider);
    setShowWalletModal(false);
  };

  const handleSwitchAccount = (index: number) => {
    switchAccount(index);
    setShowAccountMenu(false);
  };

  const handleDisconnect = () => {
    disconnect();
    setShowAccountMenu(false);
  };

  const openWalletModal = async () => {
    await refreshProviders();
    setShowWalletModal(true);
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Massa Lending</h1>
                <p className="text-xs text-slate-400">Borrow & Lend</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-300">{network || 'Testnet'}</span>
              </div>

              {connected && account ? (
                <div className="relative">
                  <button
                    onClick={() => setShowAccountMenu(!showAccountMenu)}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-mono text-white">
                      {shortenAddress(account)}
                    </span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Account Dropdown Menu */}
                  {showAccountMenu && (
                    <div className="absolute right-0 mt-2 w-72 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-50">
                      <div className="p-3 border-b border-slate-700">
                        <p className="text-xs text-slate-400 mb-1">Connected with {selectedProvider?.name()}</p>
                        <p className="text-sm text-white font-mono break-all">{account}</p>
                      </div>

                      {/* Account List */}
                      {accounts.length > 1 && (
                        <div className="p-2 border-b border-slate-700">
                          <p className="text-xs text-slate-400 px-2 mb-2">Switch Account</p>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {accounts.map((acc, idx) => (
                              <button
                                key={acc.address}
                                onClick={() => handleSwitchAccount(idx)}
                                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left transition-colors ${
                                  acc.address === account
                                    ? 'bg-primary-600/20 text-primary-400'
                                    : 'hover:bg-slate-700 text-slate-300'
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full ${acc.address === account ? 'bg-primary-500' : 'bg-slate-500'}`}></div>
                                <span className="text-sm font-mono">{shortenAddress(acc.address)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="p-2">
                        <button
                          onClick={openWalletModal}
                          className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span className="text-sm">Switch Wallet</span>
                        </button>
                        <button
                          onClick={handleDisconnect}
                          className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/20 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span className="text-sm">Disconnect</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={openWalletModal}
                  disabled={isConnecting}
                  className="btn-primary"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowWalletModal(false)}>
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Connect Wallet</h3>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {providerList.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-slate-400 mb-2">No wallet detected</p>
                <p className="text-sm text-slate-500">Please install Massa Station or Bearby wallet extension</p>
                <div className="mt-4 flex flex-col space-y-2">
                  <a
                    href="https://station.massa.net"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:text-primary-300 text-sm"
                  >
                    Install Massa Station
                  </a>
                  <a
                    href="https://bearby.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:text-primary-300 text-sm"
                  >
                    Install Bearby
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {providerList.map((provider) => (
                  <button
                    key={provider.name()}
                    onClick={() => handleConnectWallet(provider)}
                    disabled={isConnecting}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      selectedProvider?.name() === provider.name()
                        ? 'bg-primary-600/20 border-primary-500'
                        : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <span className="text-white font-medium">{provider.name()}</span>
                    </div>
                    {selectedProvider?.name() === provider.name() && connected && (
                      <span className="text-xs text-primary-400">Connected</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {isConnecting && (
              <div className="mt-4 flex items-center justify-center space-x-2 text-slate-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                <span className="text-sm">Connecting...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close account menu */}
      {showAccountMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)}></div>
      )}
    </>
  );
}
