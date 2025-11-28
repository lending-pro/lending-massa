/**
 * Format a large number (BigInt or string) to a human-readable format
 */
export function formatAmount(amount: string | bigint, decimals: number = 18, precision: number = 4): string {
  try {
    const value = typeof amount === 'string' ? BigInt(amount) : amount;
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.slice(0, precision).replace(/0+$/, '');

    if (trimmedFractional === '') {
      return integerPart.toString();
    }

    return `${integerPart}.${trimmedFractional}`;
  } catch {
    return '0';
  }
}

/**
 * Parse a decimal number to its smallest unit
 */
export function parseAmount(amount: string, decimals: number = 18): bigint {
  try {
    const [integer, decimal = ''] = amount.split('.');
    const paddedDecimal = decimal.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(integer + paddedDecimal);
  } catch {
    return 0n;
  }
}

/**
 * Format percentage from basis points
 */
export function formatPercentage(basisPoints: number | string): string {
  const bp = typeof basisPoints === 'string' ? parseInt(basisPoints) : basisPoints;
  return (bp / 100).toFixed(2) + '%';
}

/**
 * Calculate APR from basis points (simple interest - matches smart contract)
 * Basis points: 10000 = 100%
 *
 * Note: Smart contract uses simple interest, NOT compound interest.
 * This function returns the simple APR as a percentage.
 */
export function calculateAPY(aprBasisPoints: number): number {
  // Simple interest: just convert basis points to percentage
  // 200 basis points = 2%
  return aprBasisPoints / 100;
}

/**
 * Format APR from basis points (simple interest - matches smart contract)
 */
export function formatAPY(aprBasisPoints: number): string {
  const apr = calculateAPY(aprBasisPoints);
  return apr.toFixed(2) + '%';
}

/**
 * Calculate health factor
 */
export function calculateHealthFactor(
  collateralValue: bigint,
  debtValue: bigint,
  liquidationThreshold: number
): string {
  if (debtValue === 0n) {
    return '∞';
  }

  const adjustedCollateral = (collateralValue * BigInt(liquidationThreshold)) / 10000n;
  const healthFactor = (adjustedCollateral * 10000n) / debtValue;

  return formatAmount(healthFactor, 4, 2);
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format USD value
 */
export function formatUSD(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format timestamp to readable date
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}
