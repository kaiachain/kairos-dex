import { useState, useEffect } from 'react';
import { query } from '@/lib/graphql';
import { GET_PROTOCOL_STATS_QUERY } from '@/lib/graphql-queries';
import { SubgraphProtocolStatsResponse } from '@/types/subgraph';
import { CONTRACTS } from '@/config/contracts';

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
          if (!CONTRACTS.V3CoreFactory) {
            throw new Error('Factory address not configured');
          }
          const response = await query<SubgraphProtocolStatsResponse>(GET_PROTOCOL_STATS_QUERY, {
            factoryId: CONTRACTS.V3CoreFactory.toLowerCase() as `0x${string}`,
          });
          
          const factory = response.factory;
          const dayData = response.uniswapDayData;
          
          const today = dayData[0];
          const yesterday = dayData[1];
          
          const totalTVL = factory ? parseFloat(factory.totalValueLockedUSD || '0') : 0;
          const yesterdayTVL = yesterday ? parseFloat(yesterday.tvlUSD || '0') : 0;
          const tvlChange24h = yesterdayTVL > 0 ? ((totalTVL - yesterdayTVL) / yesterdayTVL) * 100 : 0;
          
          const volume24h = today ? parseFloat(today.volumeUSD || '0') : 0;
          const yesterdayVolume = yesterday ? parseFloat(yesterday.volumeUSD || '0') : 0;
          const volumeChange24h = yesterdayVolume > 0 ? ((volume24h - yesterdayVolume) / yesterdayVolume) * 100 : 0;
          
          // Calculate 7d and 30d volume from day data
          const volume7d = dayData
            .slice(0, 7)
            .reduce((sum, day) => sum + parseFloat(day.volumeUSD || '0'), 0);
          
          const volume30d = dayData
            .slice(0, 30)
            .reduce((sum, day) => sum + parseFloat(day.volumeUSD || '0'), 0);
          
          const totalPools = factory ? parseInt(factory.poolCount || '0', 10) : 0;
          const totalFees = factory ? parseFloat(factory.totalFeesUSD || '0') : 0;
          
          setStats({
            totalTVL,
            tvlChange24h,
            volume24h,
            volumeChange24h,
            volume7d,
            volume30d,
            totalPools,
            totalPositions: 0, // Would need separate query for positions count
            activeUsers: 0, // Would need separate query for active users
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

