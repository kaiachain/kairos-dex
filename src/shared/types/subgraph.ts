/**
 * TypeScript types for Uniswap V3 subgraph responses
 */

export interface SubgraphToken {
  id: string;
  symbol: string;
  name: string;
  decimals: string;
}

export interface SubgraphTick {
  tickIdx: string;
  price0: string;
  price1: string;
}

export interface SubgraphPoolDayData {
  date: number;
  volumeUSD: string;
  feesUSD: string;
  tvlUSD: string;
  volumeToken0: string;
  volumeToken1: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface SubgraphPoolHourData {
  periodStartUnix: number;
  volumeUSD: string;
  feesUSD: string;
  tvlUSD: string;
  volumeToken0: string;
  volumeToken1: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface SubgraphPool {
  id: string;
  token0: SubgraphToken;
  token1: SubgraphToken;
  feeTier: string;
  liquidity: string;
  sqrtPrice: string;
  tick: string;
  totalValueLockedUSD: string;
  totalValueLockedToken0: string;
  totalValueLockedToken1: string;
  volumeUSD: string;
  volumeToken0: string;
  volumeToken1: string;
  txCount: string;
  createdAtTimestamp: string;
  createdAtBlockNumber: string;
  token0Price: string;
  token1Price: string;
  poolDayData?: SubgraphPoolDayData[];
  poolHourData?: SubgraphPoolHourData[];
}

export interface SubgraphTransaction {
  id: string;
  timestamp: string;
}

export interface SubgraphMint {
  id: string;
  transaction: SubgraphTransaction;
  timestamp: string;
  pool: SubgraphPool;
  owner: string;
  amount: string;
  amount0: string;
  amount1: string;
  amountUSD: string | null;
  tickLower: string;
  tickUpper: string;
}

export interface SubgraphBurn {
  id: string;
  transaction: SubgraphTransaction;
  timestamp: string;
  pool: SubgraphPool;
  owner: string | null;
  amount: string;
  amount0: string;
  amount1: string;
  amountUSD: string | null;
  tickLower: string;
  tickUpper: string;
}

export interface SubgraphCollect {
  id: string;
  transaction: SubgraphTransaction;
  timestamp: string;
  pool: SubgraphPool;
  owner: string | null;
  amount0: string;
  amount1: string;
  amountUSD: string | null;
  tickLower: string;
  tickUpper: string;
}

export interface SubgraphSwap {
  id: string;
  transaction: SubgraphTransaction;
  timestamp: string;
  pool: {
    id: string;
  };
  origin: string;
  sender: string;
  recipient: string;
  amountUSD: string;
}

export interface SubgraphPosition {
  id: string;
  owner: string;
  pool: SubgraphPool;
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
  collectedToken0: string;
  collectedToken1: string;
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
  tickLower: SubgraphTick;
  tickUpper: SubgraphTick;
  createdAtTimestamp: string;
  createdAtBlockNumber: string;
}

export interface SubgraphUniswapDayData {
  date: number;
  volumeUSD: string;
  tvlUSD: string;
  feesUSD: string;
  txCount: string;
}

export interface SubgraphFactory {
  id: string;
  poolCount: string;
  txCount: string;
  totalVolumeUSD: string;
  totalValueLockedUSD: string;
  totalFeesUSD: string;
}

export interface SubgraphPoolsResponse {
  pools: SubgraphPool[];
}

export interface SubgraphPoolResponse {
  pool: SubgraphPool | null;
}

export interface SubgraphMintsResponse {
  mints: SubgraphMint[];
}

export interface SubgraphBurnsResponse {
  burns: SubgraphBurn[];
}

export interface SubgraphCollectsResponse {
  collects: SubgraphCollect[];
}

export interface SubgraphSwapsResponse {
  swaps: SubgraphSwap[];
}

export interface SubgraphPositionEventsResponse {
  mints: SubgraphMint[];
  burns: SubgraphBurn[];
  collects: SubgraphCollect[];
}

export interface SubgraphPositionByTicksResponse {
  mints: SubgraphMint[];
  burns: SubgraphBurn[];
  collects: SubgraphCollect[];
}

export interface SubgraphPositionsResponse {
  positions: SubgraphPosition[];
}

export interface SubgraphPositionResponse {
  position: SubgraphPosition | null;
}

export interface SubgraphProtocolStatsResponse {
  uniswapDayData: SubgraphUniswapDayData[];
  factory: SubgraphFactory | null;
}

export interface SubgraphProtocolStatsFromPoolsResponse {
  pools: Array<{
    id: string;
    totalValueLockedUSD: string;
    volumeUSD: string;
    feesUSD: string;
    collectedFeesUSD?: string;
    poolDayData: SubgraphPoolDayData[];
  }>;
}
