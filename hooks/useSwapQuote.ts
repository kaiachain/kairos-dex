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
  routePath: string[];
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
    console.log(`Finding route: ${tokenIn.symbol} -> ${tokenOut.symbol}`);
    const route = await router.route(amountInCurrency, sdkTokenOut, TradeType.EXACT_INPUT, options);

    if (!route || !route.methodParameters) {
      console.warn(`No route found for ${tokenIn.symbol} -> ${tokenOut.symbol}`);
      return null;
    }

    // Extract quote information
    const quote = route.quote;
    const amountOut = quote.toExact();

    // Debug: Log the route structure - log the full route object for inspection
    console.log('Full route object:', route);
    console.log('Route object structure:', {
      hasRoute: !!route.route,
      routeType: Array.isArray(route.route) ? 'array' : typeof route.route,
      routeLength: Array.isArray(route.route) ? route.route.length : 'N/A',
      routeKeys: Object.keys(route),
      hasTrade: 'trade' in route,
      hasTokenPath: 'tokenPath' in route,
      firstRoute: route.route && Array.isArray(route.route) ? route.route[0] : null,
    });
    
    // Check if route has a trade property with route information
    if (route.trade) {
      console.log('Route has trade property:', {
        tradeType: typeof route.trade,
        tradeKeys: Object.keys(route.trade),
        hasRoutes: 'routes' in route.trade,
        routes: route.trade.routes,
      });
    }
    
    // Try to extract path from route.tokenPath if available (some router versions have this)
    if ('tokenPath' in route && Array.isArray((route as any).tokenPath)) {
      const tokenPath = (route as any).tokenPath.map((t: any) => {
        if (typeof t === 'string') return t.toLowerCase();
        if (t?.address) return t.address.toLowerCase();
        return null;
      }).filter(Boolean) as string[];
      
      if (tokenPath.length > 0) {
        console.log('Found tokenPath on route object:', tokenPath);
        return {
          amountOut,
          fee: 0,
          gasEstimate: route.estimatedGasUsed?.toString() || "0",
          poolAddress: "",
          route: route.route,
          routePath: tokenPath,
        };
      }
    }

    // Extract route path and pool information
    let poolAddress = "";
    let fee = 0;
    const routePath: string[] = [tokenIn.address.toLowerCase()]; // Start with input token
    
    // Try multiple extraction methods
    
    // Method 1: Try route.trade.routes (newer router versions)
    if (route.trade && route.trade.routes && Array.isArray(route.trade.routes) && route.trade.routes.length > 0) {
      console.log('Found route.trade.routes, extracting path...');
      const firstTradeRoute = route.trade.routes[0] as any;
      
      // Try route.trade.routes[0].path first (direct property - THIS IS THE ONE!)
      if (firstTradeRoute?.path && Array.isArray(firstTradeRoute.path)) {
        console.log('Found firstTradeRoute.path, extracting...', firstTradeRoute.path);
        const tokenPath = firstTradeRoute.path.map((t: any) => {
          // Token objects from SDK have address property
          if (t?.address) {
            return t.address.toLowerCase();
          }
          // Fallback for string addresses
          if (typeof t === 'string') {
            return t.toLowerCase();
          }
          console.warn('Unknown token format in path:', t);
          return null;
        }).filter(Boolean) as string[];
        
        if (tokenPath.length > 0) {
          console.log('✅ Extracted path from route.trade.routes[0].path:', tokenPath);
          routePath.length = 0;
          routePath.push(...tokenPath);
        } else {
          console.warn('Failed to extract path from firstTradeRoute.path');
        }
      }
      
      // Fallback: Try route.trade.routes[0].tokenPath (direct property)
      if (routePath.length <= 1 && firstTradeRoute?.tokenPath && Array.isArray(firstTradeRoute.tokenPath)) {
        console.log('Trying firstTradeRoute.tokenPath as fallback...', firstTradeRoute.tokenPath);
        const tokenPath = firstTradeRoute.tokenPath.map((t: any) => {
          if (t?.address) {
            return t.address.toLowerCase();
          }
          if (typeof t === 'string') {
            return t.toLowerCase();
          }
          return null;
        }).filter(Boolean) as string[];
        
        if (tokenPath.length > 0) {
          console.log('✅ Extracted path from route.trade.routes[0].tokenPath:', tokenPath);
          routePath.length = 0;
          routePath.push(...tokenPath);
        }
      }
      
      // Try extracting from pools in trade route
      if (routePath.length <= 1 && firstTradeRoute?.pools && Array.isArray(firstTradeRoute.pools)) {
        console.log('Extracting from route.trade.routes[0].pools...');
        routePath.length = 0;
        routePath.push(tokenIn.address.toLowerCase());
        let currentToken = tokenIn.address.toLowerCase();
        
        for (const pool of firstTradeRoute.pools) {
          const token0 = pool.token0?.address?.toLowerCase() || 
                       (typeof pool.token0 === 'string' ? pool.token0.toLowerCase() : null);
          const token1 = pool.token1?.address?.toLowerCase() || 
                       (typeof pool.token1 === 'string' ? pool.token1.toLowerCase() : null);
          
          if (token0 && token1) {
            const nextToken = currentToken === token0 ? token1 : 
                            currentToken === token1 ? token0 : null;
            
            if (nextToken && !routePath.includes(nextToken)) {
              routePath.push(nextToken);
              currentToken = nextToken;
            }
          }
        }
        
        const tokenOutLower = tokenOut.address.toLowerCase();
        if (routePath[routePath.length - 1] !== tokenOutLower) {
          routePath.push(tokenOutLower);
        }
        
        if (routePath.length > 1) {
          console.log('Extracted path from route.trade.routes[0].pools:', routePath);
        }
      }
    }
    
    // Fallback to route.route structure
    if (route.route && Array.isArray(route.route) && route.route.length > 0) {
      const firstRoute = route.route[0] as any;
      
      // Debug: Log first route structure
      console.log('First route structure:', {
        hasPools: 'pools' in firstRoute,
        poolsLength: firstRoute?.pools?.length || 0,
        hasPath: 'path' in firstRoute,
        pathType: firstRoute?.path ? (Array.isArray(firstRoute.path) ? 'array' : typeof firstRoute.path) : 'none',
        routeKeys: Object.keys(firstRoute || {}),
      });
      
      // Check if it's a V3 route
      if (firstRoute && 'pools' in firstRoute && firstRoute.pools && Array.isArray(firstRoute.pools)) {
        // Try to extract path from route.path if available (most reliable)
        if (firstRoute.path && Array.isArray(firstRoute.path)) {
          routePath.length = 0; // Reset
          routePath.push(...firstRoute.path.map((t: any) => {
            if (typeof t === 'string') return t.toLowerCase();
            if (t?.address) return t.address.toLowerCase();
            return null;
          }).filter(Boolean) as string[]);
          console.log('Extracted path from route.path:', routePath);
        } else {
          // Fallback: Extract token path from pools (multi-hop support)
          routePath.length = 0; // Reset to rebuild from pools
          routePath.push(tokenIn.address.toLowerCase()); // Start with input token
          let currentToken = tokenIn.address.toLowerCase();
          
          console.log('Extracting path from pools, starting with:', currentToken);
          
          for (let i = 0; i < firstRoute.pools.length; i++) {
            const pool = firstRoute.pools[i];
            
            // Debug: Log pool structure
            if (i === 0) {
              console.log('First pool structure:', {
                hasToken0: 'token0' in pool,
                hasToken1: 'token1' in pool,
                token0Type: typeof pool.token0,
                token1Type: typeof pool.token1,
                poolKeys: Object.keys(pool),
              });
            }
            
            // Try different property names for tokens
            const token0 = pool.token0?.address?.toLowerCase() || 
                         pool.tokenA?.address?.toLowerCase() ||
                         (typeof pool.token0 === 'string' ? pool.token0.toLowerCase() : null);
            const token1 = pool.token1?.address?.toLowerCase() || 
                         pool.tokenB?.address?.toLowerCase() ||
                         (typeof pool.token1 === 'string' ? pool.token1.toLowerCase() : null);
            
            console.log(`Pool ${i}: token0=${token0}, token1=${token1}, currentToken=${currentToken}`);
            
            if (token0 && token1) {
              // Find which token is the output (not the current token)
              const nextToken = currentToken === token0 ? token1 : 
                              currentToken === token1 ? token0 : null;
              
              if (nextToken) {
                if (!routePath.includes(nextToken)) {
                  routePath.push(nextToken);
                  console.log(`Added token to path: ${nextToken}, path now:`, routePath);
                }
                currentToken = nextToken;
              }
            }
          }
          
          // Ensure output token is in the path
          const tokenOutLower = tokenOut.address.toLowerCase();
          if (routePath[routePath.length - 1] !== tokenOutLower) {
            routePath.push(tokenOutLower);
            console.log('Added output token to path:', tokenOutLower);
          }
          
          console.log('Final path extracted from pools:', routePath);
        }
        
        // Extract fee from first pool
        if (firstRoute.pools.length > 0) {
          const firstPool = firstRoute.pools[0];
          fee = firstPool.fee || firstPool.feeTier || 0;
          
          // Get pool address if available
          if (firstPool.poolAddress) {
            poolAddress = firstPool.poolAddress;
          } else if (firstPool.address) {
            poolAddress = firstPool.address;
          }
        }
      } else if (firstRoute && 'path' in firstRoute) {
        // V2 route - extract path directly
        if (Array.isArray(firstRoute.path)) {
          routePath.length = 0; // Reset
          routePath.push(...firstRoute.path.map((t: any) => 
            (typeof t === 'string' ? t : t.address)?.toLowerCase()
          ).filter(Boolean));
        }
      }
    }

    // Ensure we always have at least input and output tokens
    const tokenInLower = tokenIn.address.toLowerCase();
    const tokenOutLower = tokenOut.address.toLowerCase();
    
    if (routePath.length === 1 && routePath[0] === tokenInLower) {
      // Only input token found, add output token
      routePath.push(tokenOutLower);
      console.log('Added output token to path (fallback):', routePath);
    } else if (routePath.length > 1 && routePath[routePath.length - 1] !== tokenOutLower) {
      // Path exists but doesn't end with output token
      routePath.push(tokenOutLower);
      console.log('Added output token to end of path:', routePath);
    }

    // Get gas estimate
    const gasEstimate = route.estimatedGasUsed?.toString() || "0";

    // Log route information for debugging
    console.log('Route found:', {
      hops: routePath.length - 1,
      path: routePath,
      amountOut,
      pools: route.route?.[0]?.pools?.length || route.trade?.routes?.[0]?.route?.pools?.length || 0,
      routeStructure: route.route ? 'route.route' : route.trade ? 'route.trade' : 'unknown'
    });

    return {
      amountOut,
      fee,
      gasEstimate,
      poolAddress,
      route: route.route,
      routePath, // Add extracted path
    };
  } catch (error) {
    console.error("Error getting quote from router:", error);
    // Log more details about the error for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
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

        // Use extracted route path if available, otherwise fallback to direct path
        const routePath = quoteResult.routePath && quoteResult.routePath.length > 0
          ? quoteResult.routePath
          : [tokenIn.address.toLowerCase(), tokenOut.address.toLowerCase()];

        console.log('Setting quote with route:', {
          routePath,
          routePathLength: routePath.length,
          hasRoutePath: !!quoteResult.routePath,
          originalRoutePath: quoteResult.routePath,
        });

        setQuote({
          amountOut: quoteResult.amountOut,
          price,
          priceImpact,
          fee: quoteResult.fee,
          gasEstimate: quoteResult.gasEstimate,
          route: routePath, // Use extracted multi-hop path
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

    // Get route - the router automatically finds multi-hop routes
    console.log(`Getting route for execution: ${tokenIn.symbol} -> ${tokenOut.symbol}`);
    const route = await router.route(amountInCurrency, sdkTokenOut, TradeType.EXACT_INPUT, options);

    if (!route || !route.methodParameters) {
      console.warn(`No route found for execution: ${tokenIn.symbol} -> ${tokenOut.symbol}`);
      return null;
    }

    // Log route information for debugging
    if (route.route && Array.isArray(route.route) && route.route.length > 0) {
      const firstRoute = route.route[0] as any;
      const poolCount = firstRoute?.pools?.length || 0;
      console.log(`Route found for execution: ${poolCount} pool(s) in path`);
    }

    return {
      route,
      methodParameters: route.methodParameters,
      quote: route.quote,
    };
  } catch (error) {
    console.error("Error getting router route:", error);
    // Log more details about the error for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return null;
  }
}
