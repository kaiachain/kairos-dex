/**
 * Quote Service
 * Encapsulates quote fetching logic
 */

import { Token } from '@/types/token';
import { getRoute } from './routerService';
import { SwapType } from '@/types/router';

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
 */
export async function getQuote(request: QuoteRequest): Promise<QuoteResponse> {
  // This is a simplified version - the actual implementation would use the router service
  // and format the response appropriately
  const route = await getRoute(
    request.amountIn,
    request.tokenOut,
    SwapType.UNISWAP_V3,
    {
      slippageTolerance: request.slippage,
      deadline: request.deadline,
    }
  );

  return {
    amountOut: route.quote?.amountOut || '0',
    route: route.route,
    estimatedGasUsed: route.estimatedGasUsed,
  };
}
