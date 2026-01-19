import { Token } from '@/shared/types/token';

export interface Pool {
  address: string;
  token0: Token;
  token1: Token;
  feeTier: number;
  tvl: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  apr: number;
  currentPrice: number;
  createdAt: number;
}

