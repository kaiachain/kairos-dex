/**
 * Validation utility functions
 */

export function parseUnits(value: string, decimals = 18): bigint {
  const [integer, fraction = ''] = value.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(integer + paddedFraction);
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidAmount(amount: string): boolean {
  if (amount === '') return true;
  return /^\d*\.?\d*$/.test(amount);
}

export function isPositiveNumber(value: string): boolean {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}
