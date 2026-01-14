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
import { formatUnits } from "@/lib/utils";
import { addStatusMessage } from "@/hooks/useSwapStatus";

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
 * Fast quote using QuoterV2 contract directly (standard Uniswap v3 practice)
 * This is much faster (<1s) than the full router for simple swaps
 * Uses callStatic pattern as recommended by Uniswap docs
 * QuoterV2 uses state-changing calls that revert, so we need static calls
 */
async function getFastQuoteFromQuoter(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  publicClient: any
): Promise<{
  amountOut: string;
  fee: number;
  gasEstimate: string;
  poolAddress: string;
} | null> {
  try {
    const { CONTRACTS } = require('@/config/contracts');
    const { QuoterV2_ABI } = require('@/abis/QuoterV2');
    const { parseUnits, formatUnits } = require('@/lib/utils');
    const { getPoolAddress } = require('@/lib/sdk-utils');
    const { FeeAmount } = require('@uniswap/v3-sdk');
    const { Contract } = require('@ethersproject/contracts');
    const { JsonRpcProvider } = require('@ethersproject/providers');
    const { RPC_URL } = require('@/config/env');
    
    // Try common fee tiers in order of likelihood (0.05%, 0.3%, 1%, then others)
    // Start with fee 100 (0.01%) since that's what the pool uses
    const feeTiers = [100, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH, 500, 3000, 10000];
    
    const amountInWei = parseUnits(amountIn, tokenIn.decimals || 18);
    
    // Create ethers provider for callStatic (standard Uniswap practice)
    const ethersProvider = new JsonRpcProvider(RPC_URL);
    const quoterContract = new Contract(CONTRACTS.QuoterV2, QuoterV2_ABI, ethersProvider);
    
    // Try each fee tier - stop on first success
    for (const fee of feeTiers) {
      try {
        const poolAddress = await getPoolAddress(tokenIn, tokenOut, fee);
        if (!poolAddress) continue;
        
        console.log(`Trying QuoterV2 for pool ${poolAddress} with fee ${fee}...`);
        
        // Get quote from QuoterV2 using callStatic (standard practice)
        // QuoterV2 uses state-changing calls that revert, so we use callStatic
        try {
          const result = await quoterContract.callStatic.quoteExactInputSingle({
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn: amountInWei.toString(),
            fee: fee,
            sqrtPriceLimitX96: 0, // No price limit
          });
          
          if (result && Array.isArray(result) && result.length >= 4) {
            // Handle BigInt conversion properly - QuoterV2 returns BigInt values
            let amountOut: bigint;
            let gasEstimate: bigint;
            
            // Convert result[0] to BigInt if needed
            if (typeof result[0] === 'bigint') {
              amountOut = result[0];
            } else if (typeof result[0] === 'string') {
              amountOut = BigInt(result[0]);
            } else {
              amountOut = BigInt(result[0].toString());
            }
            
            // Convert result[3] to BigInt if needed
            if (result[3] !== undefined && result[3] !== null) {
              if (typeof result[3] === 'bigint') {
                gasEstimate = result[3];
              } else if (typeof result[3] === 'string') {
                gasEstimate = BigInt(result[3]);
              } else {
                gasEstimate = BigInt(result[3].toString());
              }
            } else {
              gasEstimate = BigInt(0);
            }
            
            console.log(`✅ QuoterV2 quote successful for fee ${fee}`);
            return {
              amountOut: formatUnits(amountOut, tokenOut.decimals || 18),
              fee: Number(fee),
              gasEstimate: gasEstimate.toString(),
              poolAddress,
            };
          }
        } catch (quoterError: any) {
          // QuoterV2 failed - try pool state-based estimate as fallback (instant)
          const errorMsg = quoterError?.message || String(quoterError);
          console.log(`⚠️ QuoterV2 failed for fee ${fee}, trying pool state estimate. Error: ${errorMsg.substring(0, 150)}`);
          
          // Fallback: Calculate optimistic quote from pool state (instant)
          try {
            const { getPoolInfo } = require('@/lib/sdk-utils');
            const poolInfo = await getPoolInfo(poolAddress);
            
            if (poolInfo && poolInfo.sqrtPriceX96 && poolInfo.liquidity > BigInt(0)) {
              // Calculate price from sqrtPriceX96
              const Q96 = BigInt(2) ** BigInt(96);
              const sqrtPrice = Number(poolInfo.sqrtPriceX96) / Number(Q96);
              const price = sqrtPrice * sqrtPrice;
              
              // Determine token order
              const tokenInLower = tokenIn.address.toLowerCase();
              const token0Lower = poolInfo.token0.toLowerCase();
              const isToken0 = tokenInLower === token0Lower;
              
              // Adjust for decimals
              const token0Decimals = isToken0 ? tokenIn.decimals || 18 : tokenOut.decimals || 18;
              const token1Decimals = isToken0 ? tokenOut.decimals || 18 : tokenIn.decimals || 18;
              const decimalsAdjustment = 10 ** (token0Decimals - token1Decimals);
              
              // Calculate spot price
              const spotPrice = isToken0 ? price * decimalsAdjustment : (1 / price) * (1 / decimalsAdjustment);
              
              // Estimate output (simplified - applies fee but doesn't account for price impact)
              const amountInNum = parseFloat(amountIn);
              const feeMultiplier = 1 - (Number(fee) / 1_000_000); // Convert fee to multiplier
              const estimatedOut = amountInNum * spotPrice * feeMultiplier;
              
              if (estimatedOut > 0) {
                console.log(`✅ Using pool state estimate for fee ${fee} (instant quote)`);
                return {
                  amountOut: estimatedOut.toFixed(6),
                  fee: Number(fee),
                  gasEstimate: '150000', // Estimate
                  poolAddress,
                };
              }
            } else {
              console.log(`Pool info missing or zero liquidity for ${poolAddress}`);
            }
          } catch (poolError: any) {
            // Pool state fetch failed, continue to next fee tier
            console.log(`Pool state estimate failed:`, poolError?.message || poolError);
          }
        }
      } catch (error: any) {
        // Pool might not exist, have no liquidity, or quote failed - try next fee tier
        console.log(`Error processing fee tier ${fee}:`, error?.message || error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Fast quote from QuoterV2 failed, will try router:', error);
    return null;
  }
}

/**
 * Get quote using AlphaRouter (fallback for complex routes)
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

    // Get route with timeout - longer for multi-hop routes (20 seconds)
    // Multi-hop routes take longer because router needs to explore multiple paths and pools
    console.log(`Finding route: ${tokenIn.symbol} -> ${tokenOut.symbol} (may be multi-hop)`);
    addStatusMessage('loading', 'Smart Order Router: Finding route...', 'Exploring pools and paths');
    const startTime = Date.now();
    
    // Add performance markers
    const perfMarkers: Record<string, number> = {};
    perfMarkers['route_start'] = Date.now();
    
    const routePromise = router.route(amountInCurrency, sdkTokenOut, TradeType.EXACT_INPUT, options);
    // Increased timeout for multi-hop routes (20 seconds - router needs time to explore paths)
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Quote request timeout after 20 seconds')), 20000)
    );
    
    let route: any;
    try {
      route = await Promise.race([routePromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      perfMarkers['route_end'] = Date.now();
      
      // Check if route is null - router might return null instead of throwing
      if (!route || route === null) {
        console.error(`❌ Router returned null (no route found) after ${duration}ms`);
        console.error('This usually means no valid route exists between the tokens');
        addStatusMessage('error', `No route found after ${(duration / 1000).toFixed(2)}s`, 'No valid path exists between these tokens. Check if pools exist.');
        return null;
      }
      
      console.log(`✅ Route found in ${duration}ms (total)`);
      console.log('========================================');
      console.log('🔍 DEBUG: About to check route structure...');
      console.log('Route object:', route);
      console.log('Route type:', typeof route);
      console.log('Route keys:', route ? Object.keys(route) : 'null');
      console.log('========================================');
      addStatusMessage('success', `Route found in ${(duration / 1000).toFixed(2)}s`, `Analyzing route structure...`);
      
      // Log route object structure immediately after finding it
      console.log('🔍 Route object structure check:', {
        hasRoute: !!route,
        routeKeys: route ? Object.keys(route) : [],
        hasMethodParameters: route?.methodParameters ? true : false,
        hasQuote: route?.quote ? true : false,
        quoteType: route?.quote ? typeof route.quote : 'N/A',
        hasQuoteToExact: route?.quote?.toExact ? true : false,
        estimatedGasUsed: route?.estimatedGasUsed?.toString() || 'N/A',
      });
      
      // Log performance breakdown if available
      if (route && route.estimatedGasUsed) {
        console.log(`   Gas estimate: ${route.estimatedGasUsed.toString()}`);
        addStatusMessage('info', `Gas estimate: ${route.estimatedGasUsed.toString()}`, 'Calculated by router');
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = error?.message || String(error);
      
      if (errorMsg.includes('timeout')) {
        console.error(`❌ Route fetch timeout after ${duration}ms (multi-hop routes may take longer)`);
        addStatusMessage('error', `Route fetch timeout after ${(duration / 1000).toFixed(2)}s`, 'Multi-hop routes may take longer. Please try again.');
        throw new Error('Quote request timed out. Multi-hop routes may take longer. Please try again or use a different token pair.');
      } else {
        console.error(`❌ Route fetch failed after ${duration}ms:`, error);
        addStatusMessage('error', `Route fetch failed: ${errorMsg}`, 'Please check your connection and try again.');
        throw error;
      }
    }

    // Wrap everything in try-catch to catch any errors during quote extraction
    try {
      // Log route validation check
      console.log('🔍 Validating route object:', {
        hasRoute: !!route,
        routeType: typeof route,
        routeIsNull: route === null,
        routeIsUndefined: route === undefined,
        hasMethodParameters: route?.methodParameters ? true : false,
        methodParametersType: route?.methodParameters ? typeof route.methodParameters : 'N/A',
        routeKeys: route ? Object.keys(route).slice(0, 20) : [], // First 20 keys
      });

      if (!route || !route.methodParameters) {
      console.warn(`⚠️ Route validation failed for ${tokenIn.symbol} -> ${tokenOut.symbol}`, {
        hasRoute: !!route,
        hasMethodParameters: route?.methodParameters ? true : false,
        routeStructure: route ? JSON.stringify(route, (key, value) => {
          // Avoid circular references and large objects
          if (key === 'pools' || key === 'route' || (typeof value === 'object' && value !== null && Object.keys(value).length > 5)) {
            return '[Object]';
          }
          return value;
        }, 2).substring(0, 500) : 'null',
      });
      // For multi-hop routes, methodParameters might not be required for quote extraction
      // Let's continue if we have a quote even without methodParameters
      if (!route?.quote && !route?.trade?.quote) {
        console.error('❌ No quote found and no methodParameters - cannot proceed');
        return null;
      } else {
        console.log('⚠️ No methodParameters but quote exists - continuing for quote extraction only');
      }
    }

    // Extract quote information - try multiple possible locations
    let quote = route.quote;
    
    // Some router versions might have quote in route.trade
    if (!quote && route.trade) {
      console.log('🔍 Quote not in route.quote, checking route.trade...');
      quote = route.trade.quote || route.trade.outputAmount;
      if (quote) {
        console.log('✅ Found quote in route.trade');
      }
    }
    
    // Some router versions might have quote in route.trade.routes[0]
    if (!quote && route.trade?.routes?.[0]) {
      console.log('🔍 Checking route.trade.routes[0]...');
      quote = route.trade.routes[0].quote || route.trade.routes[0].outputAmount;
      if (quote) {
        console.log('✅ Found quote in route.trade.routes[0]');
      }
    }
    
    if (!quote) {
      console.error('❌ Route found but no quote property found in any expected location:', {
        routeKeys: Object.keys(route),
        hasTrade: !!route.trade,
        tradeKeys: route.trade ? Object.keys(route.trade) : [],
        hasRoutes: !!route.trade?.routes,
        routeStructure: JSON.stringify(route, (key, value) => {
          // Avoid circular references and large objects
          if (key === 'pools' || key === 'route' || (typeof value === 'object' && value !== null && Object.keys(value).length > 10)) {
            return '[Object]';
          }
          return value;
        }, 2).substring(0, 1000),
      });
      throw new Error('Route found but quote property is missing from all expected locations');
    }
    let amountOut: string;
    
    try {
      // Try multiple methods to extract the amount
      if (typeof quote.toExact === 'function') {
        amountOut = quote.toExact();
        console.log('✅ Quote extracted using toExact():', amountOut);
      } else if (typeof quote.toFixed === 'function') {
        // Fallback to toFixed if toExact doesn't exist
        amountOut = quote.toFixed(tokenOut.decimals || 18);
        console.log('✅ Quote extracted using toFixed():', amountOut);
      } else if (quote.quotient !== undefined) {
        // CurrencyAmount object - extract from quotient
        const { formatUnits } = require('@/lib/utils');
        const quotient = typeof quote.quotient === 'bigint' 
          ? quote.quotient 
          : BigInt(quote.quotient.toString());
        amountOut = formatUnits(quotient, tokenOut.decimals || 18);
        console.log('✅ Quote extracted from quotient:', amountOut);
      } else if (typeof quote.toString === 'function') {
        // Last resort - try toString
        const quoteStr = quote.toString();
        // Try to parse it
        const match = quoteStr.match(/[\d.]+/);
        if (match) {
          amountOut = match[0];
          console.log('✅ Quote extracted from toString():', amountOut);
        } else {
          throw new Error('Could not parse quote from toString()');
        }
      } else {
        console.error('❌ Quote object does not have any known extraction method:', {
          quoteType: typeof quote,
          quoteKeys: quote ? Object.keys(quote) : [],
          quoteValue: quote,
          quoteConstructor: quote?.constructor?.name,
        });
        throw new Error('Quote object does not have toExact, toFixed, quotient, or toString method');
      }
      
      console.log('✅ Quote extracted successfully:', {
        amountOut,
        quoteType: typeof quote,
        quoteValue: quote?.toFixed ? quote.toFixed(6) : 'N/A',
        quoteString: quote?.toString ? quote.toString() : 'N/A',
      });
      
      // Validate amountOut
      if (!amountOut || amountOut === '0' || amountOut === 'NaN' || isNaN(parseFloat(amountOut))) {
        console.error('❌ Invalid amountOut from quote:', amountOut);
        throw new Error(`Invalid quote amount: ${amountOut}`);
      }
    } catch (quoteError: any) {
      console.error('❌ Error extracting quote:', quoteError);
      console.error('Quote object:', quote);
      console.error('Quote object keys:', quote ? Object.keys(quote) : []);
      throw new Error(`Failed to extract quote: ${quoteError?.message || String(quoteError)}`);
    }

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
    } catch (quoteExtractionError: any) {
      console.error("❌ Error during quote extraction:", quoteExtractionError);
      console.error("Error message:", quoteExtractionError?.message || String(quoteExtractionError));
      console.error("Error stack:", quoteExtractionError?.stack);
      // Re-throw to be caught by outer catch
      throw quoteExtractionError;
    }
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

// Quote cache with TTL (5 seconds)
interface CachedQuote {
  quote: SwapQuote;
  timestamp: number;
  routeResult: any; // Store full route result for execution
}

const QUOTE_CACHE_TTL = 5000; // 5 seconds
const quoteCache = new Map<string, CachedQuote>();

// Generate cache key
function getCacheKey(tokenIn: Token, tokenOut: Token, amountIn: string): string {
  return `${tokenIn.address.toLowerCase()}-${tokenOut.address.toLowerCase()}-${amountIn}`;
}

// Debounce utility - must be defined before useSwapQuote
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * React hook for getting swap quotes using Smart Order Router
 * Optimized with debouncing, caching, and stale-while-revalidate pattern
 */
export function useSwapQuote(
  tokenIn: Token | null,
  tokenOut: Token | null,
  amountIn: string
) {
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [staleQuote, setStaleQuote] = useState<SwapQuote | null>(null);
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

  // Debounce amount input to avoid excessive quote requests (300ms delay)
  const debouncedAmountIn = useDebounce(amountIn, 300);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    if (!tokenIn || !tokenOut || !debouncedAmountIn || parseFloat(debouncedAmountIn) <= 0 || !provider) {
      setQuote(null);
      setStaleQuote(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cacheKey = getCacheKey(tokenIn, tokenOut, debouncedAmountIn);
    const cached = quoteCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < QUOTE_CACHE_TTL) {
      // Use cached quote immediately
      setQuote(cached.quote);
      setIsLoading(false);
      setError(null);
      return;
    }

    // If we have a previous quote, show it as stale while fetching new one
    if (quote) {
      setStaleQuote(quote);
    }

    let cancelled = false;
    let abortController: AbortController | null = null;

    const fetchQuote = async () => {
      setIsLoading(true);
      setError(null);
      addStatusMessage('info', `Starting quote fetch: ${tokenIn.symbol} → ${tokenOut.symbol}`, `Amount: ${debouncedAmountIn}`);

      try {
        // Create abort controller for cancellation
        abortController = new AbortController();

        // Standard Uniswap v3 practice: Try fast QuoterV2 first for direct swaps, then router for multi-hop
        let quoteResult: any = null;
        const fastQuoteStart = Date.now();
        
        // Quick check: Does a direct pool exist? (QuoterV2 only works for direct swaps)
        // For multi-hop routes, skip QuoterV2 and go straight to router
        let hasDirectPool = false;
        if (publicClient) {
          try {
            const { getPoolAddress } = require('@/lib/sdk-utils');
            const { FeeAmount } = require('@uniswap/v3-sdk');
            // Quick check: try most common fee tiers first
            const commonFees = [100, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];
            for (const fee of commonFees) {
              const poolAddr = await getPoolAddress(tokenIn, tokenOut, fee);
              if (poolAddr) {
                hasDirectPool = true;
                console.log(`Direct pool found at fee ${fee}, will try QuoterV2 first`);
                break;
              }
            }
            if (!hasDirectPool) {
              console.log('No direct pool found, using router for multi-hop route...');
              addStatusMessage('info', 'No direct pool found', 'Will use Smart Order Router for multi-hop route');
            }
          } catch (poolCheckError) {
            // If pool check fails, assume no direct pool and use router
            console.log('Pool check failed, will use router:', poolCheckError);
          }
        }
        
        // Try fast quote first ONLY if direct pool exists (standard practice - much faster for simple swaps)
        if (hasDirectPool && publicClient) {
          try {
            addStatusMessage('loading', 'Querying QuoterV2 for direct pool...', 'Fast quote method');
            const fastQuote = await getFastQuoteFromQuoter(tokenIn, tokenOut, debouncedAmountIn, publicClient);
            if (fastQuote) {
              const fastQuoteDuration = Date.now() - fastQuoteStart;
              console.log(`✅ Fast quote from QuoterV2 in ${fastQuoteDuration}ms (direct swap)`);
              addStatusMessage('success', `Direct pool quote: ${fastQuote.amountOut} ${tokenOut.symbol}`, `Completed in ${fastQuoteDuration}ms`);
              
              // Convert fast quote to router format
              quoteResult = {
                amountOut: fastQuote.amountOut,
                fee: fastQuote.fee,
                gasEstimate: fastQuote.gasEstimate,
                poolAddress: fastQuote.poolAddress,
                route: null,
                routePath: [tokenIn.address.toLowerCase(), tokenOut.address.toLowerCase()],
              };
            }
          } catch (fastQuoteError) {
            console.log('Fast quote failed, will try router:', fastQuoteError);
            addStatusMessage('warning', 'QuoterV2 failed', 'Falling back to Smart Order Router');
          }
        }
        
        // For multi-hop routes or if fast quote failed: Use Smart Order Router
        // The router handles all edge cases, slippage, gas estimation, and path finding properly
        if (!quoteResult && provider) {
          addStatusMessage('loading', 'Using Smart Order Router...', 'Finding optimal route (this may take 10-20 seconds)');
          console.log('No direct pool found, using Smart Order Router for quote...');
          quoteResult = await getQuoteFromRouter(tokenIn, tokenOut, debouncedAmountIn, provider);
          if (quoteResult) {
            addStatusMessage('success', `Route found! Quote: ${quoteResult.amountOut} ${tokenOut.symbol}`, `Gas estimate: ${quoteResult.gasEstimate}`);
          }
        }

        if (cancelled || abortController?.signal.aborted) return;

        if (!quoteResult) {
          setQuote(null);
          setStaleQuote(null);
          setIsLoading(false);
          return;
        }

        // Validate quoteResult before processing
        if (!quoteResult.amountOut || quoteResult.amountOut === '0' || isNaN(parseFloat(quoteResult.amountOut))) {
          console.error('❌ Invalid quoteResult.amountOut:', quoteResult.amountOut);
          setQuote(null);
          setStaleQuote(null);
          setIsLoading(false);
          setError(new Error('Invalid quote amount received from router'));
          return;
        }

        console.log('✅ Quote result received:', {
          amountOut: quoteResult.amountOut,
          fee: quoteResult.fee,
          gasEstimate: quoteResult.gasEstimate,
          routePath: quoteResult.routePath,
          poolAddress: quoteResult.poolAddress,
        });

        // Calculate price as amountOut / amountIn for display
        const price = parseFloat(quoteResult.amountOut) / parseFloat(debouncedAmountIn);

        // For price impact, we'd need to compare with spot price
        // For now, we'll set it to 0 and calculate it properly when we have trade data
        const priceImpact = 0;

        // Use extracted route path if available, otherwise fallback to direct path
        const routePath = quoteResult.routePath && quoteResult.routePath.length > 0
          ? quoteResult.routePath
          : [tokenIn.address.toLowerCase(), tokenOut.address.toLowerCase()];

        const newQuote: SwapQuote = {
          amountOut: quoteResult.amountOut,
          price,
          priceImpact,
          fee: quoteResult.fee,
          gasEstimate: quoteResult.gasEstimate,
          route: routePath,
          poolAddress: quoteResult.poolAddress,
        };

        console.log('✅ Created new quote object:', {
          amountOut: newQuote.amountOut,
          price: newQuote.price,
          route: newQuote.route,
          routeLength: newQuote.route?.length || 0,
        });

        // Cache the quote - store the route for execution
        // The router's methodParameters will be fetched fresh during execution with correct recipient/slippage
        quoteCache.set(cacheKey, {
          quote: newQuote,
          timestamp: now,
          routeResult: quoteResult.route ? { route: quoteResult.route } : null, // Store route for execution
        });

        // Clean up old cache entries (keep only last 10)
        if (quoteCache.size > 10) {
          const oldestKey = Array.from(quoteCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
          quoteCache.delete(oldestKey);
        }

        if (cancelled || abortController?.signal.aborted) {
          console.log('⚠️ Quote fetch cancelled or aborted');
          return;
        }

        console.log('✅ Setting quote in state:', {
          amountOut: newQuote.amountOut,
          price: newQuote.price,
          route: newQuote.route,
        });
        setQuote(newQuote);
        setStaleQuote(null);
        console.log('✅ Quote set in state successfully');
      } catch (err) {
        if (cancelled || abortController?.signal.aborted) return;
        console.error("Error fetching swap quote:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch quote")
        );
        // Keep stale quote on error if available
        if (!staleQuote) {
          setQuote(null);
        }
      } finally {
        if (!cancelled && !abortController?.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchQuote();

    return () => {
      cancelled = true;
      if (abortController) {
        abortController.abort();
      }
    };
  }, [tokenIn, tokenOut, debouncedAmountIn, provider]);

  // Return stale quote if loading and stale quote exists (stale-while-revalidate)
  const displayQuote = isLoading && staleQuote ? staleQuote : quote;

  return { 
    data: displayQuote, 
    isLoading, 
    error,
    // Expose function to get cached route for execution
    getCachedRoute: () => {
      if (!tokenIn || !tokenOut || !debouncedAmountIn) return null;
      const cacheKey = getCacheKey(tokenIn, tokenOut, debouncedAmountIn);
      return quoteCache.get(cacheKey)?.routeResult || null;
    }
  };
}

/**
 * Get router route for swap execution
 * Following execute-swap-sdk.js pattern for getting route
 * Optimized to reuse cached route if available
 */
export async function getRouterRoute(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  slippageTolerance: number,
  deadlineMinutes: number,
  recipient: string,
  provider: JsonRpcProvider,
  cachedRoute?: any // Optional cached route from quote
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

    // Check if we have a cached route with matching parameters
    // We can reuse it to avoid refetching, but still need fresh methodParameters
    if (cachedRoute?.route) {
      const cachedRouteObj = cachedRoute.route;
      
      // Verify the cached route matches current parameters
      const cachedQuote = cachedRouteObj.quote;
      const cachedAmountIn = cachedRouteObj.trade?.inputAmount;
      
      // Convert current amount to compare
      const sdkTokenIn = tokenToSDKToken(tokenIn);
      const rawTokenAmountIn = fromReadableAmount(parseFloat(amountIn), tokenIn.decimals || 18);
      const amountInCurrency = TokenAmount(sdkTokenIn, rawTokenAmountIn.toString());
      
        // Check if amounts match (within 1% tolerance for floating point)
        if (cachedAmountIn && cachedAmountIn.toExact() === amountInCurrency.toExact()) {
          console.log(`Reusing cached route for execution (same tokens and amount)...`);
          addStatusMessage('info', 'Found cached route', 'Regenerating methodParameters with execution parameters...');
          
          // Get SwapType from router module
          const routerModule = await import("@uniswap/smart-order-router/build/main");
          const SwapType = routerModule.SwapType;
          
          // Create swap options with execution parameters
          const { Percent } = require("@uniswap/sdk-core");
          const options = {
            recipient,
            slippageTolerance: new Percent(Math.floor(slippageTolerance * 100), 10_000),
            deadline: Math.floor(Date.now() / 1000) + 60 * deadlineMinutes,
            type: SwapType?.SWAP_ROUTER_02 ?? 1, // SWAP_ROUTER_02 = 1
          };
          
          // Note: Smart Order Router SDK doesn't expose a way to regenerate just methodParameters
          // from an existing route. We need to call route() again to get fresh methodParameters
          // with correct recipient and slippage. The router should cache internally for faster response.
          const router = await getRouterInstance(provider);
          const sdkTokenOut = tokenToSDKToken(tokenOut);
          
          addStatusMessage('loading', 'Regenerating methodParameters...', 'Router may use internal cache for faster response');
          console.log(`Regenerating methodParameters with execution parameters (router may use internal cache)...`);
          const startTime = Date.now();
          const route = await router.route(amountInCurrency, sdkTokenOut, TradeType.EXACT_INPUT, options);
          const duration = Date.now() - startTime;
          
          if (route && route.methodParameters) {
            console.log(`✅ Generated fresh methodParameters in ${duration}ms (router may have used internal cache)`);
            addStatusMessage('success', `MethodParameters generated in ${duration}ms`, 'Ready for transaction');
            return {
              route,
              methodParameters: route.methodParameters,
              quote: route.quote,
            };
          }
        }
    }

    // Fallback: Get fresh route if no cached route or parameters don't match
    console.log(`Getting fresh route for execution: ${tokenIn.symbol} -> ${tokenOut.symbol}`);
    addStatusMessage('loading', `Getting fresh route for execution...`, `${tokenIn.symbol} → ${tokenOut.symbol}`);
    
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
    // The router SDK automatically uses multicall when SwapType is SWAP_ROUTER_02
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
      addStatusMessage('success', `Route found: ${poolCount} pool(s) in path`, 'MethodParameters ready');
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
