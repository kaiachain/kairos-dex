/**
 * Router Service
 * Handles quote fetching using Smart Order Router for complex/multi-hop routes
 */

import { Token } from "@/shared/types/token";
import { CurrencyAmount, TradeType, ChainId, Token as SDKToken, Percent } from "@uniswap/sdk-core";
import { getAddress } from "@ethersproject/address";
import { JsonRpcProvider } from "@ethersproject/providers";
import { getRouterInstance } from "@/lib/router-instance";
import { fromReadableAmount, TokenAmount } from "@/lib/router-setup";
import { formatUnits } from "@/lib/utils";
import { addStatusMessage } from "@/app/providers/contexts/SwapStatusContext";

export interface RouterQuoteResult {
  amountOut: string;
  fee: number;
  gasEstimate: string;
  poolAddress: string;
  route: any;
  routePath: string[];
  fullRoute?: any; // Store full route object with methodParameters for execution
}

// Convert app Token to SDK Token
function tokenToSDKToken(token: Token): SDKToken {
  return new SDKToken(
    ChainId.MAINNET,
    getAddress(token.address),
    token.decimals || 18,
    token.symbol,
    token.name
  );
}

/**
 * Extract quote amount from route object
 */
function extractQuoteAmount(quote: any, tokenOut: Token): string {
  // Try multiple methods to extract the amount
  if (typeof quote.toExact === 'function') {
    return quote.toExact();
  } else if (typeof quote.toFixed === 'function') {
    return quote.toFixed(tokenOut.decimals || 18);
  } else if (quote.quotient !== undefined) {
    const quotient = typeof quote.quotient === 'bigint' 
      ? quote.quotient 
      : BigInt(quote.quotient.toString());
    return formatUnits(quotient, tokenOut.decimals || 18);
  } else if (typeof quote.toString === 'function') {
    const quoteStr = quote.toString();
    const match = quoteStr.match(/[\d.]+/);
    if (match) return match[0];
    throw new Error('Could not parse quote from toString()');
  } else {
    throw new Error('Quote object does not have toExact, toFixed, quotient, or toString method');
  }
}

/**
 * Extract route path from route object
 */
function extractRoutePath(route: any, tokenIn: Token, tokenOut: Token): string[] {
  const routePath: string[] = [tokenIn.address.toLowerCase()];
  const tokenInLower = tokenIn.address.toLowerCase();
  const tokenOutLower = tokenOut.address.toLowerCase();
  
  // Try route.tokenPath first (some router versions have this)
  if ('tokenPath' in route && Array.isArray((route as any).tokenPath)) {
    const tokenPath = (route as any).tokenPath.map((t: any) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t?.address) return t.address.toLowerCase();
      return null;
    }).filter(Boolean) as string[];
    
    if (tokenPath.length > 0) {
      return tokenPath;
    }
  }
  
  // Method 1: Try route.trade.routes (newer router versions)
  if (route.trade?.routes && Array.isArray(route.trade.routes) && route.trade.routes.length > 0) {
    const firstTradeRoute = route.trade.routes[0] as any;
    
    // Try route.trade.routes[0].path
    if (firstTradeRoute?.path && Array.isArray(firstTradeRoute.path)) {
      const tokenPath = firstTradeRoute.path.map((t: any) => {
        if (t?.address) return t.address.toLowerCase();
        if (typeof t === 'string') return t.toLowerCase();
        return null;
      }).filter(Boolean) as string[];
      
      if (tokenPath.length > 0) {
        return tokenPath;
      }
    }
    
    // Try route.trade.routes[0].tokenPath
    if (firstTradeRoute?.tokenPath && Array.isArray(firstTradeRoute.tokenPath)) {
      const tokenPath = firstTradeRoute.tokenPath.map((t: any) => {
        if (t?.address) return t.address.toLowerCase();
        if (typeof t === 'string') return t.toLowerCase();
        return null;
      }).filter(Boolean) as string[];
      
      if (tokenPath.length > 0) {
        return tokenPath;
      }
    }
    
    // Extract from pools
    if (firstTradeRoute?.pools && Array.isArray(firstTradeRoute.pools)) {
      routePath.length = 0;
      routePath.push(tokenInLower);
      let currentToken = tokenInLower;
      
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
      
      if (routePath[routePath.length - 1] !== tokenOutLower) {
        routePath.push(tokenOutLower);
      }
      
      if (routePath.length > 1) {
        return routePath;
      }
    }
  }
  
  // Fallback to route.route structure
  if (route.route && Array.isArray(route.route) && route.route.length > 0) {
    const firstRoute = route.route[0] as any;
    
    if (firstRoute?.path && Array.isArray(firstRoute.path)) {
      return firstRoute.path.map((t: any) => {
        if (typeof t === 'string') return t.toLowerCase();
        if (t?.address) return t.address.toLowerCase();
        return null;
      }).filter(Boolean) as string[];
    }
    
    if (firstRoute?.pools && Array.isArray(firstRoute.pools)) {
      routePath.length = 0;
      routePath.push(tokenInLower);
      let currentToken = tokenInLower;
      
      for (const pool of firstRoute.pools) {
        const token0 = pool.token0?.address?.toLowerCase() || 
                     pool.tokenA?.address?.toLowerCase() ||
                     (typeof pool.token0 === 'string' ? pool.token0.toLowerCase() : null);
        const token1 = pool.token1?.address?.toLowerCase() || 
                     pool.tokenB?.address?.toLowerCase() ||
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
      
      if (routePath[routePath.length - 1] !== tokenOutLower) {
        routePath.push(tokenOutLower);
      }
      
      return routePath;
    }
  }
  
  // Ensure we always have at least input and output tokens
  if (routePath.length === 1 && routePath[0] === tokenInLower) {
    routePath.push(tokenOutLower);
  } else if (routePath.length > 1 && routePath[routePath.length - 1] !== tokenOutLower) {
    routePath.push(tokenOutLower);
  }
  
  return routePath;
}

/**
 * Get quote using AlphaRouter (fallback for complex routes)
 */
export async function getQuoteFromRouter(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  provider: JsonRpcProvider
): Promise<RouterQuoteResult | null> {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    const router = await getRouterInstance(provider);
    const routerModule = await import("@uniswap/smart-order-router/build/main");
    const SwapType = routerModule.SwapType;

    const sdkTokenIn = tokenToSDKToken(tokenIn);
    const sdkTokenOut = tokenToSDKToken(tokenOut);

    const rawTokenAmountIn = fromReadableAmount(parseFloat(amountIn), tokenIn.decimals || 18);
    const amountInCurrency = TokenAmount(sdkTokenIn, rawTokenAmountIn.toString());

    const defaultOptions = {
      recipient: "0x0000000000000000000000000000000000000000",
      slippageTolerance: new Percent(50, 10_000), // 0.5% default
      deadline: Math.floor(Date.now() / 1000) + 60 * 20,
      type: SwapType?.SWAP_ROUTER_02 ?? 1,
    };

    console.log(`Finding route: ${tokenIn.symbol} -> ${tokenOut.symbol} (may be multi-hop)`);
    addStatusMessage('loading', 'Smart Order Router: Finding route...', 'Exploring pools and paths');
    const startTime = Date.now();
    
    const routePromise = router.route(amountInCurrency, sdkTokenOut, TradeType.EXACT_INPUT, defaultOptions);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Quote request timeout after 20 seconds')), 20000)
    );
    
    let route: any;
    try {
      route = await Promise.race([routePromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      
      if (!route || route === null) {
        console.error(`❌ Router returned null (no route found) after ${duration}ms`);
        addStatusMessage('error', `No route found after ${(duration / 1000).toFixed(2)}s`, 'No valid path exists between these tokens. Check if pools exist.');
        return null;
      }
      
      console.log(`✅ Route found in ${duration}ms (total)`);
      addStatusMessage('success', `Route found in ${(duration / 1000).toFixed(2)}s`, `Analyzing route structure...`);
      
      if (route.estimatedGasUsed) {
        addStatusMessage('info', `Gas estimate: ${route.estimatedGasUsed.toString()}`, 'Calculated by router');
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = error?.message || String(error);
      
      if (errorMsg.includes('timeout')) {
        console.error(`❌ Route fetch timeout after ${duration}ms`);
        addStatusMessage('error', `Route fetch timeout after ${(duration / 1000).toFixed(2)}s`, 'Multi-hop routes may take longer. Please try again.');
        throw new Error('Quote request timed out. Multi-hop routes may take longer.');
      } else {
        console.error(`❌ Route fetch failed after ${duration}ms:`, error);
        addStatusMessage('error', `Route fetch failed: ${errorMsg}`, 'Please check your connection and try again.');
        throw error;
      }
    }

    try {
      if (!route || !route.methodParameters) {
        if (!route?.quote && !route?.trade?.quote) {
          console.error('❌ No quote found and no methodParameters - cannot proceed');
          return null;
        }
      }

      // Extract quote information
      let quote = route.quote;
      
      if (!quote && route.trade) {
        quote = route.trade.quote || route.trade.outputAmount;
      }
      
      if (!quote && route.trade?.routes?.[0]) {
        quote = route.trade.routes[0].quote || route.trade.routes[0].outputAmount;
      }
      
      if (!quote) {
        throw new Error('Route found but quote property is missing from all expected locations');
      }
      
      const amountOut = extractQuoteAmount(quote, tokenOut);
      
      if (!amountOut || amountOut === '0' || amountOut === 'NaN' || isNaN(parseFloat(amountOut))) {
        throw new Error(`Invalid quote amount: ${amountOut}`);
      }

      // Extract route path
      const routePath = extractRoutePath(route, tokenIn, tokenOut);
      
      // Extract fee and pool address
      let poolAddress = "";
      let fee = 0;
      
      if (route.route && Array.isArray(route.route) && route.route.length > 0) {
        const firstRoute = route.route[0] as any;
        if (firstRoute?.pools && firstRoute.pools.length > 0) {
          const firstPool = firstRoute.pools[0];
          fee = firstPool.fee || firstPool.feeTier || 0;
          poolAddress = firstPool.poolAddress || firstPool.address || "";
        }
      }

      const gasEstimate = route.estimatedGasUsed?.toString() || "0";

      console.log('Route found:', {
        hops: routePath.length - 1,
        path: routePath,
        amountOut,
        pools: route.route?.[0]?.pools?.length || route.trade?.routes?.[0]?.route?.pools?.length || 0,
      });

      // Attach options to route for later comparison (so we can reuse methodParameters)
      if (route) {
        route.options = {
          recipient: defaultOptions.recipient,
          slippageTolerance: defaultOptions.slippageTolerance,
          deadline: defaultOptions.deadline,
        };
      }
      
      return {
        amountOut,
        fee,
        gasEstimate,
        poolAddress,
        route: route.route,
        routePath,
        fullRoute: route, // Store full route object with methodParameters for execution
      };
    } catch (quoteExtractionError: any) {
      console.error("❌ Error during quote extraction:", quoteExtractionError);
      throw quoteExtractionError;
    }
  } catch (error) {
    console.error("Error getting quote from router:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return null;
  }
}

/**
 * Get router route for swap execution
 */
export async function getRouterRoute(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  slippageTolerance: number,
  deadlineMinutes: number,
  recipient: string,
  provider: JsonRpcProvider,
  cachedRoute?: any
): Promise<{
  route: any;
  methodParameters: any;
  quote: CurrencyAmount<any>;
} | null> {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    // Check if we have a cached route with matching parameters
    if (cachedRoute?.route) {
      const cachedRouteObj = cachedRoute.route;
      const cachedAmountIn = cachedRouteObj.trade?.inputAmount;
      const sdkTokenIn = tokenToSDKToken(tokenIn);
      const rawTokenAmountIn = fromReadableAmount(parseFloat(amountIn), tokenIn.decimals || 18);
      const amountInCurrency = TokenAmount(sdkTokenIn, rawTokenAmountIn.toString());
      
      // Check if amount matches
      if (cachedAmountIn && cachedAmountIn.toExact() === amountInCurrency.toExact()) {
        // Check if cached route has methodParameters we can potentially reuse
        if (cachedRouteObj.methodParameters) {
          // Check if we can reuse methodParameters directly
          // MethodParameters include recipient and deadline, so we need to check those
          const cachedOptions = cachedRouteObj.options || {};
          const currentDeadline = Math.floor(Date.now() / 1000) + 60 * deadlineMinutes;
          const currentSlippage = new Percent(Math.floor(slippageTolerance * 100), 10_000);
          
          // Check if recipient, slippage, and deadline are close enough to reuse
          const recipientMatches = cachedOptions.recipient === recipient;
          const deadlineClose = cachedOptions.deadline 
            ? Math.abs(cachedOptions.deadline - currentDeadline) < 300 // Within 5 minutes
            : false;
          const slippageClose = cachedOptions.slippageTolerance
            ? Math.abs(Number(cachedOptions.slippageTolerance.numerator) - Number(currentSlippage.numerator)) < 10
            : false;
          
          // If all parameters match closely, we can reuse methodParameters directly (INSTANT!)
          if (recipientMatches && deadlineClose && slippageClose) {
            console.log(`✅ Reusing cached methodParameters directly - INSTANT (no router call)`);
            addStatusMessage('success', 'Using cached methodParameters', 'Instant - no refetch needed');
            return {
              route: cachedRouteObj,
              methodParameters: cachedRouteObj.methodParameters,
              quote: cachedRouteObj.quote,
            };
          }
          
          // If only recipient changed, we still need to regenerate (but should be faster)
          console.log(`⚠️ Parameters changed, regenerating methodParameters...`);
        }
        
        // Regenerate methodParameters with new parameters
        console.log(`Regenerating methodParameters with updated settings...`);
        addStatusMessage('info', 'Updating methodParameters...', 'Using cached route (should be fast)');
        
        const routerModule = await import("@uniswap/smart-order-router/build/main");
        const SwapType = routerModule.SwapType;
        
        const options = {
          recipient,
          slippageTolerance: new Percent(Math.floor(slippageTolerance * 100), 10_000),
          deadline: Math.floor(Date.now() / 1000) + 60 * deadlineMinutes,
          type: SwapType?.SWAP_ROUTER_02 ?? 1,
        };
        
        const router = await getRouterInstance(provider);
        const sdkTokenOut = tokenToSDKToken(tokenOut);
        
        const startTime = Date.now();
        const route = await router.route(amountInCurrency, sdkTokenOut, TradeType.EXACT_INPUT, options);
        const duration = Date.now() - startTime;
        
        if (route && route.methodParameters) {
          console.log(`✅ Regenerated methodParameters in ${duration}ms`);
          addStatusMessage('success', `Ready in ${duration}ms`, 'MethodParameters updated');
          return {
            route,
            methodParameters: route.methodParameters,
            quote: route.quote,
          };
        }
      }
      
      // Fallback: Try to use cached route even without methodParameters
      // Variables already declared above, just check if amount matches
      if (cachedAmountIn && cachedAmountIn.toExact() === amountInCurrency.toExact()) {
        console.log(`Reusing cached route for execution...`);
        addStatusMessage('info', 'Found cached route', 'Regenerating methodParameters...');
        
        const routerModule = await import("@uniswap/smart-order-router/build/main");
        const SwapType = routerModule.SwapType;
        
        const options = {
          recipient,
          slippageTolerance: new Percent(Math.floor(slippageTolerance * 100), 10_000),
          deadline: Math.floor(Date.now() / 1000) + 60 * deadlineMinutes,
          type: SwapType?.SWAP_ROUTER_02 ?? 1,
        };
        
        const router = await getRouterInstance(provider);
        const sdkTokenOut = tokenToSDKToken(tokenOut);
        
        addStatusMessage('loading', 'Regenerating methodParameters...', 'Router may use internal cache');
        const startTime = Date.now();
        const route = await router.route(amountInCurrency, sdkTokenOut, TradeType.EXACT_INPUT, options);
        const duration = Date.now() - startTime;
        
        if (route && route.methodParameters) {
          console.log(`✅ Generated fresh methodParameters in ${duration}ms`);
          addStatusMessage('success', `MethodParameters generated in ${duration}ms`, 'Ready for transaction');
          return {
            route,
            methodParameters: route.methodParameters,
            quote: route.quote,
          };
        }
      }
    }

    // Fallback: Get fresh route
    console.log(`Getting fresh route for execution: ${tokenIn.symbol} -> ${tokenOut.symbol}`);
    addStatusMessage('loading', `Getting fresh route for execution...`, `${tokenIn.symbol} → ${tokenOut.symbol}`);
    
    const router = await getRouterInstance(provider);
    const routerModule = await import("@uniswap/smart-order-router/build/main");
    const SwapType = routerModule.SwapType;

    const sdkTokenIn = tokenToSDKToken(tokenIn);
    const sdkTokenOut = tokenToSDKToken(tokenOut);

    const rawTokenAmountIn = fromReadableAmount(parseFloat(amountIn), tokenIn.decimals || 18);
    const amountInCurrency = TokenAmount(sdkTokenIn, rawTokenAmountIn.toString());

    const options = {
      recipient,
      slippageTolerance: new Percent(Math.floor(slippageTolerance * 100), 10_000),
      deadline: Math.floor(Date.now() / 1000) + 60 * deadlineMinutes,
      type: SwapType?.SWAP_ROUTER_02 ?? 1,
    };

    const route = await router.route(amountInCurrency, sdkTokenOut, TradeType.EXACT_INPUT, options);

    if (!route || !route.methodParameters) {
      console.warn(`No route found for execution: ${tokenIn.symbol} -> ${tokenOut.symbol}`);
      return null;
    }

    if (route.route && Array.isArray(route.route) && route.route.length > 0) {
      const firstRoute = route.route[0] as any;
      const poolCount = firstRoute?.pools?.length || 0;
      console.log(`Route found for execution: ${poolCount} pool(s) in path`);
      addStatusMessage('success', `Route found: ${poolCount} pool(s) in path`, 'MethodParameters ready');
    }

    return {
      route,
      methodParameters: route.methodParameters,
      quote: route.quote,
    };
  } catch (error) {
    console.error("Error getting router route:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return null;
  }
}
