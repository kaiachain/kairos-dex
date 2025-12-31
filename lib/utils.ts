import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, length = 4): string {
  if (!address) return "";
  return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
}

export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatBalance(value: number | string, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  if (num === 0) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(0);
  }

  const absNum = Math.abs(num);

  if (absNum >= 1000000) {
    // Millions
    const millions = num / 1000000;
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(millions) + "M"
    );
  } else if (absNum >= 1000) {
    // Thousands
    const thousands = num / 1000;
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(thousands) + "K"
    );
  } else {
    // Less than 1000, format normally
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }
}

/**
 * Format large integer values (like liquidity) without abbreviation
 * Useful for displaying raw liquidity values that shouldn't be abbreviated
 */
export function formatLargeInteger(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  if (num === 0) return "0";
  
  // For very large numbers, use scientific notation
  if (Math.abs(num) >= 1e15) {
    return num.toExponential(2);
  }
  
  // Otherwise, format with commas but no abbreviation
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatCurrency(
  value: number | string,
  currency = "USD"
): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(num);
}

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

export function parseUnits(value: string, decimals = 18): bigint {
  const [integer, fraction = ""] = value.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(integer + paddedFraction);
}

export function formatUnits(value: bigint, decimals = 18): string {
  const divisor = BigInt(10 ** decimals);
  const quotient = value / divisor;
  const remainder = value % divisor;
  if (remainder === BigInt(0)) {
    return quotient.toString();
  }
  const remainderStr = remainder.toString().padStart(decimals, "0");
  const trimmed = remainderStr.replace(/0+$/, "");
  return trimmed ? `${quotient}.${trimmed}` : quotient.toString();
}

/**
 * Calculate sqrtPriceX96 from a price
 * Formula: sqrtPriceX96 = sqrt(price * 10^(token1Decimals - token0Decimals)) * 2^96
 * @param price - Price of token1 in terms of token0 (e.g., 1.5 means 1 token1 = 1.5 token0)
 * @param token0Decimals - Decimals of token0
 * @param token1Decimals - Decimals of token1
 * @returns sqrtPriceX96 as bigint
 */
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
