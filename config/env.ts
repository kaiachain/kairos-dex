/**
 * Environment configuration
 * All environment variables should be defined here with proper defaults
 */

// Network Configuration
export const CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID || "1001",
  10
);
export const CHAIN_NAME =
  process.env.NEXT_PUBLIC_CHAIN_NAME || "Kairos Testnet";
export const CHAIN_NETWORK =
  process.env.NEXT_PUBLIC_CHAIN_NETWORK || "kairos-testnet";
export const NATIVE_CURRENCY_NAME =
  process.env.NEXT_PUBLIC_NATIVE_CURRENCY_NAME || "KAIA";
export const NATIVE_CURRENCY_SYMBOL =
  process.env.NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL || "KAIA";
export const NATIVE_CURRENCY_DECIMALS = parseInt(
  process.env.NEXT_PUBLIC_NATIVE_CURRENCY_DECIMALS || "18",
  10
);

// RPC URLs
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://public-en-kairos.node.kaia.io";
export const RPC_URL_PUBLIC = process.env.NEXT_PUBLIC_RPC_URL_PUBLIC || RPC_URL;

// Block Explorer
export const BLOCK_EXPLORER_NAME =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_NAME || "Kairos Explorer";
export const BLOCK_EXPLORER_URL =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || "https://kairos.kaiascan.io";

// Contract Addresses
export const CONTRACT_V3_CORE_FACTORY =
  process.env.NEXT_PUBLIC_V3_CORE_FACTORY ||
  "0xb522cF1A5579c0EAe37Da6797aeBcE1bac2D4a29";
export const CONTRACT_SWAP_ROUTER_02 =
  process.env.NEXT_PUBLIC_SWAP_ROUTER_02 ||
  "0xd28909Ef8bd258DCeFD8B5A380ff55f92eD8ae4b";
export const CONTRACT_NONFUNGIBLE_POSITION_MANAGER =
  process.env.NEXT_PUBLIC_NONFUNGIBLE_POSITION_MANAGER ||
  "0x9546E23b2642334E7B82027B09e5c6c8E808F4E3";
export const CONTRACT_QUOTER_V2 =
  process.env.NEXT_PUBLIC_QUOTER_V2 ||
  "0x56a4BD4a66785Af030A2003254E93f111892BfB5";
export const CONTRACT_MULTICALL2 =
  process.env.NEXT_PUBLIC_MULTICALL2 ||
  "0x2A2aDD27F8C70f6161C9F29ea06D4e171E55C680";
export const CONTRACT_TICK_LENS =
  process.env.NEXT_PUBLIC_TICK_LENS ||
  "0x56C8DAB2fFf78D49a76B897828E7c58896bA8b87";
export const CONTRACT_V3_MIGRATOR =
  process.env.NEXT_PUBLIC_V3_MIGRATOR ||
  "0xDab424Aba37f24A94f568Df345634d4B66830ebB";
export const CONTRACT_V3_STAKER =
  process.env.NEXT_PUBLIC_V3_STAKER ||
  "0xc3cF7B37E5020f718aceE1f4e1b12bC7b1C6CE4B";

// Wrapped Native Token (WKAIA for Kairos)
// This is required for Uniswap V3 pools as native tokens must be wrapped
export const CONTRACT_WRAPPED_NATIVE_TOKEN =
  process.env.NEXT_PUBLIC_WRAPPED_NATIVE_TOKEN ||
  "0x043c471bee060e00a56ccd02c0ca286808a5a436";

// WalletConnect
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

// App Configuration
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Uniswap V3 DEX";
export const IS_TESTNET =
  process.env.NEXT_PUBLIC_IS_TESTNET === "true" ||
  process.env.NEXT_PUBLIC_IS_TESTNET === undefined;
