/**
 * Shared Constants
 */

// UI Constants
export const UI_CONSTANTS = {
  TOAST_AUTO_CLOSE_DEFAULT: 3000,
  TOAST_AUTO_CLOSE_SHORT: 2000,
  TOAST_AUTO_CLOSE_LONG: 5000,
  DEBOUNCE_DELAY: 300,
  MAX_STATUS_MESSAGES: 50,
} as const;

// Re-export feature-specific constants
export * from './swap';
export * from './network';
export * from './liquidity';
