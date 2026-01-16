/**
 * Environment configuration
 * All environment variables should be defined here with proper defaults
 * 
 * Note: Vite uses import.meta.env instead of process.env
 * Only variables prefixed with VITE_ are exposed to the client
 */

// Helper to get env variable with VITE_ prefix
function getEnvVar(key: string, defaultValue: string): string {
  const viteKey = `VITE_${key}`;
  return import.meta.env[viteKey] || defaultValue;
}

// Network Configuration
export const CHAIN_ID = parseInt(
  getEnvVar("CHAIN_ID", "1001"),
  10
);
export const CHAIN_NAME = getEnvVar("CHAIN_NAME", "Kairos Testnet");
export const CHAIN_NETWORK = getEnvVar("CHAIN_NETWORK", "kairos-testnet");
export const NATIVE_CURRENCY_NAME = getEnvVar("NATIVE_CURRENCY_NAME", "KAIA");
export const NATIVE_CURRENCY_SYMBOL = getEnvVar("NATIVE_CURRENCY_SYMBOL", "KAIA");
export const NATIVE_CURRENCY_DECIMALS = parseInt(
  getEnvVar("NATIVE_CURRENCY_DECIMALS", "18"),
  10
);

// RPC URLs
export const RPC_URL = getEnvVar("RPC_URL", "https://public-en-kairos.node.kaia.io");

// Block Explorer
export const BLOCK_EXPLORER_NAME = getEnvVar("BLOCK_EXPLORER_NAME", "Kairos Explorer");
export const BLOCK_EXPLORER_URL = getEnvVar("BLOCK_EXPLORER_URL", "https://kairos.kaiascan.io");

// Contract Addresses
export const CONTRACT_V3_CORE_FACTORY = getEnvVar(
  "V3_CORE_FACTORY",
  "0xb522cF1A5579c0EAe37Da6797aeBcE1bac2D4a29"
);
export const CONTRACT_SWAP_ROUTER_02 = getEnvVar(
  "SWAP_ROUTER_02",
  "0xd28909Ef8bd258DCeFD8B5A380ff55f92eD8ae4b"
);
export const CONTRACT_NONFUNGIBLE_POSITION_MANAGER = getEnvVar(
  "NONFUNGIBLE_POSITION_MANAGER",
  "0x9546E23b2642334E7B82027B09e5c6c8E808F4E3"
);
export const CONTRACT_QUOTER_V2 = getEnvVar(
  "QUOTER_V2",
  "0x56a4BD4a66785Af030A2003254E93f111892BfB5"
);
export const CONTRACT_MULTICALL2 = getEnvVar(
  "MULTICALL2",
  "0x2A2aDD27F8C70f6161C9F29ea06D4e171E55C680"
);
export const CONTRACT_TICK_LENS = getEnvVar(
  "TICK_LENS",
  "0x56C8DAB2fFf78D49a76B897828E7c58896bA8b87"
);
export const CONTRACT_V3_MIGRATOR = getEnvVar(
  "V3_MIGRATOR",
  "0xDab424Aba37f24A94f568Df345634d4B66830ebB"
);
export const CONTRACT_V3_STAKER = getEnvVar(
  "V3_STAKER",
  "0xc3cF7B37E5020f718aceE1f4e1b12bC7b1C6CE4B"
);

// Wrapped Native Token (WKAIA for Kairos)
// This is required for Uniswap V3 pools as native tokens must be wrapped
export const CONTRACT_WRAPPED_NATIVE_TOKEN = getEnvVar(
  "WRAPPED_NATIVE_TOKEN",
  "0x043c471bee060e00a56ccd02c0ca286808a5a436"
);

// WalletConnect
export const WALLETCONNECT_PROJECT_ID = getEnvVar("WALLETCONNECT_PROJECT_ID", "");

// The Graph Subgraph
export const SUBGRAPH_URL = getEnvVar(
  "SUBGRAPH_URL",
  "https://api.studio.thegraph.com/query/102730/kairos-dex/version/latest"
);

// Subgraph Bearer Token (for authenticated requests)
export const SUBGRAPH_BEARER_TOKEN = getEnvVar(
  "SUBGRAPH_BEARER_TOKEN",
  "d1c0ffba8f198132674e26bb04cec97d"
);

// App Configuration
export const APP_NAME = getEnvVar("APP_NAME", "Kairos DEX");
export const IS_TESTNET =
  getEnvVar("IS_TESTNET", "true") === "true" ||
  getEnvVar("IS_TESTNET", "true") === undefined;
