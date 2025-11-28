// Contract addresses - Update these after deployment
export const LENDING_POOL_ADDRESS = 'AS12GPWH3kEheitPkFqECFtbHT2JtQ8Bo4TSqyirAFrRknmYRTAzQ'; // Replace with deployed contract address

// WMAS contract address (for wrapping/unwrapping native MAS)
export const WMAS_ADDRESS = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';

// Network configuration
export const MASSA_NETWORK = {
  chainId: 77658366n, // Massa buildnet
  name: 'Massa Buildnet',
};

// RPC URL for buildnet
export const RPC_URL = 'https://buildnet.massa.net/api/v2';

// Default assets
export const DEFAULT_ASSETS = [
  {
    symbol: 'WMAS',
    name: 'Wrapped Massa',
    address: 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU', // WMAS address
    decimals: 9,
    isWrappedNative: true, // Flag to show wrap/unwrap option
    logo: 'https://assets.coingecko.com/coins/images/29379/standard/Massa_Brand_Red.png',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ', // USDC address
    decimals: 6,
    isWrappedNative: false,
    logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
  },
  //  {
  //   symbol: 'WETH',
  //   name: 'Wrapped Ether',
  //   address: 'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk', // WETH address - Update after deployment
  //   decimals: 18,
  //   isWrappedNative: false,
  //   logo: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
  // }, // No WETH - USDC
  // {
  //   symbol: 'DUSA',
  //   name: 'Dusa Token',
  //   address: 'AS12WBfwEXfV5WQ41cBcwL6EzDZgWt7QdaBQ6ENoshXigKLJrJ7WS',
  //   decimals: 18,
  //   isWrappedNative: false,
  //   logo: 'https://assets.coingecko.com/markets/images/1563/large/Dusa_Labs_logo_carre%CC%81_%281%29.png?1713853529',
  // }, // No DUSA - USDC
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: 'AS1ZXy3nvqXAMm2w6viAg7frte6cZfJM8hoMvWf4KoKDzvLzYKqE',
    decimals: 8,
    isWrappedNative: false,
    logo: 'https://assets.coingecko.com/coins/images/7598/standard/wrapped_bitcoin_wbtc.png',
  },
];

// Protocol parameters (basis points)
export const PROTOCOL_PARAMS = {
  COLLATERAL_FACTOR: 7500, // 75%
  LIQUIDATION_THRESHOLD: 8000, // 80%
  LIQUIDATION_PENALTY: 1000, // 10%
  BASIS_POINTS: 10000,
  // Reserve Factor
  RESERVE_FACTOR: 1000, // 10% of interest goes to protocol
  // Liquidation Tuning
  CLOSE_FACTOR: 5000, // 50% max liquidation at once
  LIQUIDATION_BONUS_MIN: 500, // 5% min bonus
  LIQUIDATION_BONUS_MAX: 1500, // 15% max bonus
  // Flash Loans
  FLASH_LOAN_FEE: 9, // 0.09%
};

// UI constants
export const DECIMAL_PRECISION = 4;
export const REFRESH_INTERVAL = 10000; // 10 seconds

// Analytics constants
export const ANALYTICS_STORAGE_KEY = 'massa_lending_analytics';
export const MAX_ANALYTICS_HISTORY = 1000; // Max number of data points to store
