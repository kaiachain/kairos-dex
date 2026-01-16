import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Re-export formatters for backward compatibility
export {
  formatAddress,
  formatNumber,
  formatBalance,
  formatLargeInteger,
  formatCurrency,
  formatUnits,
} from "./formatters";

// Re-export calculations for backward compatibility
export {
  calculatePriceImpact,
  priceToSqrtPriceX96,
} from "./calculations";

// Re-export validators for backward compatibility
export {
  parseUnits,
} from "./validators";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
