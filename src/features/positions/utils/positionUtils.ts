import { Position } from '../types/position';

const FULL_RANGE_THRESHOLD = 1e40;

/**
 * Determines if a position is in range based on current price/tick
 * For full range positions, always returns true
 * For regular positions, uses tick-based comparison if available (more accurate),
 * otherwise falls back to price-based comparison
 */
export function isPositionInRange(position: Position): boolean {
  // Check if position is full range (covers all prices)
  const isFullRange =
    position.priceMin === 0 && position.priceMax >= FULL_RANGE_THRESHOLD;

  // For full range positions, always consider them in range
  if (isFullRange) {
    return true;
  }

  // For regular positions, use tick-based comparison if available (more accurate),
  // otherwise fall back to price-based comparison
  if (
    position.tickLower !== undefined &&
    position.tickUpper !== undefined &&
    position.currentTick !== undefined
  ) {
    // Use tick-based comparison (more accurate, especially for extreme prices)
    // In Uniswap V3, a position is in range if: tickLower <= currentTick <= tickUpper
    return (
      position.currentTick >= position.tickLower &&
      position.currentTick <= position.tickUpper
    );
  }

  // Fall back to price-based comparison
  return (
    position.currentPrice >= position.priceMin &&
    position.currentPrice <= position.priceMax
  );
}
