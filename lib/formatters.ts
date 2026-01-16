/**
 * Formatting utility functions
 * Extracted from lib/utils.ts for better organization
 */

export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatBalance(value: number | string, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  if (num === 0) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(0);
  }

  const absNum = Math.abs(num);

  if (absNum >= 1000000) {
    // Millions
    const millions = num / 1000000;
    return (
      new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(millions) + 'M'
    );
  } else if (absNum >= 1000) {
    // Thousands
    const thousands = num / 1000;
    return (
      new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(thousands) + 'K'
    );
  } else {
    // Less than 1000, format normally
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }
}

export function formatLargeInteger(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  if (num === 0) return '0';

  // For very large numbers, use scientific notation
  if (Math.abs(num) >= 1e15) {
    return num.toExponential(2);
  }

  // Otherwise, format with commas but no abbreviation
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatCurrency(value: number | string, currency = 'USD'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(num);
}

export function formatAddress(address: string, length = 4): string {
  if (!address) return '';
  return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
}

export function formatUnits(value: bigint, decimals = 18): string {
  const divisor = BigInt(10 ** decimals);
  const quotient = value / divisor;
  const remainder = value % divisor;
  if (remainder === BigInt(0)) {
    return quotient.toString();
  }
  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmed = remainderStr.replace(/0+$/, '');
  return trimmed ? `${quotient}.${trimmed}` : quotient.toString();
}
