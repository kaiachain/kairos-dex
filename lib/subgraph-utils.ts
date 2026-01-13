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

  // Calculate price range from ticks
  // In Uniswap V3: tick price = 1.0001^tick = token1/token0 (adjusted for decimals)
  // Note: subgraphPosition.tickLower and tickUpper are Tick objects with price0 and price1
  // price0 = token0/token1, price1 = token1/token0
  // We use price1 (token1/token0) for consistency with calculatePriceFromTick
  let priceMin: number;
  let priceMax: number;
  
  if (subgraphPosition.tickLower && subgraphPosition.tickUpper) {
    // Use price1 from tick objects if available (token1/token0)
    priceMin = subgraphPosition.tickLower.price1
      ? parseFloat(subgraphPosition.tickLower.price1)
      : calculatePriceFromTick(
          parseInt(subgraphPosition.tickLower.tickIdx || "0", 10),
          token0.decimals,
          token1.decimals
        );
    priceMax = subgraphPosition.tickUpper.price1
      ? parseFloat(subgraphPosition.tickUpper.price1)
      : calculatePriceFromTick(
          parseInt(subgraphPosition.tickUpper.tickIdx || "887272", 10),
          token0.decimals,
          token1.decimals
        );
  } else {
    // Fallback: calculate from tick indices if tick objects not available
    const tickLower = -887272; // Default min tick
    const tickUpper = 887272; // Default max tick
    priceMin = calculatePriceFromTick(tickLower, token0.decimals, token1.decimals);
    priceMax = calculatePriceFromTick(tickUpper, token0.decimals, token1.decimals);
  }

  // Current price from pool
  // In Uniswap V3: sqrtPriceX96 = sqrt(token1/token0) * 2^96
  // token0Price = token0/token1, token1Price = token1/token0
  // We use token1Price (token1/token0) for consistency with tick calculations
  const currentPrice = pool.token1Price
    ? parseFloat(pool.token1Price)
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

  // NOTE: Uncollected fees cannot be accurately calculated from subgraph data alone.
  // The subgraph only tracks collected fees (from Collect events), not uncollected fees.
  // Uncollected fees must be read directly from the PositionManager contract using
  // the positions() function which returns tokensOwed0 and tokensOwed1.
  // 
  // collectedToken0/collectedToken1 represent fees that have already been collected,
  // NOT uncollected fees. Setting to 0 here - actual uncollected fees should be
  // fetched from the contract in the component.
  const uncollectedFees = 0;

  // Total fees earned (from collected fees)
  const collectedToken0 = parseFloat(subgraphPosition.collectedToken0 || "0");
  const collectedToken1 = parseFloat(subgraphPosition.collectedToken1 || "0");
  const feesEarned = collectedToken0 * currentPrice + collectedToken1;

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
 *
 * Note: Ticks at ±887272 represent the full range (min/max ticks in Uniswap V3)
 * For these extreme ticks, we return special values to avoid numerical overflow
 *
 * @param tick - The tick index
 * @param token0Decimals - Decimals of token0
 * @param token1Decimals - Decimals of token1
 * @returns Price of token1 in terms of token0 (adjusted for decimals)
 */
export function calculatePriceFromTick(
  tick: number,
  token0Decimals: number,
  token1Decimals: number
): number {
  // Handle edge cases for full range positions
  // -887272 is min tick, 887272 is max tick
  const MIN_TICK = -887272;
  const MAX_TICK = 887272;

  // Use a sentinel value that's clearly not a real price
  // This is larger than any reasonable price but still finite
  const FULL_RANGE_MAX_PRICE = 1e50;

  if (tick >= MAX_TICK) {
    // Max tick represents infinite price (token1/token0)
    // Return a sentinel value that indicates full range
    return FULL_RANGE_MAX_PRICE;
  }

  if (tick <= MIN_TICK) {
    // Min tick represents zero price (token1/token0)
    return 0;
  }

  // For normal ticks, use logarithms for numerical stability with large exponents
  // price = 1.0001^tick = exp(tick * ln(1.0001))
  // This is more numerically stable than Math.pow for large ticks
  const LN_1_0001 = Math.log(1.0001);
  let price: number;

  // Calculate base price from tick
  if (Math.abs(tick) > 100000) {
    // For very large ticks, use logarithms to avoid overflow
    const logPrice = tick * LN_1_0001;
    // Check if result would overflow before calculating exp
    if (logPrice > 700) {
      // exp(700) is approximately 1e304, close to JS max
      return FULL_RANGE_MAX_PRICE;
    }
    price = Math.exp(logPrice);
    // Clamp to reasonable bounds
    if (!isFinite(price) || price > FULL_RANGE_MAX_PRICE) {
      return FULL_RANGE_MAX_PRICE;
    }
  } else {
    // For smaller ticks, Math.pow is fine
    price = Math.pow(1.0001, tick);
    if (!isFinite(price)) {
      return tick > 0 ? FULL_RANGE_MAX_PRICE : 0;
    }
  }

  // Adjust for token decimals
  // Price represents token1/token0, so we need to adjust for decimals
  const decimalsAdjustment = 10 ** (token0Decimals - token1Decimals);

  // Check if adjustment would cause overflow
  if (Math.abs(decimalsAdjustment) > 1e20) {
    // Very large adjustment could cause issues, handle carefully
    if (price > 1e30 / Math.abs(decimalsAdjustment)) {
      return tick > 0 ? FULL_RANGE_MAX_PRICE : 0;
    }
  }

  const adjustedPrice = price * decimalsAdjustment;

  // Final safety check
  if (
    !isFinite(adjustedPrice) ||
    adjustedPrice < 0 ||
    adjustedPrice > FULL_RANGE_MAX_PRICE
  ) {
    return tick > 0 ? FULL_RANGE_MAX_PRICE : 0;
  }

  return adjustedPrice;
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
    // In Uniswap V3: sqrtPriceX96 = sqrt(token1/token0) * 2^96
    // token0Price = token0/token1, token1Price = token1/token0
    // We use token1/token0 (token1Price) for consistency with tick calculations
    let currentPrice: number;
    if (pool.token1Price) {
      // token1Price is already token1/token0
      currentPrice = parseFloat(pool.token1Price);
    } else {
      // Calculate from sqrtPriceX96: price = (sqrtPriceX96 / 2^96)^2
      // This gives token1/token0 (adjusted for decimals)
      currentPrice = calculatePriceFromSqrtPriceX96(
        pool.sqrtPrice,
        token0.decimals,
        token1.decimals
      );
    }

    // Calculate price range from ticks
    // Tick price = 1.0001^tick = token1/token0 (adjusted for decimals)
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
    
    // Get current tick from pool (if available)
    const currentTick = pool.tick ? parseInt(pool.tick, 10) : null;

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

    // NOTE: Uncollected fees cannot be accurately calculated from subgraph events alone.
    // The subgraph only tracks collected fees (from Collect events), not uncollected fees.
    // Uncollected fees must be read directly from the PositionManager contract using
    // the positions() function which returns tokensOwed0 and tokensOwed1.
    // Setting to 0 here - actual uncollected fees should be fetched from the contract.
    const uncollectedFees = 0;

    // Total fees earned (from collects - these are fees that have been collected)
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
        // Include token amounts for display
        token0Amount: netToken0,
        token1Amount: netToken1,
        // Include tick information for accurate range checking
        tickLower,
        tickUpper,
        currentTick: currentTick ?? undefined,
      });
    }
  });

  return positions;
}
