/**
 * Environment configuration
 * All environment variables must be defined in .env.local (see env.example for defaults)
 * 
 * Note: Vite uses import.meta.env instead of process.env
 * Only variables prefixed with VITE_ are exposed to the client
 */

// Helper to get env variable with VITE_ prefix
// Throws an error if the variable is not set
function getEnvVar(key: string, required: boolean = true): string {
  const viteKey = `VITE_${key}`;
  const value = import.meta.env[viteKey];
  
  if (required && (!value || value.trim() === "")) {
    throw new Error(
      `Missing required environment variable: ${viteKey}. ` +
      `Please set it in your .env.local file. See env.example for default values.`
    );
  }
  
  return value || "";
}

// Network Configuration
export const CHAIN_ID = parseInt(
  getEnvVar("CHAIN_ID"),
  10
);
export const CHAIN_NAME = getEnvVar("CHAIN_NAME");
export const CHAIN_NETWORK = getEnvVar("CHAIN_NETWORK");
export const NATIVE_CURRENCY_NAME = getEnvVar("NATIVE_CURRENCY_NAME");
export const NATIVE_CURRENCY_SYMBOL = getEnvVar("NATIVE_CURRENCY_SYMBOL");
export const NATIVE_CURRENCY_DECIMALS = parseInt(
  getEnvVar("NATIVE_CURRENCY_DECIMALS"),
  10
);

// RPC URLs
export const RPC_URL = getEnvVar("RPC_URL");

// Block Explorer
export const BLOCK_EXPLORER_NAME = getEnvVar("BLOCK_EXPLORER_NAME");
export const BLOCK_EXPLORER_URL = getEnvVar("BLOCK_EXPLORER_URL");

// Contract Addresses
export const CONTRACT_V3_CORE_FACTORY = getEnvVar("V3_CORE_FACTORY");
export const CONTRACT_SWAP_ROUTER_02 = getEnvVar("SWAP_ROUTER_02");
export const CONTRACT_NONFUNGIBLE_POSITION_MANAGER = getEnvVar("NONFUNGIBLE_POSITION_MANAGER");
export const CONTRACT_QUOTER_V2 = getEnvVar("QUOTER_V2");
export const CONTRACT_MULTICALL2 = getEnvVar("MULTICALL2");
export const CONTRACT_TICK_LENS = getEnvVar("TICK_LENS");
export const CONTRACT_V3_MIGRATOR = getEnvVar("V3_MIGRATOR");
export const CONTRACT_V3_STAKER = getEnvVar("V3_STAKER");

// Wrapped Native Token (WKAIA for Kairos)
// This is required for Uniswap V3 pools as native tokens must be wrapped
export const CONTRACT_WRAPPED_NATIVE_TOKEN = getEnvVar("WRAPPED_NATIVE_TOKEN");

// WalletConnect (optional)
export const WALLETCONNECT_PROJECT_ID = getEnvVar("WALLETCONNECT_PROJECT_ID", false);

// The Graph Subgraph
export const SUBGRAPH_URL = getEnvVar("SUBGRAPH_URL");

// Subgraph Bearer Token (for authenticated requests)
export const SUBGRAPH_BEARER_TOKEN = getEnvVar("SUBGRAPH_BEARER_TOKEN");

// App Configuration
export const APP_NAME = getEnvVar("APP_NAME");
export const IS_TESTNET = getEnvVar("IS_TESTNET") === "true";
