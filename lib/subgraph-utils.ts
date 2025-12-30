/**
 * Utility functions to convert subgraph data to app types
 */
import { Pool } from "@/types/pool";
import { Position } from "@/types/position";
import { Token } from "@/types/token";
import {
  SubgraphPool,
  SubgraphPosition,
  SubgraphPoolDayData,
  SubgraphPoolHourData,
  SubgraphMint,
  SubgraphBurn,
  SubgraphCollect,
} from "@/types/subgraph";

/**
 * Convert subgraph token to app Token type
 */
export function subgraphTokenToToken(token: {
  id: string;
  symbol: string;
  name: string;
  decimals: string;
}): Token {
  return {
    address: token.id.toLowerCase(),
    symbol: token.symbol,
    name: token.name,
    decimals: parseInt(token.decimals, 10),
  };
}

/**
 * Calculate price from sqrtPriceX96
 */
function calculatePriceFromSqrtPriceX96(
  sqrtPriceX96: string,
  token0Decimals: number,
  token1Decimals: number
): number {
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtPrice = BigInt(sqrtPriceX96);
  const price = Number(sqrtPrice) / Number(Q96);
  const priceSquared = price ** 2;
  const decimalsAdjustment = 10 ** (token0Decimals - token1Decimals);
  return priceSquared * decimalsAdjustment;
}

/**
 * Calculate 24h volume from pool hour data
 */
function calculate24hVolume(poolHourData?: SubgraphPoolHourData[]): number {
  if (!poolHourData || poolHourData.length === 0) return 0;

  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 24 * 60 * 60;

  return poolHourData
    .filter((data) => data.periodStartUnix >= oneDayAgo)
    .reduce((sum, data) => sum + parseFloat(data.volumeUSD || "0"), 0);
}

/**
 * Calculate 7d volume from pool day data
 */
function calculate7dVolume(poolDayData?: SubgraphPoolDayData[]): number {
  if (!poolDayData || poolDayData.length === 0) return 0;

  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;

  return poolDayData
    .filter((data) => data.date >= sevenDaysAgo)
    .reduce((sum, data) => sum + parseFloat(data.volumeUSD || "0"), 0);
}

/**
 * Calculate 30d volume from pool day data
 */
function calculate30dVolume(poolDayData?: SubgraphPoolDayData[]): number {
  if (!poolDayData || poolDayData.length === 0) return 0;

  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

  return poolDayData
    .filter((data) => data.date >= thirtyDaysAgo)
    .reduce((sum, data) => sum + parseFloat(data.volumeUSD || "0"), 0);
}

/**
 * Calculate APR from fees and TVL
 */
function calculateAPR(
  feesUSD: number,
  tvlUSD: number,
  days: number = 7
): number {
  if (tvlUSD === 0) return 0;
  const annualizedFees = (feesUSD / days) * 365;
  return (annualizedFees / tvlUSD) * 100;
}

/**
 * Convert subgraph pool to app Pool type
 */
export function subgraphPoolToPool(subgraphPool: SubgraphPool): Pool {
  const token0 = subgraphTokenToToken(subgraphPool.token0);
  const token1 = subgraphTokenToToken(subgraphPool.token1);

  const feeTier = parseFloat(subgraphPool.feeTier) / 10000; // Convert from basis points
  const tvl = parseFloat(subgraphPool.totalValueLockedUSD || "0");

  // Calculate volumes
  const volume24h = calculate24hVolume(subgraphPool.poolHourData);
  const volume7d = calculate7dVolume(subgraphPool.poolDayData);
  const volume30d = calculate30dVolume(subgraphPool.poolDayData);

  // Calculate APR from 7-day fees
  const fees7d =
    subgraphPool.poolDayData
      ?.slice(0, 7)
      .reduce((sum, data) => sum + parseFloat(data.feesUSD || "0"), 0) || 0;
  const apr = calculateAPR(fees7d, tvl, 7);

  // Calculate current price
  const currentPrice = subgraphPool.token0Price
    ? parseFloat(subgraphPool.token0Price)
    : calculatePriceFromSqrtPriceX96(
        subgraphPool.sqrtPrice,
        token0.decimals,
        token1.decimals
      );

  const createdAt = subgraphPool.createdAtTimestamp
    ? parseInt(subgraphPool.createdAtTimestamp, 10)
    : Math.floor(Date.now() / 1000);

  return {
    address: subgraphPool.id.toLowerCase(),
    token0,
    token1,
    feeTier,
    tvl,
    volume24h,
    volume7d,
    volume30d,
    apr,
    currentPrice,
    createdAt,
  };
}

/**
 * Convert subgraph position to app Position type
 */
export function subgraphPositionToPosition(
  subgraphPosition: SubgraphPosition
): Position {
  const pool = subgraphPosition.pool;
  const token0 = subgraphTokenToToken(pool.token0);
  const token1 = subgraphTokenToToken(pool.token1);

  const feeTier = parseFloat(pool.feeTier) / 10000;
  const liquidity = subgraphPosition.liquidity;

  // Calculate price range
  const priceMin = parseFloat(subgraphPosition.tickLower.price0 || "0");
  const priceMax = parseFloat(subgraphPosition.tickUpper.price0 || "0");

  // Current price from pool
  const currentPrice = pool.token0Price
    ? parseFloat(pool.token0Price)
    : calculatePriceFromSqrtPriceX96(
        pool.sqrtPrice,
        token0.decimals,
        token1.decimals
      );

  // Calculate position value (simplified)
  const depositedToken0 = parseFloat(subgraphPosition.depositedToken0 || "0");
  const depositedToken1 = parseFloat(subgraphPosition.depositedToken1 || "0");
  const withdrawnToken0 = parseFloat(subgraphPosition.withdrawnToken0 || "0");
  const withdrawnToken1 = parseFloat(subgraphPosition.withdrawnToken1 || "0");

  // Net deposited amounts
  const netToken0 = depositedToken0 - withdrawnToken0;
  const netToken1 = depositedToken1 - withdrawnToken1;

  // Calculate value in USD (simplified - would need token prices)
  const value = netToken0 * currentPrice + netToken1;

  // Uncollected fees
  const collectedToken0 = parseFloat(subgraphPosition.collectedToken0 || "0");
  const collectedToken1 = parseFloat(subgraphPosition.collectedToken1 || "0");
  const uncollectedFees = collectedToken0 * currentPrice + collectedToken1;

  // Total fees earned
  const feesEarned = uncollectedFees; // Simplified

  const createdAt = subgraphPosition.createdAtTimestamp
    ? parseInt(subgraphPosition.createdAtTimestamp, 10)
    : Math.floor(Date.now() / 1000);

  return {
    tokenId: subgraphPosition.id,
    token0,
    token1,
    feeTier,
    liquidity,
    priceMin,
    priceMax,
    currentPrice,
    value,
    uncollectedFees,
    feesEarned,
    createdAt,
  };
}

/**
 * Calculate price from tick index
 * price = 1.0001^tick
 */
function calculatePriceFromTick(
  tick: number,
  token0Decimals: number,
  token1Decimals: number
): number {
  const price = Math.pow(1.0001, tick);
  const decimalsAdjustment = 10 ** (token0Decimals - token1Decimals);
  return price * decimalsAdjustment;
}

/**
 * Aggregate Mint, Burn, and Collect events into Position objects
 */
export function aggregatePositionEvents(
  mints: SubgraphMint[],
  burns: SubgraphBurn[],
  collects: SubgraphCollect[]
): Position[] {
  // Group events by position key: owner + pool + tickLower + tickUpper
  const positionMap = new Map<
    string,
    {
      owner: string;
      pool: SubgraphPool;
      tickLower: string;
      tickUpper: string;
      mints: SubgraphMint[];
      burns: SubgraphBurn[];
      collects: SubgraphCollect[];
    }
  >();

  // Process mints
  mints.forEach((mint) => {
    const key = `${mint.owner.toLowerCase()}-${mint.pool.id.toLowerCase()}-${
      mint.tickLower
    }-${mint.tickUpper}`;
    if (!positionMap.has(key)) {
      positionMap.set(key, {
        owner: mint.owner,
        pool: mint.pool,
        tickLower: mint.tickLower,
        tickUpper: mint.tickUpper,
        mints: [],
        burns: [],
        collects: [],
      });
    }
    positionMap.get(key)!.mints.push(mint);
  });

  // Process burns
  burns.forEach((burn) => {
    if (!burn.owner) return;
    const key = `${burn.owner.toLowerCase()}-${burn.pool.id.toLowerCase()}-${
      burn.tickLower
    }-${burn.tickUpper}`;
    if (!positionMap.has(key)) {
      positionMap.set(key, {
        owner: burn.owner,
        pool: burn.pool,
        tickLower: burn.tickLower,
        tickUpper: burn.tickUpper,
        mints: [],
        burns: [],
        collects: [],
      });
    }
    positionMap.get(key)!.burns.push(burn);
  });

  // Process collects
  collects.forEach((collect) => {
    if (!collect.owner) return;
    const key = `${collect.owner.toLowerCase()}-${collect.pool.id.toLowerCase()}-${
      collect.tickLower
    }-${collect.tickUpper}`;
    if (!positionMap.has(key)) {
      positionMap.set(key, {
        owner: collect.owner,
        pool: collect.pool,
        tickLower: collect.tickLower,
        tickUpper: collect.tickUpper,
        mints: [],
        burns: [],
        collects: [],
      });
    }
    positionMap.get(key)!.collects.push(collect);
  });

  // Convert aggregated events to Position objects
  const positions: Position[] = [];

  positionMap.forEach((positionData) => {
    const pool = positionData.pool;
    const token0 = subgraphTokenToToken(pool.token0);
    const token1 = subgraphTokenToToken(pool.token1);
    const feeTier = parseFloat(pool.feeTier) / 10000;

    // Calculate current price
    const currentPrice = pool.token0Price
      ? parseFloat(pool.token0Price)
      : calculatePriceFromSqrtPriceX96(
          pool.sqrtPrice,
          token0.decimals,
          token1.decimals
        );

    // Calculate price range from ticks
    const tickLower = parseInt(positionData.tickLower, 10);
    const tickUpper = parseInt(positionData.tickUpper, 10);
    const priceMin = calculatePriceFromTick(
      tickLower,
      token0.decimals,
      token1.decimals
    );
    const priceMax = calculatePriceFromTick(
      tickUpper,
      token0.decimals,
      token1.decimals
    );

    // Aggregate liquidity (mints add, burns subtract)
    let liquidity = BigInt(0);
    positionData.mints.forEach((mint) => {
      liquidity += BigInt(mint.amount);
    });
    positionData.burns.forEach((burn) => {
      liquidity -= BigInt(burn.amount);
    });
    const liquidityString = liquidity.toString();

    // Aggregate token amounts
    let depositedToken0 = 0;
    let depositedToken1 = 0;
    let withdrawnToken0 = 0;
    let withdrawnToken1 = 0;
    let collectedToken0 = 0;
    let collectedToken1 = 0;

    positionData.mints.forEach((mint) => {
      depositedToken0 += parseFloat(mint.amount0 || "0");
      depositedToken1 += parseFloat(mint.amount1 || "0");
    });

    positionData.burns.forEach((burn) => {
      withdrawnToken0 += parseFloat(burn.amount0 || "0");
      withdrawnToken1 += parseFloat(burn.amount1 || "0");
    });

    positionData.collects.forEach((collect) => {
      collectedToken0 += parseFloat(collect.amount0 || "0");
      collectedToken1 += parseFloat(collect.amount1 || "0");
    });

    // Calculate net amounts
    const netToken0 = depositedToken0 - withdrawnToken0;
    const netToken1 = depositedToken1 - withdrawnToken1;

    // Calculate position value
    const value = netToken0 * currentPrice + netToken1;

    // Uncollected fees (simplified - would need to calculate from fee growth)
    const uncollectedFees = 0; // This would require fee growth calculations

    // Total fees earned (from collects)
    const feesEarned = collectedToken0 * currentPrice + collectedToken1;

    // Find earliest timestamp
    const allTimestamps = [
      ...positionData.mints.map((m) => parseInt(m.timestamp, 10)),
      ...positionData.burns.map((b) => parseInt(b.timestamp, 10)),
      ...positionData.collects.map((c) => parseInt(c.timestamp, 10)),
    ];
    const createdAt =
      allTimestamps.length > 0
        ? Math.min(...allTimestamps)
        : Math.floor(Date.now() / 1000);

    // Generate position ID from key components
    const tokenId = `${positionData.owner.toLowerCase()}-${pool.id.toLowerCase()}-${tickLower}-${tickUpper}`;

    // Only include positions with positive liquidity
    if (liquidity > 0) {
      positions.push({
        tokenId,
        token0,
        token1,
        feeTier,
        liquidity: liquidityString,
        priceMin,
        priceMax,
        currentPrice,
        value,
        uncollectedFees,
        feesEarned,
        createdAt,
      });
    }
  });

  return positions;
}
