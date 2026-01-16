/**
 * Liquidity-specific constants
 */

export const LIQUIDITY_CONSTANTS = {
  DEFAULT_FEE_TIER: 3000, // 0.3%
  FEE_TIERS: [100, 500, 3000, 10000] as const,
  APPROVAL_BUFFER_PERCENT: 1,
  MIN_APPROVAL_BUFFER: BigInt(10 ** 18),
} as const;
