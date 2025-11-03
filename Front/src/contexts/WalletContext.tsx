import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Args } from '@massalabs/massa-web3';
import {
  getWallets,
  Wallet,
} from '@massalabs/wallet-provider';

// Provider type - wallet provider account
type Provider = any; // wallet-provider Provider type

interface WalletContextType {
  account: string | null;
  client: Provider | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  providerList: Wallet[];
  selectedProvider: Wallet | null;
  callContract: (contractAddress: string, functionName: string, args: Args, coins?: string) => Promise<any>;
  readContract: (contractAddress: string, functionName: string, args: Args) => Promise<any>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [client, setClient] = useState<Provider | null>(null);
  const [providerList, setProviderList] = useState<Wallet[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Wallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const reconnect = async (provider: Wallet) => {
    try {
      const accounts = await provider.accounts();
      if (accounts && accounts.length > 0) {
        const acc = accounts[0];
        setClient(acc);
        setAccount(acc.address);
      }
    } catch (err) {
      console.error('Reconnection failed:', err);
      localStorage.removeItem('massa_provider');
    }
  };

  const connect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (providerList.length === 0) {
        throw new Error('No wallet provider found. Please install Massa Wallet or Bearby extension.');
      }

      // Use first available provider (or let user select)
      const provider = selectedProvider || providerList[0];
      setSelectedProvider(provider);

      // Request account access
      const accounts = await provider.accounts();

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please create an account in your wallet.');
      }

      const userAccount = accounts[0];
      setAccount(userAccount.address);
      setClient(userAccount);

      // Save provider preference
      localStorage.setItem('massa_provider', provider.name());

      console.log('Connected to Massa wallet:', userAccount.address);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAccount(null);
    setClient(null);
    localStorage.removeItem('massa_provider');
  };

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
      const result = await client.callSC({
        target: contractAddress,
        func: functionName,
        parameter: args.serialize(),
        maxGas: BigInt(200_000_000),
        coins: BigInt(coins),
      });

      return result;
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

  const value = {
    account,
    client,
    isConnecting,
    error,
    connect,
    disconnect,
    providerList,
    selectedProvider,
    callContract,
    readContract,
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
