import { JsonRpcProvider } from '@ethersproject/providers';
import { Token as SDKToken } from '@uniswap/sdk-core';

/**
 * Router module types
 */
export interface RouterModule {
  AlphaRouter: any;
  SwapType: any;
}

export interface V3SubgraphModule {
  V3SubgraphProvider: any;
}

export interface V3PoolModule {
  V3PoolProvider: any;
}

export interface OnChainQuoteModule {
  OnChainQuoteProvider: any;
}

/**
 * AlphaRouter type (from @uniswap/smart-order-router)
 */
export interface AlphaRouter {
  route(
    amount: any,
    quoteCurrency: any,
    tradeType: any,
    options?: any
  ): Promise<any>;
}

/**
 * SwapType enum
 */
export enum SwapType {
  UNISWAP_V3 = 'UNISWAP_V3',
}

/**
 * V3SubgraphProvider type
 */
export interface V3SubgraphProvider {
  getPools(tokenIn: SDKToken, tokenOut: SDKToken): Promise<any[]>;
}

/**
 * V3PoolProvider type
 */
export interface V3PoolProvider {
  getPools(tokenPairs: any[]): Promise<any>;
}

/**
 * OnChainQuoteProvider type
 */
export interface OnChainQuoteProvider {
  getQuotes(requests: any[]): Promise<any[]>;
}

/**
 * Router instance type
 */
export interface RouterInstance {
  route(
    amount: any,
    quoteCurrency: any,
    tradeType: SwapType,
    options?: RouterOptions
  ): Promise<RouteResult>;
}

export interface RouterOptions {
  recipient?: string;
  slippageTolerance?: number;
  deadline?: number;
}

export interface RouteResult {
  route: any;
  quote: any;
  estimatedGasUsed: string;
}
