/**
 * Router Instance Management
 * Handles initialization and caching of the AlphaRouter instance
 */

import { JsonRpcProvider } from "@ethersproject/providers";
import { ChainId, Token as SDKToken } from "@uniswap/sdk-core";
import { getAddress } from "@ethersproject/address";
import { CHAIN_ID, RPC_URL, SUBGRAPH_URL, SUBGRAPH_BEARER_TOKEN, CONTRACT_WRAPPED_NATIVE_TOKEN, CONTRACT_MULTICALL2 } from "@/config/env";
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

// Export SwapType so other modules can use it
export function getSwapType() {
  if (!SwapType) {
    console.warn('⚠️ SwapType is not loaded. Attempting to load it...');
    // Try to load it synchronously if possible, but this is async so we can't do much
  }
  return SwapType;
}

// Also make SwapType available on window for router's internal code if needed
if (typeof window !== 'undefined') {
  // This ensures SwapType is available globally if the router's internal code needs it
  Object.defineProperty(window, '__UNISWAP_SWAP_TYPE__', {
    get: () => SwapType,
    configurable: true,
    enumerable: false,
  });
}

// Router instance cache
let routerInstance: any = null;
let routerInitialized = false;
let routerInitializing = false;

// Default tokens for KAIA chain
const WKAIA_ADDRESS = CONTRACT_WRAPPED_NATIVE_TOKEN || "0x043c471bee060e00a56ccd02c0ca286808a5a436";
const USDT_ADDRESS = "0xd077a400968890eacc75cdc901f0356c943e4fdb";

/**
 * Create WKAIA token for router setup
 */
function createWKAIAToken(): SDKToken {
  return new SDKToken(
    ChainId.MAINNET,
    getAddress(WKAIA_ADDRESS),
    18,
    "WKAIA",
    "Wrapped KAIA"
  );
}

/**
 * Create USDT token for router setup
 */
function createUSDTToken(): SDKToken {
  return new SDKToken(
    ChainId.MAINNET,
    getAddress(USDT_ADDRESS),
    6,
    "USDT",
    "Tether USD"
  );
}

/**
 * Lazy load router modules only on client side
 */
async function loadRouterModules() {
  if (typeof window === 'undefined') {
    throw new Error('Router modules can only be loaded on client side');
  }
  
  if (AlphaRouter) {
    return; // Already loaded
  }

  // Load router modules with error handling
  let routerModule: any = null;
  let v3SubgraphModule: any = null;
  let v3PoolModule: any = null;
  let onChainQuoteModule: any = null;
  
  // Try to load the main router module
  // In production builds, the module might be evaluated during bundling
  // so we need to handle errors that occur during dynamic import
  try {
    routerModule = await import("@uniswap/smart-order-router/build/main");
    
    // Even if import succeeds, check if AlphaRouter is available
    // Sometimes the module loads but AlphaRouter is undefined due to token list errors
    if (routerModule && !routerModule.AlphaRouter) {
      console.warn('⚠️ Router module loaded but AlphaRouter is undefined. This may be due to token list errors.');
      console.warn('Attempting to load AlphaRouter directly from alpha-router module...');
      
      // Try to load AlphaRouter directly from the alpha-router module
      // Don't try to modify routerModule (it may be frozen), assign directly to module variables
      try {
        const alphaRouterModule = await import("@uniswap/smart-order-router/build/main/routers/alpha-router/alpha-router");
        if (alphaRouterModule && alphaRouterModule.AlphaRouter) {
          // Assign directly to module variables instead of modifying routerModule
          AlphaRouter = alphaRouterModule.AlphaRouter;
          
          // SwapType is exported from routers/router, not alpha-router
          // Try to get it from the router module or main module
          try {
            const routerModuleForSwapType = await import("@uniswap/smart-order-router/build/main/routers/router");
            if (routerModuleForSwapType && routerModuleForSwapType.SwapType) {
              SwapType = routerModuleForSwapType.SwapType;
            } else {
              // Fallback to main module
              const mainModule = await import("@uniswap/smart-order-router/build/main");
              if (mainModule && mainModule.SwapType) {
                SwapType = mainModule.SwapType;
              }
            }
          } catch (swapTypeError: any) {
            // SwapType is optional, continue without it
            console.warn('⚠️ Could not load SwapType (this is non-critical):', swapTypeError?.message || swapTypeError);
          }
          console.log('✅ Successfully loaded AlphaRouter directly from alpha-router module');
          // Mark routerModule as successfully loaded even though we got AlphaRouter from elsewhere
          routerModule = { ...routerModule, AlphaRouter, SwapType } as any;
        } else {
          routerModule = null; // Reset to trigger retry
        }
      } catch (directImportError: any) {
        console.warn('⚠️ Failed to load AlphaRouter directly:', directImportError.message);
        routerModule = null; // Reset to trigger retry
      }
    }
  } catch (importError: any) {
    const errorMessage = importError?.message || String(importError);
    const errorStack = importError?.stack || '';
    const isTokenListError = 
      errorMessage.includes('DAI_OPTIMISM_SEPOLIA') ||
      errorMessage.includes('Cannot read properties of undefined') ||
      errorMessage.includes('reading \'DAI_OPTIMISM_SEPOLIA\'') ||
      errorMessage.includes('token list') ||
      errorStack.includes('DAI_OPTIMISM_SEPOLIA') ||
      errorStack.includes('get-candidate-pools') ||
      errorStack.includes('token-provider');
    
    if (!isTokenListError) {
      throw importError;
    }
    
    console.warn('⚠️ Token list error detected during router module import.');
    console.warn('This is expected for KAIA chain. The error occurs during module evaluation.');
    console.warn('Attempting to continue with patched modules...');
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
  // Note: AlphaRouter and SwapType may have been loaded directly above, so check if they're already set
  if (routerModule) {
    // Only assign if not already set (from direct import above)
    if (!AlphaRouter && routerModule.AlphaRouter) {
      AlphaRouter = routerModule.AlphaRouter;
    }
    if (!SwapType && routerModule.SwapType) {
      SwapType = routerModule.SwapType;
    }
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
    console.warn('⚠️ AlphaRouter not loaded, attempting final retry...');
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
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
  
  // CRITICAL: Ensure SwapType is loaded - router's internal code needs it
  // The router's buildSwapMethodParameters function accesses SwapType.UNIVERSAL_ROUTER
  // So SwapType must be available in the router's module scope
  if (!SwapType) {
    console.warn('⚠️ SwapType not loaded, attempting to load it (CRITICAL for router)...');
    try {
      // Try loading from routers/router first (most reliable)
      const routerModuleForSwapType = await import("@uniswap/smart-order-router/build/main/routers/router");
      if (routerModuleForSwapType && routerModuleForSwapType.SwapType) {
        SwapType = routerModuleForSwapType.SwapType;
        console.log('✅ SwapType loaded from routers/router');
      } else {
        // Fallback to main module
        const mainModule = await import("@uniswap/smart-order-router/build/main");
        if (mainModule && mainModule.SwapType) {
          SwapType = mainModule.SwapType;
          console.log('✅ SwapType loaded from main module');
        }
      }
    } catch (swapTypeError: any) {
      console.error('❌ Failed to load SwapType:', swapTypeError);
      // This is critical - router will fail without SwapType
    }
  }
  
  // Verify SwapType is available and has the required properties
  if (!SwapType) {
    console.error('❌ SwapType is still undefined after all attempts');
    console.error('⚠️ Router will fail when trying to build method parameters');
    // Don't throw here - let the router try to load it itself
    // The Vite plugin should have patched methodParameters.js to handle this
    console.warn('⚠️ Continuing without SwapType - Vite plugin should handle this in methodParameters.js');
  } else {
    // Verify SwapType has the required properties
    if (!SwapType.UNIVERSAL_ROUTER && !SwapType.SWAP_ROUTER_02) {
      console.error('❌ SwapType loaded but missing required properties');
      console.warn('⚠️ SwapType may not work correctly');
    } else {
      console.log('✅ SwapType verified:', {
        hasUNIVERSAL_ROUTER: !!SwapType.UNIVERSAL_ROUTER,
        hasSWAP_ROUTER_02: !!SwapType.SWAP_ROUTER_02,
        UNIVERSAL_ROUTER: SwapType.UNIVERSAL_ROUTER,
        SWAP_ROUTER_02: SwapType.SWAP_ROUTER_02,
      });
    }
  }
}

/**
 * Patch get-candidate-pools to handle missing token lists at runtime
 */
async function patchGetCandidatePools() {
  try {
    const candidatePaths = [
      '@uniswap/smart-order-router/build/main/routers/alpha-router/functions/get-candidate-pools',
      '@uniswap/smart-order-router/build/module/routers/alpha-router/functions/get-candidate-pools',
    ];
    
    for (const getCandidatePoolsPath of candidatePaths) {
      try {
        const getCandidatePoolsModule = await import(/* @vite-ignore */ getCandidatePoolsPath);
        if (getCandidatePoolsModule) {
          const originalGetCandidatePools = getCandidatePoolsModule.getCandidatePools || getCandidatePoolsModule.default || (getCandidatePoolsModule.default && getCandidatePoolsModule.default.default ? getCandidatePoolsModule.default.default : null);
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
            break;
          }
        }
      } catch (requireError) {
        continue;
      }
    }
  } catch (patchError) {
    console.warn('Could not patch get-candidate-pools:', patchError);
  }
}

/**
 * Create OnChainQuoteProvider with proper configuration
 */
async function createOnChainQuoteProvider(provider: JsonRpcProvider, multicall2Provider: any) {
  try {
    const configsModule = await import("@uniswap/smart-order-router/build/main/util/onchainQuoteProviderConfigs");
    const configs = configsModule.default || configsModule;
    const {
      DEFAULT_BATCH_PARAMS,
      DEFAULT_RETRY_OPTIONS,
      DEFAULT_GAS_ERROR_FAILURE_OVERRIDES,
      DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES,
      DEFAULT_BLOCK_NUMBER_CONFIGS,
    } = configs;

    // Optimize batch params - balance between speed and multi-hop support
    const customBatchParams = () => ({
      ...DEFAULT_BATCH_PARAMS,
      gasLimitPerCall: 5000000,
      multicallChunk: 30, // Moderate chunks - allow more for multi-hop
      quoteMinSuccessRate: 0.1, // Slightly higher threshold for reliability
    });

    const customBlockNumberConfig = () => ({
      ...DEFAULT_BLOCK_NUMBER_CONFIGS,
      baseBlockOffset: 0,
    });

    // Use balanced retry options - allow retries for multi-hop reliability
    const fastRetryOptions = {
      retries: 1, // Allow 1 retry for multi-hop routes
      minTimeout: 50,
      maxTimeout: 500,
    };

    return new OnChainQuoteProvider(
      ChainId.MAINNET,
      provider,
      multicall2Provider,
      fastRetryOptions, // Use fast retry options instead of defaults
      customBatchParams,
      DEFAULT_GAS_ERROR_FAILURE_OVERRIDES,
      DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES,
      customBlockNumberConfig
    );
  } catch (configError) {
    console.warn('Failed to load quote provider configs, using defaults:', configError);
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
    return new OnChainQuoteProvider(
      ChainId.MAINNET,
      provider,
      multicall2Provider,
      { retries: 0, minTimeout: 50, maxTimeout: 200 }, // No retries for speed
      fallbackBatchParams,
      fallbackGasErrorOverrides,
      fallbackSuccessRateOverrides,
      () => ({ 
        baseBlockOffset: 0,
        rollback: { enabled: false }
      })
    );
  }
}

/**
 * Create router instance (singleton pattern)
 */
export async function getRouterInstance(provider?: JsonRpcProvider): Promise<any> {
  // Only initialize on client side
  if (typeof window === 'undefined') {
    throw new Error('Router can only be initialized on client side');
  }

  // Load router modules first
  await loadRouterModules();

  if (routerInstance && routerInitialized) {
    return routerInstance;
  }

  // Prevent concurrent initialization - use Promise-based waiting instead of busy-wait
  if (routerInitializing) {
    // Wait for initialization to complete with timeout
    return new Promise((resolve, reject) => {
      const maxWaitTime = 10000; // 10 seconds max wait
      const startTime = Date.now();
      const checkInterval = 100; // Check every 100ms

      const checkInitialization = setInterval(() => {
        if (routerInstance && routerInitialized) {
          clearInterval(checkInitialization);
          resolve(routerInstance);
          return;
        }

        if (Date.now() - startTime > maxWaitTime) {
          clearInterval(checkInitialization);
          reject(new Error('Router initialization timeout'));
          return;
        }
      }, checkInterval);
    });
  }

  routerInitializing = true;

  try {
    // Setup patches (only once)
    if (!routerInitialized) {
      const WKAIA_TOKEN = createWKAIAToken();
      const USDT_TOKEN = createUSDTToken();
      
      await setupRouterPatches(CHAIN_ID, WKAIA_TOKEN, USDT_TOKEN);
      patchTokenEquals();
      patchCurrencyAmount();
      await patchGetCandidatePools();
      
      routerInitialized = true;
    }

    // Use provided provider or create new one
    const rpcProvider = provider || new JsonRpcProvider(RPC_URL);

    // Create providers
    const multicall2Provider = await createMulticallProvider(
      CHAIN_ID,
      rpcProvider,
      CONTRACT_MULTICALL2
    );

    // Optimize subgraph provider - balance between speed and multi-hop support
    // Use more pools for multi-hop routes, but still optimized for speed
    const v3SubgraphProvider = new V3SubgraphProvider(
      CHAIN_ID,
      5, // Increased to 5 - need more pools for multi-hop route discovery
      15000, // Increased timeout to 15s - multi-hop routes need more time
      true,
      0.01,
      Number.MAX_VALUE,
      SUBGRAPH_URL,
      SUBGRAPH_BEARER_TOKEN
    );

    // Optimize pool provider - allow retries for multi-hop routes
    const v3PoolProvider = new V3PoolProvider(
      ChainId.MAINNET,
      multicall2Provider as any,
      { retries: 1, minTimeout: 50, maxTimeout: 500 } // Allow 1 retry for multi-hop reliability
    );

    const onChainQuoteProvider = await createOnChainQuoteProvider(rpcProvider, multicall2Provider);

    // Create router
    const router = new AlphaRouter({
      chainId: ChainId.MAINNET,
      provider: rpcProvider,
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
 * Reset router instance (useful for testing or re-initialization)
 */
export function resetRouterInstance() {
  routerInstance = null;
  routerInitialized = false;
  routerInitializing = false;
}
