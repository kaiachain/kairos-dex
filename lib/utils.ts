import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export {
  formatAddress,
  formatNumber,
  formatBalance,
  formatLargeInteger,
  formatCurrency,
  formatUnits,
} from "./formatters";

export {
  calculatePriceImpact,
  priceToSqrtPriceX96,
} from "./calculations";

export {
  parseUnits,
} from "./validators";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
