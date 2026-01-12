import { useState, useEffect } from 'react';
import { query } from '@/lib/graphql';
import { GET_PROTOCOL_STATS_FROM_POOLS_QUERY, GET_ALL_MINTS_QUERY, GET_ALL_BURNS_QUERY, GET_ALL_SWAPS_QUERY } from '@/lib/graphql-queries';
import { SubgraphProtocolStatsFromPoolsResponse, SubgraphMintsResponse, SubgraphBurnsResponse, SubgraphSwapsResponse } from '@/types/subgraph';

interface ProtocolStats {
  totalTVL: number;
  tvlChange24h: number;
  volume24h: number;
  volumeChange24h: number;
  volume7d: number;
  volume30d: number;
  totalPools: number;
  totalPositions: number;
  activeUsers: number;
  totalFees: number;
}

export function useProtocolStats() {
  const [stats, setStats] = useState<ProtocolStats>({
    totalTVL: 0,
    tvlChange24h: 0,
    volume24h: 0,
    volumeChange24h: 0,
    volume7d: 0,
    volume30d: 0,
    totalPools: 0,
    totalPositions: 0,
    activeUsers: 0,
    totalFees: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        
        try {
          // Since factory and uniswapDayData are not exposed as root queries in this subgraph,
          // we'll use pools aggregation as the primary method
          const response = await query<SubgraphProtocolStatsFromPoolsResponse>(GET_PROTOCOL_STATS_FROM_POOLS_QUERY, {
            first: 1000, // Get up to 1000 pools for aggregation
          });
          
          // Aggregate data from pools
          const pools = response.pools;
          
          // Calculate total TVL from all pools
          const totalTVL = pools.reduce((sum, pool) => 
            sum + parseFloat(pool.totalValueLockedUSD || '0'), 0
          );
          
          // Aggregate pool day data by date
          const dayDataMap = new Map<number, { volumeUSD: number; feesUSD: number; tvlUSD: number }>();
          
          pools.forEach(pool => {
            pool.poolDayData.forEach(day => {
              const date = day.date;
              const existing = dayDataMap.get(date) || { volumeUSD: 0, feesUSD: 0, tvlUSD: 0 };
              dayDataMap.set(date, {
                volumeUSD: existing.volumeUSD + parseFloat(day.volumeUSD || '0'),
                feesUSD: existing.feesUSD + parseFloat(day.feesUSD || '0'),
                tvlUSD: existing.tvlUSD + parseFloat(day.tvlUSD || '0'),
              });
            });
          });
          
          // Convert map to sorted array (most recent first)
          const dayData = Array.from(dayDataMap.entries())
            .map(([date, data]) => ({
              date,
              volumeUSD: data.volumeUSD.toString(),
              feesUSD: data.feesUSD.toString(),
              tvlUSD: data.tvlUSD.toString(),
              txCount: '0', // Not available from pool aggregation
            }))
            .sort((a, b) => b.date - a.date)
            .slice(0, 30);
          
          const today = dayData[0];
          const yesterday = dayData[1];
          
          const yesterdayTVL = yesterday ? parseFloat(yesterday.tvlUSD || '0') : 0;
          const tvlChange24h = yesterdayTVL > 0 ? ((totalTVL - yesterdayTVL) / yesterdayTVL) * 100 : 0;
          
          const volume24h = today ? parseFloat(today.volumeUSD || '0') : 0;
          const yesterdayVolume = yesterday ? parseFloat(yesterday.volumeUSD || '0') : 0;
          const volumeChange24h = yesterdayVolume > 0 ? ((volume24h - yesterdayVolume) / yesterdayVolume) * 100 : 0;
          
          const volume7d = dayData
            .slice(0, 7)
            .reduce((sum, day) => sum + parseFloat(day.volumeUSD || '0'), 0);
          
          const volume30d = dayData
            .slice(0, 30)
            .reduce((sum, day) => sum + parseFloat(day.volumeUSD || '0'), 0);
          
          // Calculate total fees from collectedFeesUSD (fees actually collected) or feesUSD (fees generated)
          // Prefer collectedFeesUSD as it represents actual fees collected
          const totalFees = pools.reduce((sum, pool) => {
            const fees = pool.collectedFeesUSD 
              ? parseFloat(pool.collectedFeesUSD || '0')
              : parseFloat(pool.feesUSD || '0');
            return sum + fees;
          }, 0);
          
          // Fetch all mints and burns to count total positions and active users
          // Note: Subgraph has a limit of 1000 per query, so we need pagination
          let totalPositions = 0;
          let activeUsers = 0;
          try {
            // Fetch all mints with pagination (max 1000 per request)
            const allMints: SubgraphMintsResponse['mints'] = [];
            let mintsSkip = 0;
            const mintsBatchSize = 1000;
            let hasMoreMints = true;
            
            while (hasMoreMints) {
              const mintsResponse = await query<SubgraphMintsResponse>(GET_ALL_MINTS_QUERY, {
                first: mintsBatchSize,
                skip: mintsSkip,
              });
              
              const batch = mintsResponse.mints || [];
              allMints.push(...batch);
              
              // If we got fewer than the batch size, we've reached the end
              hasMoreMints = batch.length === mintsBatchSize;
              mintsSkip += mintsBatchSize;
              
              // Safety limit: don't fetch more than 10 batches (10,000 records)
              if (mintsSkip >= 10000) {
                hasMoreMints = false;
              }
            }
            
            console.log(`Found ${allMints.length} total mints`);
            
            // Fetch all burns with pagination (max 1000 per request)
            const allBurns: SubgraphBurnsResponse['burns'] = [];
            let burnsSkip = 0;
            const burnsBatchSize = 1000;
            let hasMoreBurns = true;
            
            while (hasMoreBurns) {
              const burnsResponse = await query<SubgraphBurnsResponse>(GET_ALL_BURNS_QUERY, {
                first: burnsBatchSize,
                skip: burnsSkip,
              });
              
              const batch = burnsResponse.burns || [];
              allBurns.push(...batch);
              
              // If we got fewer than the batch size, we've reached the end
              hasMoreBurns = batch.length === burnsBatchSize;
              burnsSkip += burnsBatchSize;
              
              // Safety limit: don't fetch more than 10 batches (10,000 records)
              if (burnsSkip >= 10000) {
                hasMoreBurns = false;
              }
            }
            
            console.log(`Found ${allBurns.length} total burns`);
            
            // Count unique active positions by aggregating liquidity
            // A position is active if it has positive liquidity (mints > burns)
            const positionLiquidityMap = new Map<string, bigint>();
            
            // Add liquidity from mints
            allMints.forEach((mint) => {
              if (!mint.owner || !mint.pool) {
                console.warn('Invalid mint:', mint);
                return;
              }
              const key = `${mint.owner.toLowerCase()}-${mint.pool.id.toLowerCase()}-${mint.tickLower}-${mint.tickUpper}`;
              const current = positionLiquidityMap.get(key) || BigInt(0);
              positionLiquidityMap.set(key, current + BigInt(mint.amount || '0'));
            });
            
            // Subtract liquidity from burns
            allBurns.forEach((burn) => {
              if (!burn.owner || !burn.pool) return;
              const key = `${burn.owner.toLowerCase()}-${burn.pool.id.toLowerCase()}-${burn.tickLower}-${burn.tickUpper}`;
              const current = positionLiquidityMap.get(key) || BigInt(0);
              positionLiquidityMap.set(key, current - BigInt(burn.amount || '0'));
            });
            
            // Count positions with positive liquidity (active positions)
            totalPositions = Array.from(positionLiquidityMap.values()).filter(
              (liquidity) => liquidity > 0
            ).length;
            
            console.log(`Total active positions: ${totalPositions}`);
            
            // Count active users (unique addresses from mints, burns, and swaps)
            const uniqueUsers = new Set<string>();
            
            // Add users from mints
            allMints.forEach((mint) => {
              if (mint.owner) {
                uniqueUsers.add(mint.owner.toLowerCase());
              }
            });
            
            // Add users from burns
            allBurns.forEach((burn) => {
              if (burn.owner) {
                uniqueUsers.add(burn.owner.toLowerCase());
              }
            });
            
            // Fetch swaps to count active users
            const allSwaps: SubgraphSwapsResponse['swaps'] = [];
            let swapsSkip = 0;
            const swapsBatchSize = 1000;
            let hasMoreSwaps = true;
            
            while (hasMoreSwaps) {
              const swapsResponse = await query<SubgraphSwapsResponse>(GET_ALL_SWAPS_QUERY, {
                first: swapsBatchSize,
                skip: swapsSkip,
              });
              
              const batch = swapsResponse.swaps || [];
              allSwaps.push(...batch);
              
              hasMoreSwaps = batch.length === swapsBatchSize;
              swapsSkip += swapsBatchSize;
              
              if (swapsSkip >= 10000) {
                hasMoreSwaps = false;
              }
            }
            
            console.log(`Found ${allSwaps.length} total swaps`);
            
            // Add users from swaps (origin, sender, recipient)
            allSwaps.forEach((swap) => {
              if (swap.origin) {
                uniqueUsers.add(swap.origin.toLowerCase());
              }
              if (swap.sender) {
                uniqueUsers.add(swap.sender.toLowerCase());
              }
              if (swap.recipient) {
                uniqueUsers.add(swap.recipient.toLowerCase());
              }
            });
            
            activeUsers = uniqueUsers.size;
            console.log(`Total active users: ${activeUsers}`);
          } catch (positionError) {
            console.error('Failed to fetch positions/users count:', positionError);
            // If position/user counting fails, we'll keep it at 0
            // This is a non-critical metric
          }
          
          setStats({
            totalTVL,
            tvlChange24h,
            volume24h,
            volumeChange24h,
            volume7d,
            volume30d,
            totalPools: pools.length,
            totalPositions,
            activeUsers,
            totalFees,
          });
        } catch (subgraphError) {
          console.warn('Failed to fetch protocol stats from subgraph:', subgraphError);
          // Keep default values
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching protocol stats:', error);
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, isLoading };
}

