/**
 * Router Instance Management
 * Handles initialization and caching of the AlphaRouter instance
 */

import { JsonRpcProvider } from "@ethersproject/providers";
import { ChainId, Token as SDKToken } from "@uniswap/sdk-core";
import { getAddress } from "@ethersproject/address";
import { CHAIN_ID, RPC_URL, SUBGRAPH_URL, CONTRACT_WRAPPED_NATIVE_TOKEN } from "@/config/env";
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
  try {
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
}

/**
 * Patch get-candidate-pools to handle missing token lists at runtime
 */
function patchGetCandidatePools() {
  try {
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
function createOnChainQuoteProvider(provider: JsonRpcProvider, multicall2Provider: any) {
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

    return new OnChainQuoteProvider(
      ChainId.MAINNET,
      provider,
      multicall2Provider,
      DEFAULT_RETRY_OPTIONS,
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

  // Prevent concurrent initialization
  if (routerInitializing) {
    let retries = 0;
    while (routerInitializing && retries < 10) {
      const start = Date.now();
      while (Date.now() - start < 100) {
        // Busy wait
      }
      retries++;
    }
    if (routerInstance) {
      return routerInstance;
    }
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
      patchGetCandidatePools();
      
      routerInitialized = true;
    }

    // Use provided provider or create new one
    const rpcProvider = provider || new JsonRpcProvider(RPC_URL);

    // Create providers
    const multicall2Provider = createMulticallProvider(
      CHAIN_ID,
      rpcProvider,
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

    const onChainQuoteProvider = createOnChainQuoteProvider(rpcProvider, multicall2Provider);

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
