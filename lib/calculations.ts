/**
 * Calculation utility functions
 * Extracted from lib/utils.ts for better organization
 */

export function calculatePriceImpact(
  amountIn: bigint,
  amountOut: bigint,
  spotPrice: bigint
): number {
  if (!amountIn || !amountOut || !spotPrice) return 0;
  const expectedOut = (amountIn * spotPrice) / BigInt(10 ** 18);
  const impact = Number(expectedOut - amountOut) / Number(expectedOut);
  return Math.abs(impact * 100);
}

export function priceToSqrtPriceX96(
  price: number,
  token0Decimals: number,
  token1Decimals: number
): bigint {
  // Adjust price for decimals: price * 10^(token1Decimals - token0Decimals)
  const decimalsAdjustment = 10 ** (token1Decimals - token0Decimals);
  const adjustedPrice = price * decimalsAdjustment;

  // Calculate sqrt(adjustedPrice)
  const sqrtPrice = Math.sqrt(adjustedPrice);

  // Multiply by 2^96 and convert to bigint
  const Q96 = 2 ** 96;
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Q96));

  return sqrtPriceX96;
}
