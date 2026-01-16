/**
 * Quote data transformation utilities
 */

import { Token } from "@/shared/types/token";
import { SwapQuote } from "@/features/swap/types/swap";
import { formatUnits } from "@/lib/utils";

export interface QuoteResult {
  amountOut: string;
  fee: number;
  gasEstimate: string;
  poolAddress: string;
  route?: any;
  routePath: string[];
}

/**
 * Transform quote result to SwapQuote format
 */
export function transformQuoteResult(
  quoteResult: QuoteResult,
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string
): SwapQuote {
  // Calculate price as amountOut / amountIn for display
  const price = parseFloat(quoteResult.amountOut) / parseFloat(amountIn);

  // For price impact, we'd need to compare with spot price
  // For now, we'll set it to 0 and calculate it properly when we have trade data
  const priceImpact = 0;

  // Use extracted route path if available, otherwise fallback to direct path
  const routePath = quoteResult.routePath && quoteResult.routePath.length > 0
    ? quoteResult.routePath
    : [tokenIn.address.toLowerCase(), tokenOut.address.toLowerCase()];

  return {
    amountOut: quoteResult.amountOut,
    price,
    priceImpact,
    fee: quoteResult.fee,
    gasEstimate: quoteResult.gasEstimate,
    route: routePath,
    poolAddress: quoteResult.poolAddress,
  };
}
