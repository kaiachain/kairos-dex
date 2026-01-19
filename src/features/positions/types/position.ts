import { Token } from '@/shared/types/token';

export interface Position {
  tokenId: string;
  token0: Token;
  token1: Token;
  feeTier: number;
  liquidity: string;
  priceMin: number;
  priceMax: number;
  currentPrice: number;
  value: number;
  uncollectedFees: number;
  feesEarned: number;
  createdAt: number;
  // Token amounts in the position (calculated from mints/burns)
  token0Amount?: number;
  token1Amount?: number;
  // Tick information for accurate range checking
  tickLower?: number;
  tickUpper?: number;
  currentTick?: number;
}
