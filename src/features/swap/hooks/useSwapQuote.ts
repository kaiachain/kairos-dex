/**
 * Swap Quote Hook
 * Main hook for getting swap quotes using Smart Order Router
 * Optimized with debouncing, caching, and stale-while-revalidate pattern
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { JsonRpcProvider } from "@ethersproject/providers";
import { usePublicClient } from "wagmi";
import { Token } from "@/shared/types/token";
import { SwapQuote } from "@/features/swap/types/swap";
import { RPC_URL } from "@/config/env";
import { getPoolAddress } from "@/lib/sdk-utils";
import { FeeAmount } from "@uniswap/v3-sdk";
import { getFastQuoteFromQuoter } from "@/features/swap/services/quoterV2Service";
import { getQuoteFromRouter } from "@/features/swap/services/routerService";
import { getCacheKey, getCachedQuote, setCachedQuote } from "@/features/swap/utils/quoteCache";
import { transformQuoteResult } from "@/features/swap/utils/quoteTransformers";
import { addStatusMessage } from "@/app/providers/contexts/SwapStatusContext";
import { diagnoseRouteFailure, RouteDiagnostic } from "@/features/swap/services/routeDiagnostics";

// Debounce utility
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
  const [quoteTimestamp, setQuoteTimestamp] = useState<number | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [routeDiagnostic, setRouteDiagnostic] = useState<RouteDiagnostic | null>(null);
  const expirationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const publicClient = usePublicClient();

  // Create provider from publicClient (only on client side)
  const provider = useMemo(() => {
    if (typeof window === 'undefined') return null;
    if (!publicClient) return null;
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
    const cached = getCachedQuote(cacheKey);

    if (cached) {
      // Use cached quote immediately
      setQuote(cached.quote);
      setIsLoading(false);
      setError(null);
      setQuoteTimestamp(cached.timestamp);
      
      // Set expiration timer for cached quote
      if (expirationTimerRef.current) {
        clearTimeout(expirationTimerRef.current);
      }
      
      const timeSinceCache = Date.now() - cached.timestamp;
      const timeUntilExpiration = 60000 - timeSinceCache; // 60 seconds total
      
        if (timeUntilExpiration > 0) {
        expirationTimerRef.current = setTimeout(() => {
          console.log('⏰ Cached quote expired, refetching...');
          addStatusMessage('info', 'Quote expired', 'Refetching fresh quote...');
          // Trigger refetch by incrementing refetch trigger
          setRefetchTrigger(prev => prev + 1);
          setQuoteTimestamp(null);
        }, timeUntilExpiration);
      } else {
        // Quote already expired, trigger refetch immediately
        console.log('⏰ Cached quote already expired, refetching...');
        setRefetchTrigger(prev => prev + 1);
        setQuoteTimestamp(null);
      }
      
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
      setRouteDiagnostic(null); // Clear previous diagnostic
      addStatusMessage('info', `Starting quote fetch: ${tokenIn.symbol} → ${tokenOut.symbol}`, `Amount: ${debouncedAmountIn}`);

      try {
        abortController = new AbortController();

        // Standard Uniswap v3 practice: Try fast QuoterV2 first for direct swaps, then router for multi-hop
        let quoteResult: any = null;
        const fastQuoteStart = Date.now();
        
        // Quick check: Does a direct pool exist?
        let hasDirectPool = false;
        if (publicClient) {
          try {
            const commonFees = [100, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];
            for (const fee of commonFees) {
              const poolAddr = await getPoolAddress(tokenIn as any, tokenOut as any, fee);
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
            console.log('Pool check failed, will use router:', poolCheckError);
          }
        }
        
        // Try fast quote first ONLY if direct pool exists
        if (hasDirectPool && publicClient) {
          try {
            addStatusMessage('loading', 'Querying QuoterV2 for direct pool...', 'Fast quote method');
            const fastQuote = await getFastQuoteFromQuoter(tokenIn, tokenOut, debouncedAmountIn, publicClient);
            if (fastQuote) {
              const fastQuoteDuration = Date.now() - fastQuoteStart;
              console.log(`✅ Fast quote from QuoterV2 in ${fastQuoteDuration}ms (direct swap)`);
              addStatusMessage('success', `Direct pool quote: ${fastQuote.amountOut} ${tokenOut.symbol}`, `Completed in ${fastQuoteDuration}ms`);
              
              quoteResult = {
                amountOut: fastQuote.amountOut,
                fee: fastQuote.fee,
                gasEstimate: fastQuote.gasEstimate,
                poolAddress: fastQuote.poolAddress,
                route: null,
                routePath: [tokenIn.address.toLowerCase(), tokenOut.address.toLowerCase()],
              };
              
              // IMPORTANT: Also fetch route from router for execution
              // We fetch it in parallel (non-blocking) so quote shows immediately
              // but route will be cached when ready for execution
              if (provider && !cancelled) {
                console.log('Fetching route from router for execution (in background)...');
                addStatusMessage('info', 'Preparing route for execution...', 'Getting route data');
                
                // Fetch route in parallel - don't block showing the quote
                // But we'll cache it when ready so execution can use it
                getQuoteFromRouter(tokenIn, tokenOut, debouncedAmountIn, provider)
                  .then((routerQuote) => {
                    if (routerQuote && !cancelled && !abortController?.signal.aborted) {
                      console.log('✅ Route fetched for execution, updating cache...');
                      // Store the full route in quoteResult so it gets cached properly
                      const routeResultForCache = routerQuote.fullRoute 
                        ? { route: routerQuote.fullRoute }
                        : (routerQuote.route ? { route: routerQuote.route } : null);
                      
                      if (routeResultForCache) {
                        // Update cache with route - use the same cache key
                        const currentCacheKey = getCacheKey(tokenIn, tokenOut, debouncedAmountIn);
                        const currentCached = getCachedQuote(currentCacheKey);
                        if (currentCached) {
                          // Update cache with route
                          setCachedQuote(currentCacheKey, currentCached.quote, routeResultForCache);
                          console.log('✅ Cache updated with route - ready for execution');
                        } else {
                          // Cache expired or cleared, but we can still store it
                          // We'll need to get the quote again, but for now store the route
                          const tempQuote = transformQuoteResult(quoteResult, tokenIn, tokenOut, debouncedAmountIn);
                          setCachedQuote(currentCacheKey, tempQuote, routeResultForCache);
                        }
                      }
                    }
                  })
                  .catch((routeError) => {
                    if (!cancelled && !abortController?.signal.aborted) {
                      console.log('Route fetch for execution failed (will fetch on swap):', routeError);
                    }
                  });
              }
            }
          } catch (fastQuoteError) {
            console.log('Fast quote failed, will try router:', fastQuoteError);
            addStatusMessage('warning', 'QuoterV2 failed', 'Falling back to Smart Order Router');
          }
        }
        
        // For multi-hop routes or if fast quote failed: Use Smart Order Router
        if (!quoteResult && provider) {
          addStatusMessage('loading', 'Using Smart Order Router...', 'Finding optimal route (this may take 10-20 seconds)');
          console.log('No direct pool found, using Smart Order Router for quote...');
          quoteResult = await getQuoteFromRouter(tokenIn, tokenOut, debouncedAmountIn, provider);
          if (quoteResult) {
            addStatusMessage('success', `Route found! Quote: ${quoteResult.amountOut} ${tokenOut.symbol}`, `Gas estimate: ${quoteResult.gasEstimate}`);
            // Clear diagnostic if route found
            setRouteDiagnostic(null);
          } else {
            // Route not found - run diagnostics
            addStatusMessage('loading', 'Analyzing route failure...', 'Checking available pools');
            try {
              const diagnostic = await diagnoseRouteFailure(tokenIn, tokenOut);
              setRouteDiagnostic(diagnostic);
              console.log('Route diagnostic completed:', diagnostic);
            } catch (diagError) {
              console.error('Failed to run diagnostics:', diagError);
              setRouteDiagnostic(null);
            }
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

        // Transform quote result to SwapQuote format
        const newQuote = transformQuoteResult(quoteResult, tokenIn, tokenOut, debouncedAmountIn);

        console.log('✅ Created new quote object:', {
          amountOut: newQuote.amountOut,
          price: newQuote.price,
          route: newQuote.route,
          routeLength: newQuote.route?.length || 0,
        });

        // Cache the quote with full route result for execution
        const routeResultForCache = quoteResult.fullRoute 
          ? { route: quoteResult.fullRoute }
          : (quoteResult.route ? { route: quoteResult.route } : null);
        setCachedQuote(cacheKey, newQuote, routeResultForCache);

        if (cancelled || abortController?.signal.aborted) {
          console.log('⚠️ Quote fetch cancelled or aborted');
          return;
        }

        console.log('✅ Setting quote in state');
        setQuote(newQuote);
        setStaleQuote(null);
        setQuoteTimestamp(Date.now());
        
        // Clear any existing expiration timer
        if (expirationTimerRef.current) {
          clearTimeout(expirationTimerRef.current);
        }
        
        // Set expiration timer to auto-refetch after 60 seconds
        expirationTimerRef.current = setTimeout(() => {
          console.log('⏰ Quote expired, refetching...');
          addStatusMessage('info', 'Quote expired', 'Refetching fresh quote...');
          // Trigger refetch by incrementing refetch trigger
          setRefetchTrigger(prev => prev + 1);
          setQuoteTimestamp(null);
        }, 60000); // 60 seconds
      } catch (err) {
        if (cancelled || abortController?.signal.aborted) return;
        console.error("Error fetching swap quote:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch quote")
        );
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
      if (expirationTimerRef.current) {
        clearTimeout(expirationTimerRef.current);
      }
    };
  }, [tokenIn, tokenOut, debouncedAmountIn, provider, publicClient, refetchTrigger]);
  
  // Cleanup expiration timer on unmount
  useEffect(() => {
    return () => {
      if (expirationTimerRef.current) {
        clearTimeout(expirationTimerRef.current);
      }
    };
  }, []);

  // Return stale quote if loading and stale quote exists (stale-while-revalidate)
  const displayQuote = isLoading && staleQuote ? staleQuote : quote;

  return { 
    data: displayQuote, 
    isLoading, 
    error,
    quoteTimestamp, // Expose timestamp for timer
    routeDiagnostic, // Expose diagnostic info for UI
    // Expose function to get cached route for execution
    getCachedRoute: () => {
      if (!tokenIn || !tokenOut || !debouncedAmountIn) return null;
      const cacheKey = getCacheKey(tokenIn, tokenOut, debouncedAmountIn);
      const cached = getCachedQuote(cacheKey);
      return cached?.routeResult || null;
    }
  };
}

// Re-export getRouterRoute for use in swap execution
export { getRouterRoute } from "@/features/swap/services/routerService";
