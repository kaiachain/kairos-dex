import { useState, useEffect } from 'react';

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
    // In production, fetch from subgraph or API
    // For now, return mock data
    setStats({
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
    setIsLoading(false);
  }, []);

  return { stats, isLoading };
}

