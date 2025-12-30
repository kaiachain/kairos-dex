import { useState, useEffect } from 'react';
import { query } from '@/lib/graphql';
import { GET_PROTOCOL_STATS_FROM_POOLS_QUERY } from '@/lib/graphql-queries';
import { SubgraphProtocolStatsFromPoolsResponse } from '@/types/subgraph';

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
          
          const totalFees = pools.reduce((sum, pool) => 
            sum + parseFloat(pool.feesUSD || '0'), 0
          );
          
          setStats({
            totalTVL,
            tvlChange24h,
            volume24h,
            volumeChange24h,
            volume7d,
            volume30d,
            totalPools: pools.length,
            totalPositions: 0,
            activeUsers: 0,
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

