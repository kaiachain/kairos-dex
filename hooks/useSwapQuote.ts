/**
 * Swap Quote Hook using Smart Order Router
 * 
 * This hook uses the centralized router instance for getting quotes
 */

import { useState, useEffect, useMemo } from "react";
import { Token } from "@/types/token";
import { SwapQuote } from "@/types/swap";
import { CurrencyAmount, TradeType, ChainId } from "@uniswap/sdk-core";
import { getAddress } from "@ethersproject/address";
import { JsonRpcProvider } from "@ethersproject/providers";
import { usePublicClient } from "wagmi";
import { RPC_URL } from "@/config/env";
import { getRouterInstance } from "@/lib/router-instance";
import { fromReadableAmount, TokenAmount } from "@/lib/router-setup";

// Convert app Token to SDK Token
function tokenToSDKToken(token: Token) {
  const { Token: SDKToken } = require("@uniswap/sdk-core");
  return new SDKToken(
    ChainId.MAINNET,
    getAddress(token.address),
    token.decimals || 18,
    token.symbol,
    token.name
  );
}

/**
 * Get quote using AlphaRouter
 * Following execute-swap-sdk.js main function pattern
 */
async function getQuoteFromRouter(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  provider: JsonRpcProvider
): Promise<{
  amountOut: string;
  fee: number;
  gasEstimate: string;
  poolAddress: string;
  route: any;
} | null> {
  try {
    // Only run on client side
    if (typeof window === 'undefined') {
      return null;
    }

    // Get router instance
    const router = await getRouterInstance(provider);
    
    // Get SwapType from router module
    const routerModule = await import("@uniswap/smart-order-router/build/main");
    const SwapType = routerModule.SwapType;

    // Convert tokens to SDK tokens
    const sdkTokenIn = tokenToSDKToken(tokenIn);
    const sdkTokenOut = tokenToSDKToken(tokenOut);

    // Create input amount
    const rawTokenAmountIn = fromReadableAmount(parseFloat(amountIn), tokenIn.decimals || 18);
    const amountInCurrency = TokenAmount(sdkTokenIn, rawTokenAmountIn.toString());

    // Create swap options
    const { Percent } = require("@uniswap/sdk-core");
    const options = {
      recipient: "0x0000000000000000000000000000000000000000", // Not needed for quote
      slippageTolerance: new Percent(50, 10_000), // 0.5% default
      deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
      type: SwapType?.SWAP_ROUTER_02 ?? 1, // SWAP_ROUTER_02 = 1
    };

    // Get route
    const route = await router.route(amountInCurrency, sdkTokenOut, TradeType.EXACT_INPUT, options);

    if (!route || !route.methodParameters) {
      return null;
    }

    // Extract quote information
    const quote = route.quote;
    const amountOut = quote.toExact();

    // Extract pool address from route
    let poolAddress = "";
    let fee = 0;
    if (route.route && Array.isArray(route.route) && route.route.length > 0) {
      const firstRoute = route.route[0] as any;
      // Check if it's a V3 route
      if (firstRoute && 'pools' in firstRoute && firstRoute.pools && Array.isArray(firstRoute.pools) && firstRoute.pools.length > 0) {
        const pool = firstRoute.pools[0];
        // Pool address is not directly available, we'll need to derive it
        // For now, we'll use a placeholder and extract from route data
        poolAddress = ""; // Will be extracted from route if available
        fee = pool.fee || 0;
      } else if (firstRoute && 'path' in firstRoute) {
        // V2 route - not applicable for V3
        fee = 0;
      }
    }

    // Get gas estimate
    const gasEstimate = route.estimatedGasUsed?.toString() || "0";

    return {
      amountOut,
      fee,
      gasEstimate,
      poolAddress,
      route: route.route,
    };
  } catch (error) {
    console.error("Error getting quote from router:", error);
    return null;
  }
}

/**
 * React hook for getting swap quotes using Smart Order Router
 */
export function useSwapQuote(
  tokenIn: Token | null,
  tokenOut: Token | null,
  amountIn: string
) {
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const publicClient = usePublicClient();

  // Create provider from publicClient (only on client side)
  const provider = useMemo(() => {
    if (typeof window === 'undefined') return null;
    if (!publicClient) return null;
    // Convert viem PublicClient to ethers JsonRpcProvider
    try {
      return new JsonRpcProvider(RPC_URL);
    } catch (error) {
      console.error('Failed to create provider:', error);
      return null;
    }
  }, [publicClient]);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0 || !provider) {
      setQuote(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchQuote = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const quoteResult = await getQuoteFromRouter(tokenIn, tokenOut, amountIn, provider);

        if (cancelled) return;

        if (!quoteResult) {
          setQuote(null);
          setIsLoading(false);
          return;
        }

        // Calculate price as amountOut / amountIn for display
        const price = parseFloat(quoteResult.amountOut) / parseFloat(amountIn);

        // For price impact, we'd need to compare with spot price
        // For now, we'll set it to 0 and calculate it properly when we have trade data
        const priceImpact = 0;

        setQuote({
          amountOut: quoteResult.amountOut,
          price,
          priceImpact,
          fee: quoteResult.fee,
          gasEstimate: quoteResult.gasEstimate,
          route: [tokenIn.address, tokenOut.address],
          poolAddress: quoteResult.poolAddress,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching swap quote:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch quote")
        );
        setQuote(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchQuote();

    return () => {
      cancelled = true;
    };
  }, [tokenIn, tokenOut, amountIn, provider]);

  return { data: quote, isLoading, error };
}

/**
 * Get router route for swap execution
 * Following execute-swap-sdk.js pattern for getting route
 */
export async function getRouterRoute(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  slippageTolerance: number,
  deadlineMinutes: number,
  recipient: string,
  provider: JsonRpcProvider
): Promise<{
  route: any;
  methodParameters: any;
  quote: CurrencyAmount<any>;
} | null> {
  try {
    // Only run on client side
    if (typeof window === 'undefined') {
      return null;
    }

    // Get router instance
    const router = await getRouterInstance(provider);
    
    // Get SwapType from router module
    const routerModule = await import("@uniswap/smart-order-router/build/main");
    const SwapType = routerModule.SwapType;

    // Convert tokens to SDK tokens
    const sdkTokenIn = tokenToSDKToken(tokenIn);
    const sdkTokenOut = tokenToSDKToken(tokenOut);

    // Create input amount
    const rawTokenAmountIn = fromReadableAmount(parseFloat(amountIn), tokenIn.decimals || 18);
    const amountInCurrency = TokenAmount(sdkTokenIn, rawTokenAmountIn.toString());

    // Create swap options
    const { Percent } = require("@uniswap/sdk-core");
    const options = {
      recipient,
      slippageTolerance: new Percent(Math.floor(slippageTolerance * 100), 10_000),
      deadline: Math.floor(Date.now() / 1000) + 60 * deadlineMinutes,
      type: SwapType?.SWAP_ROUTER_02 ?? 1, // SWAP_ROUTER_02 = 1
    };

    // Get route
    const route = await router.route(amountInCurrency, sdkTokenOut, TradeType.EXACT_INPUT, options);

    if (!route || !route.methodParameters) {
      return null;
    }

    return {
      route,
      methodParameters: route.methodParameters,
      quote: route.quote,
    };
  } catch (error) {
    console.error("Error getting router route:", error);
    return null;
  }
}
