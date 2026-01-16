/**
 * Router Service
 * Encapsulates router instance creation and usage
 */

import { JsonRpcProvider } from '@ethersproject/providers';
import { getRouterInstance } from '@/lib/router-instance';
import { RouterInstance, RouterOptions, RouteResult, SwapType } from '@/types/router';

/**
 * Get a route for swapping tokens
 */
export async function getRoute(
  amount: any,
  quoteCurrency: any,
  tradeType: SwapType,
  options?: RouterOptions
): Promise<RouteResult> {
  const router = await getRouterInstance();
  return router.route(amount, quoteCurrency, tradeType, options);
}

/**
 * Get router instance
 */
export async function getRouter(provider?: JsonRpcProvider): Promise<RouterInstance> {
  return getRouterInstance(provider);
}
