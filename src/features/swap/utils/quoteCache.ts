/**
 * Quote caching utilities
 */

import { Token } from "@/shared/types/token";
import { SwapQuote } from "@/features/swap/types/swap";

export interface CachedQuote {
  quote: SwapQuote;
  timestamp: number;
  routeResult: any; // Store full route result for execution
}

const QUOTE_CACHE_TTL = 60000; // 60 seconds - quotes expire after 1 minute
const quoteCache = new Map<string, CachedQuote>();

/**
 * Generate cache key from token pair and amount
 */
export function getCacheKey(tokenIn: Token, tokenOut: Token, amountIn: string): string {
  return `${tokenIn.address.toLowerCase()}-${tokenOut.address.toLowerCase()}-${amountIn}`;
}

/**
 * Get cached quote if available and not expired
 */
export function getCachedQuote(key: string): CachedQuote | undefined {
  const cached = quoteCache.get(key);
  if (!cached) return undefined;
  
  const now = Date.now();
  if ((now - cached.timestamp) >= QUOTE_CACHE_TTL) {
    quoteCache.delete(key);
    return undefined;
  }
  
  return cached;
}

/**
 * Set quote in cache
 */
export function setCachedQuote(key: string, quote: SwapQuote, routeResult?: any): void {
  quoteCache.set(key, {
    quote,
    timestamp: Date.now(),
    routeResult: routeResult || null,
  });
  
  // Clean up old cache entries (keep only last 10)
  if (quoteCache.size > 10) {
    const oldestKey = Array.from(quoteCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
    quoteCache.delete(oldestKey);
  }
}

/**
 * Clear all cached quotes
 */
export function clearQuoteCache(): void {
  quoteCache.clear();
}
