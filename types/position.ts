import { Token } from './token';

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
}

