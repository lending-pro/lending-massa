export interface Asset {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: string;
  isSupported: boolean;
}

export interface UserPosition {
  collateral: string;
  debt: string;
  collateralValue: string;
  debtValue: string;
  healthFactor: string;
  maxBorrow: string;
  availableWithdraw: string;
}

export interface PoolStats {
  totalDeposits: string;
  totalBorrows: string;
  utilizationRate: string;
  depositAPY: string;
  borrowAPY: string;
}

export interface LiquidationCandidate {
  borrower: string;
  collateralToken: string;
  debtToken: string;
  collateralAmount: string;
  debtAmount: string;
  healthFactor: string;
}

export interface Transaction {
  type: 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'liquidate';
  asset: string;
  amount: string;
  timestamp: number;
  txHash: string;
  status: 'pending' | 'success' | 'failed';
}
