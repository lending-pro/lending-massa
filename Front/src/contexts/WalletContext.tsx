import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Args, Provider } from '@massalabs/massa-web3';
import {
  getWallets,
  Wallet,
  WalletName,
  ListenerCtrl,
} from '@massalabs/wallet-provider';

interface WalletContextType {
  account: string | null;
  client: Provider | null;
  accounts: Provider[];
  isConnecting: boolean;
  error: string | null;
  network: string;
  connected: boolean;
  connect: (provider?: Wallet) => Promise<void>;
  disconnect: () => void;
  switchAccount: (index: number) => void;
  providerList: Wallet[];
  selectedProvider: Wallet | null;
  setSelectedProvider: (provider: Wallet | null) => void;
  callContract: (contractAddress: string, functionName: string, args: Args, coins?: string) => Promise<any>;
  readContract: (contractAddress: string, functionName: string, args: Args) => Promise<any>;
  refreshProviders: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Provider[]>([]);
  const [accountIndex, setAccountIndex] = useState<number>(() => {
    return Number(localStorage.getItem('massa_account_index')) || 0;
  });
  const [client, setClient] = useState<Provider | null>(null);
  const [providerList, setProviderList] = useState<Wallet[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Wallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<string>('');
  const [accountListener, setAccountListener] = useState<ListenerCtrl | null>(null);
  const [networkListener, setNetworkListener] = useState<ListenerCtrl | null>(null);

  // Bearby and Metamask only support single account selection
  const isSingleAccountProvider = selectedProvider?.name() === WalletName.Bearby ||
                                   selectedProvider?.name() === WalletName.Metamask;

  // Current account based on provider type
  const currentAccount = accounts[isSingleAccountProvider ? 0 : accountIndex] || null;
  const account = currentAccount?.address || null;
  const connected = !!account;

  // Initialize providers on mount
  useEffect(() => {
    initProviders();
    return () => {
      // Cleanup listeners on unmount
      accountListener?.unsubscribe();
      networkListener?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup account change listener when connected
  useEffect(() => {
    if (!selectedProvider || !account) return;

    // Cleanup previous listener
    accountListener?.unsubscribe();

    // Only Bearby supports account change listening
    if (selectedProvider.name() === WalletName.Bearby) {
      const listener = selectedProvider.listenAccountChanges((newAddress) => {
        if (account !== newAddress) {
          console.log('Account changed:', newAddress);
          fetchAccounts(selectedProvider);
        }
      });
      setAccountListener(listener ?? null);
    }

    return () => {
      accountListener?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, selectedProvider]);

  // Setup network change listener
  useEffect(() => {
    if (!selectedProvider) return;

    // Cleanup previous listener
    networkListener?.unsubscribe();

    const listener = selectedProvider.listenNetworkChanges((newNetwork) => {
      if (network !== newNetwork.name) {
        console.log('Network changed:', newNetwork.name);
        setNetwork(newNetwork.name);
        // Refresh accounts on network change
        if (accounts.length > 0) {
          fetchAccounts(selectedProvider);
        }
      }
    });
    setNetworkListener(listener ?? null);

    return () => {
      networkListener?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, network]);

  // Update client when accounts or index changes
  useEffect(() => {
    if (accounts.length > 0 && selectedProvider) {
      const idx = isSingleAccountProvider ? 0 : Math.min(accountIndex, accounts.length - 1);
      setClient(accounts[idx]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, accountIndex, selectedProvider]);

  const initProviders = async () => {
    try {
      const wallets = await getWallets();
      setProviderList(wallets);

      // Check if already connected
      const savedProviderName = localStorage.getItem('massa_provider');
      if (savedProviderName) {
        const provider = wallets.find((w) => w.name() === savedProviderName);
        if (provider) {
          setSelectedProvider(provider);
          await reconnect(provider);
        }
      }
    } catch (err) {
      console.error('Failed to get wallet providers:', err);
      setError('No wallet provider found. Please install Massa Wallet or Bearby.');
    }
  };

  const refreshProviders = async () => {
    try {
      const wallets = await getWallets();
      setProviderList(wallets);
    } catch (err) {
      console.error('Failed to refresh providers:', err);
    }
  };

  const fetchAccounts = async (provider: Wallet): Promise<Provider[]> => {
    try {
      const providerAccounts = await provider.accounts();
      setAccounts(providerAccounts);
      return providerAccounts;
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      setAccounts([]);
      return [];
    }
  };

  const reconnect = async (provider: Wallet) => {
    try {
      const providerAccounts = await fetchAccounts(provider);
      if (providerAccounts.length > 0) {
        const savedIndex = Number(localStorage.getItem('massa_account_index')) || 0;
        const idx = Math.min(savedIndex, providerAccounts.length - 1);
        setAccountIndex(idx);
        setClient(providerAccounts[idx]);
      }
    } catch (err) {
      console.error('Reconnection failed:', err);
      localStorage.removeItem('massa_provider');
      localStorage.removeItem('massa_account_index');
    }
  };

  const connect = useCallback(async (provider?: Wallet) => {
    setIsConnecting(true);
    setError(null);

    try {
      if (providerList.length === 0) {
        throw new Error('No wallet provider found. Please install Massa Wallet or Bearby extension.');
      }

      // Use provided provider, selected provider, or first available
      const walletProvider = provider || selectedProvider || providerList[0];
      setSelectedProvider(walletProvider);

      // Request account access
      const providerAccounts = await fetchAccounts(walletProvider);

      if (!providerAccounts || providerAccounts.length === 0) {
        throw new Error('No accounts found. Please create an account in your wallet.');
      }

      // Set first account as default
      setAccountIndex(0);
      setClient(providerAccounts[0]);

      // Save provider preference
      localStorage.setItem('massa_provider', walletProvider.name());
      localStorage.setItem('massa_account_index', '0');

      console.log('Connected to Massa wallet:', providerAccounts[0].address);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [providerList, selectedProvider]);

  const disconnect = useCallback(() => {
    // Cleanup listeners
    accountListener?.unsubscribe();
    networkListener?.unsubscribe();
    setAccountListener(null);
    setNetworkListener(null);

    // Reset state
    setAccounts([]);
    setClient(null);
    setAccountIndex(0);
    setSelectedProvider(null);
    setNetwork('');
    setError(null);

    // Clear storage
    localStorage.removeItem('massa_provider');
    localStorage.removeItem('massa_account_index');
  }, [accountListener, networkListener]);

  const switchAccount = useCallback((index: number) => {
    if (index >= 0 && index < accounts.length) {
      setAccountIndex(index);
      setClient(accounts[index]);
      localStorage.setItem('massa_account_index', index.toString());
    }
  }, [accounts]);

  const callContract = async (
    contractAddress: string,
    functionName: string,
    args: Args,
    coins: string = '0'
  ): Promise<any> => {
    if (!client || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      const operation = await client.callSC({
        target: contractAddress,
        func: functionName,
        parameter: args.serialize(),
        maxGas: BigInt(3_000_000_000),
        coins: BigInt(coins),
      });

      console.log('Operation submitted:', operation.id);

      // Wait for speculative execution (faster, included in a block)
      const status = await operation.waitSpeculativeExecution();
      console.log('Operation status:', status);

      // Check if operation was successful (SpeculativeError = 3)
      if (status === 3) {
        const events = await operation.getSpeculativeEvents();
        const errorEvent = events.find((e: any) => e.data?.includes('Error') || e.data?.includes('assert'));
        throw new Error(errorEvent?.data || 'Transaction failed');
      }

      return operation;
    } catch (err) {
      console.error('Contract call error:', err);
      throw err;
    }
  };

  const readContract = async (
    contractAddress: string,
    functionName: string,
    args: Args
  ): Promise<any> => {
    if (!client) {
      throw new Error('Wallet not connected');
    }

    try {
      const result = await client.readSC({
        target: contractAddress,
        func: functionName,
        parameter: args.serialize(),
        maxGas: BigInt(200_000_000),
      });

      return result;
    } catch (err) {
      console.error('Contract read error:', err);
      throw err;
    }
  };

  const handleSetSelectedProvider = useCallback((provider: Wallet | null) => {
    setSelectedProvider(provider);
  }, []);

  const value: WalletContextType = {
    account,
    client,
    accounts,
    isConnecting,
    error,
    network,
    connected,
    connect,
    disconnect,
    switchAccount,
    providerList,
    selectedProvider,
    setSelectedProvider: handleSetSelectedProvider,
    callContract,
    readContract,
    refreshProviders,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Export Args for contract serialization
export { Args };
