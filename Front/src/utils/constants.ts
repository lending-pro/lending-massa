// Contract addresses - Update these after deployment
export const LENDING_POOL_ADDRESS = 'AS12Y7r6TgqA5jViufV9BQ37E3AsBEgCxaFUvk7RFSGQwBCTBHUrE'; // Replace with deployed contract address

// Network configuration
export const MASSA_NETWORK = {
  chainId: 77658366n, // Massa buildnet
  name: 'Massa Buildnet',
};

// RPC URL for buildnet
export const RPC_URL = 'https://buildnet.massa.net/api/v2';

// Default assets - Update with actual token addresses
export const DEFAULT_ASSETS = [
  {
    symbol: 'MAS',
    name: 'Massa',
    address: 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU', // WMAS address
    decimals: 9,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ', // USDC address
    decimals: 6,
  },
  // {
  //   symbol: 'WETH',
  //   name: 'Wrapped Ether',
  //   address: 'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk', // WETH address
  //   decimals: 18,
  // },
];

// Protocol parameters (basis points)
export const PROTOCOL_PARAMS = {
  COLLATERAL_FACTOR: 7500, // 75%
  LIQUIDATION_THRESHOLD: 8000, // 80%
  LIQUIDATION_PENALTY: 1000, // 10%
  BASIS_POINTS: 10000,
};

// UI constants
export const DECIMAL_PRECISION = 4;
export const REFRESH_INTERVAL = 10000; // 10 seconds
