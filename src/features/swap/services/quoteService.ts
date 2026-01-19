/**
 * Quote Service
 * Encapsulates quote fetching logic
 */

import { Token } from '@/shared/types/token';
import { getRouterRoute } from './routerService';
import { SwapType } from '@/shared/types/router';

export interface QuoteRequest {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  slippage?: number;
  deadline?: number;
}

export interface QuoteResponse {
  amountOut: string;
  route: any;
  estimatedGasUsed: string;
}

/**
 * Get a quote for swapping tokens
 * Note: This is a simplified wrapper. For actual quotes, use useSwapQuote hook or getRouterRoute directly.
 */
export async function getQuote(request: QuoteRequest): Promise<QuoteResponse> {
  // This service is a placeholder - actual quote fetching should use useSwapQuote hook
  // or call getRouterRoute/getFastQuoteFromQuoter directly
  throw new Error('getQuote is not implemented. Use useSwapQuote hook or router services directly.');
}
