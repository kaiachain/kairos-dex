/**
 * Application constants
 */

// UI Constants
export const UI_CONSTANTS = {
  TOAST_AUTO_CLOSE_DEFAULT: 3000,
  TOAST_AUTO_CLOSE_SHORT: 2000,
  TOAST_AUTO_CLOSE_LONG: 5000,
  DEBOUNCE_DELAY: 300,
  MAX_STATUS_MESSAGES: 50,
} as const;

// Swap Constants
export const SWAP_CONSTANTS = {
  DEFAULT_SLIPPAGE: 0.5,
  DEFAULT_DEADLINE: 20, // minutes
  MIN_SLIPPAGE: 0.1,
  MAX_SLIPPAGE: 50,
} as const;

// Liquidity Constants
export const LIQUIDITY_CONSTANTS = {
  DEFAULT_FEE_TIER: 3000, // 0.3%
  FEE_TIERS: [100, 500, 3000, 10000] as const,
  APPROVAL_BUFFER_PERCENT: 1,
  MIN_APPROVAL_BUFFER: BigInt(10 ** 18),
} as const;

// Network Constants
export const NETWORK_CONSTANTS = {
  BLOCK_TIME_MS: 2000, // Approximate block time
  CONFIRMATION_BLOCKS: 1,
} as const;
