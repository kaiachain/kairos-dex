/**
 * Swap Quote Hook using Smart Order Router
 * 
 * This hook strictly follows execute-swap-sdk.js pattern:
 * 1. Setup router patches for KAIA chain
 * 2. Create providers (V3SubgraphProvider, V3PoolProvider, OnChainQuoteProvider)
 * 3. Create AlphaRouter
 * 4. Use router.route() to get quote
 */

import { useState, useEffect, useMemo } from "react";
import { Token } from "@/types/token";
import { SwapQuote } from "@/types/swap";
import { CurrencyAmount, TradeType, ChainId, Token as SDKToken } from "@uniswap/sdk-core";
import { getAddress } from "@ethersproject/address";
import { JsonRpcProvider } from "@ethersproject/providers";
import { usePublicClient } from "wagmi";
import { CHAIN_ID, RPC_URL, SUBGRAPH_URL } from "@/config/env";
import { CONTRACT_WRAPPED_NATIVE_TOKEN } from "@/config/env";
import state from "../state.json";
import {
  setupRouterPatches,
  patchTokenEquals,
  patchCurrencyAmount,
  createMulticallProvider,
  fromReadableAmount,
  TokenAmount,
} from "@/lib/router-setup";

// Dynamic imports for router modules (client-side only)
let AlphaRouter: any;
let SwapType: any;
let V3SubgraphProvider: any;
let V3PoolProvider: any;
let OnChainQuoteProvider: any;

// Lazy load router modules only on client side
async function loadRouterModules() {
  if (typeof window === 'undefined') {
    throw new Error('Router modules can only be loaded on client side');
  }
  
  if (AlphaRouter) {
    return; // Already loaded
  }

  // Note: Runtime patching doesn't work for ES modules in the browser
  // We rely entirely on webpack configuration to replace the token list module

  // Load router modules with error handling
  // The token list error occurs during module evaluation
  // We need to catch evaluation errors, not just import errors
  // Wrap each import in its own try-catch to handle evaluation errors
  let routerModule: any = null;
  let v3SubgraphModule: any = null;
  let v3PoolModule: any = null;
  let onChainQuoteModule: any = null;
  
  // Try to load the main router module
  // IMPORTANT: Use CommonJS build (build/main) like execute-swap-sdk.js does
  // This avoids ES module evaluation issues and matches the working script
  try {
    // Use the CommonJS build path that works in execute-swap-sdk.js
    routerModule = await import("@uniswap/smart-order-router/build/main");
  } catch (importError: any) {
    const errorMessage = importError?.message || String(importError);
    const errorStack = importError?.stack || '';
    const isTokenListError = 
      errorMessage.includes('DAI_OPTIMISM_SEPOLIA') ||
      errorMessage.includes('Cannot read properties of undefined') ||
      errorMessage.includes('reading \'DAI_OPTIMISM_SEPOLIA\'') ||
      errorStack.includes('DAI_OPTIMISM_SEPOLIA') ||
      errorStack.includes('get-candidate-pools');
    
    if (!isTokenListError) {
      throw importError;
    }
    
    console.warn('⚠️ Token list error detected during router module import.');
    console.warn('This is expected for KAIA chain. The error occurs during module evaluation.');
    console.warn('Webpack replacement may not be working for dynamic imports.');
    console.warn('Attempting to suppress error and continue...');
    
    // The error occurs during module evaluation, which means the import fails completely
    // Since webpack replacement isn't working, we need to accept that the router won't load
    // and provide a graceful fallback
    // The router module cannot be loaded if the token list module fails during evaluation
  }
  
  try {
    v3SubgraphModule = await import("@uniswap/smart-order-router/build/main/providers/v3/subgraph-provider");
  } catch (importError: any) {
    const isTokenListError = importError && (
      importError.message?.includes('DAI_OPTIMISM_SEPOLIA') ||
      importError.message?.includes('Cannot read properties of undefined') ||
      String(importError).includes('DAI_OPTIMISM_SEPOLIA')
    );
    if (!isTokenListError) {
      throw importError;
    }
    console.warn('⚠️ Token list error in V3SubgraphProvider, continuing...');
  }
  
  try {
    v3PoolModule = await import("@uniswap/smart-order-router/build/main/providers/v3/pool-provider");
  } catch (importError: any) {
    const isTokenListError = importError && (
      importError.message?.includes('DAI_OPTIMISM_SEPOLIA') ||
      importError.message?.includes('Cannot read properties of undefined') ||
      String(importError).includes('DAI_OPTIMISM_SEPOLIA')
    );
    if (!isTokenListError) {
      throw importError;
    }
    console.warn('⚠️ Token list error in V3PoolProvider, continuing...');
  }
  
  try {
    onChainQuoteModule = await import("@uniswap/smart-order-router/build/main/providers/on-chain-quote-provider");
  } catch (importError: any) {
    const isTokenListError = importError && (
      importError.message?.includes('DAI_OPTIMISM_SEPOLIA') ||
      importError.message?.includes('Cannot read properties of undefined') ||
      String(importError).includes('DAI_OPTIMISM_SEPOLIA')
    );
    if (!isTokenListError) {
      throw importError;
    }
    console.warn('⚠️ Token list error in OnChainQuoteProvider, continuing...');
  }
  
  // Assign modules if they loaded successfully
  if (routerModule) {
    AlphaRouter = routerModule.AlphaRouter;
    SwapType = routerModule.SwapType;
  }
  if (v3SubgraphModule) {
    V3SubgraphProvider = v3SubgraphModule.V3SubgraphProvider;
  }
  if (v3PoolModule) {
    V3PoolProvider = v3PoolModule.V3PoolProvider;
  }
  if (onChainQuoteModule) {
    OnChainQuoteProvider = onChainQuoteModule.OnChainQuoteProvider;
  }
  
  // Check if we have the essential modules
  if (!AlphaRouter) {
    // Last resort: try to import the module one more time with a longer delay
    // Sometimes the module needs more time to load after the error
    console.warn('⚠️ AlphaRouter not loaded, attempting final retry...');
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      // Use CommonJS build like execute-swap-sdk.js
      const finalRetry = await import("@uniswap/smart-order-router/build/main");
      if (finalRetry && finalRetry.AlphaRouter) {
        AlphaRouter = finalRetry.AlphaRouter;
        SwapType = finalRetry.SwapType;
        console.log('✅ AlphaRouter loaded on final retry');
      }
    } catch (finalError) {
      console.error('❌ Final retry failed:', finalError);
    }
    
    if (!AlphaRouter) {
      throw new Error(
        'Failed to load AlphaRouter - required for swap functionality. ' +
        'The token list error is preventing the router module from loading. ' +
        'Please ensure the webpack replacement is working correctly.'
      );
    }
  }
}

// Default tokens for KAIA chain (from execute-swap-sdk.js)
const WKAIA_ADDRESS = CONTRACT_WRAPPED_NATIVE_TOKEN || "0x043c471bee060e00a56ccd02c0ca286808a5a436";
const USDT_ADDRESS = "0xd077a400968890eacc75cdc901f0356c943e4fdb";

// Create WKAIA and USDT tokens for router setup
function createWKAIAToken(): SDKToken {
  return new SDKToken(
    ChainId.MAINNET,
    getAddress(WKAIA_ADDRESS),
    18,
    "WKAIA",
    "Wrapped KAIA"
  );
}

function createUSDTToken(): SDKToken {
  return new SDKToken(
    ChainId.MAINNET,
    getAddress(USDT_ADDRESS),
    6,
    "USDT",
    "Tether USD"
  );
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

// Create router instance (singleton pattern)
let routerInstance: any = null;
let routerInitialized = false;
let routerInitializing = false;

async function createRouter(provider: JsonRpcProvider): Promise<any> {
  // Only initialize on client side
  if (typeof window === 'undefined') {
    throw new Error('Router can only be initialized on client side');
  }

  // Load router modules first
  await loadRouterModules();

  if (routerInstance && routerInitialized) {
    return routerInstance;
  }

  // Prevent concurrent initialization - just wait and retry
  if (routerInitializing) {
    // Simple retry after a short delay
    let retries = 0;
    while (routerInitializing && retries < 10) {
      // Wait synchronously (not ideal but simpler)
      const start = Date.now();
      while (Date.now() - start < 100) {
        // Busy wait
      }
      retries++;
    }
    if (routerInstance) {
      return routerInstance;
    }
    // If still not initialized, proceed with initialization
  }

  routerInitializing = true;

  try {
    // Setup patches (only once)
    if (!routerInitialized) {
      const WKAIA_TOKEN = createWKAIAToken();
      const USDT_TOKEN = createUSDTToken();
      
      setupRouterPatches(CHAIN_ID, WKAIA_TOKEN, USDT_TOKEN);
      patchTokenEquals();
      patchCurrencyAmount();
      
      // Patch get-candidate-pools to handle missing token lists at runtime
      // This catches errors that occur during module evaluation
      // Note: The webpack replacement should handle this, but we add runtime patches as a fallback
      try {
        // Try to patch both module and main build paths
        const candidatePaths = [
          '@uniswap/smart-order-router/build/main/routers/alpha-router/functions/get-candidate-pools',
          '@uniswap/smart-order-router/build/module/routers/alpha-router/functions/get-candidate-pools',
        ];
        
        for (const getCandidatePoolsPath of candidatePaths) {
          try {
            const getCandidatePoolsModule = require(getCandidatePoolsPath);
            if (getCandidatePoolsModule) {
              const originalGetCandidatePools = getCandidatePoolsModule.getCandidatePools || getCandidatePoolsModule.default;
              if (originalGetCandidatePools && typeof originalGetCandidatePools === 'function') {
                const wrapped = async (...args: any[]) => {
                  try {
                    return await originalGetCandidatePools(...args);
                  } catch (error: any) {
                    const errorMsg = error?.message || String(error);
                    if (errorMsg.includes('DAI_OPTIMISM_SEPOLIA') ||
                        errorMsg.includes('Cannot read properties of undefined') ||
                        errorMsg.includes('reading \'DAI_OPTIMISM_SEPOLIA\'')) {
                      console.warn('Token list access error in get-candidate-pools, returning empty array');
                      return [];
                    }
                    throw error;
                  }
                };
                if (getCandidatePoolsModule.getCandidatePools) {
                  getCandidatePoolsModule.getCandidatePools = wrapped;
                }
                if (getCandidatePoolsModule.default) {
                  getCandidatePoolsModule.default = wrapped;
                }
                console.log('✅ Patched get-candidate-pools at:', getCandidatePoolsPath);
                break; // Successfully patched, no need to try other paths
              }
            }
          } catch (requireError) {
            // Module might not be accessible at this path, try next one
            continue;
          }
        }
      } catch (patchError) {
        console.warn('Could not patch get-candidate-pools:', patchError);
      }
      
      routerInitialized = true;
    }

  // Create providers
  const multicall2Provider = createMulticallProvider(
    CHAIN_ID,
    provider,
    state.multicall2Address
  );

  const v3SubgraphProvider = new V3SubgraphProvider(
    CHAIN_ID,
    10,
    30000,
    true,
    0.01,
    Number.MAX_VALUE,
    SUBGRAPH_URL,
    process.env.NEXT_PUBLIC_SUBGRAPH_BEARER_TOKEN || "d1c0ffba8f198132674e26bb04cec97d"
  );

    const v3PoolProvider = new V3PoolProvider(
      ChainId.MAINNET,
      multicall2Provider as any,
      { retries: 2, minTimeout: 50, maxTimeout: 500 }
    );

    let onChainQuoteProvider;
    try {
      const {
        DEFAULT_BATCH_PARAMS,
        DEFAULT_RETRY_OPTIONS,
        DEFAULT_GAS_ERROR_FAILURE_OVERRIDES,
        DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES,
        DEFAULT_BLOCK_NUMBER_CONFIGS,
      } = require("@uniswap/smart-order-router/build/main/util/onchainQuoteProviderConfigs");

      const customBatchParams = () => ({
        ...DEFAULT_BATCH_PARAMS,
        gasLimitPerCall: 5000000,
      });

      const customBlockNumberConfig = () => ({
        ...DEFAULT_BLOCK_NUMBER_CONFIGS,
        baseBlockOffset: 0,
      });

      onChainQuoteProvider = new OnChainQuoteProvider(
        ChainId.MAINNET,
        provider,
        multicall2Provider as any,
        DEFAULT_RETRY_OPTIONS,
        customBatchParams,
        DEFAULT_GAS_ERROR_FAILURE_OVERRIDES,
        DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES,
        customBlockNumberConfig
      );
    } catch (configError) {
      console.warn('Failed to load quote provider configs, using defaults:', configError);
      // Create with minimal config if defaults fail
      const fallbackBatchParams = () => ({
        gasLimitPerCall: 5000000,
        multicallChunk: 100,
        quoteMinSuccessRate: 0.15,
      });
      const fallbackGasErrorOverrides = () => ({
        multicallChunk: 100,
        gasLimitOverride: 5000000,
      });
      const fallbackSuccessRateOverrides = () => ({
        multicallChunk: 100,
        gasLimitOverride: 5000000,
      });
      onChainQuoteProvider = new OnChainQuoteProvider(
        ChainId.MAINNET,
        provider,
        multicall2Provider as any,
        { retries: 2, minTimeout: 50, maxTimeout: 500 },
        fallbackBatchParams,
        fallbackGasErrorOverrides,
        fallbackSuccessRateOverrides,
        () => ({ 
          baseBlockOffset: 0,
          rollback: { enabled: false }
        })
      );
    }

    // Create router
    const router = new AlphaRouter({
      chainId: ChainId.MAINNET,
      provider: provider,
      multicall2Provider: multicall2Provider as any,
      v3SubgraphProvider: v3SubgraphProvider,
      v3PoolProvider: v3PoolProvider,
      onChainQuoteProvider: onChainQuoteProvider,
      v2Supported: [],
      v4Supported: [],
      mixedSupported: [],
    });

    routerInstance = router;
    routerInitializing = false;
    return router;
  } catch (error) {
    routerInitializing = false;
    console.error('Failed to create router:', error);
    throw error;
  }
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

    // Create router
    const router = await createRouter(provider);

    // Convert tokens to SDK tokens
    const sdkTokenIn = tokenToSDKToken(tokenIn);
    const sdkTokenOut = tokenToSDKToken(tokenOut);

    // Create input amount
    const rawTokenAmountIn = fromReadableAmount(parseFloat(amountIn), tokenIn.decimals || 18);
    const amountInCurrency = TokenAmount(sdkTokenIn, rawTokenAmountIn.toString());

    // Create swap options
    const { Percent } = require("@uniswap/sdk-core");
    // SwapType.SWAP_ROUTER_02 = 1
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

    // Create router
    const router = await createRouter(provider);

    // Convert tokens to SDK tokens
    const sdkTokenIn = tokenToSDKToken(tokenIn);
    const sdkTokenOut = tokenToSDKToken(tokenOut);

    // Create input amount
    const rawTokenAmountIn = fromReadableAmount(parseFloat(amountIn), tokenIn.decimals || 18);
    const amountInCurrency = TokenAmount(sdkTokenIn, rawTokenAmountIn.toString());

    // Create swap options
    const { Percent } = require("@uniswap/sdk-core");
    // SwapType.SWAP_ROUTER_02 = 1
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
