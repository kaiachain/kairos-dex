import { useState, useEffect } from 'react';
import { Pool } from '@/types/pool';
import { query } from '@/lib/graphql';
import { GET_POOLS_QUERY } from '@/lib/graphql-queries';
import { SubgraphPoolsResponse } from '@/types/subgraph';
import { subgraphPoolToPool } from '@/lib/subgraph-utils';

export function usePools() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPoolsFromSubgraph = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch pools from subgraph
        const response = await query<SubgraphPoolsResponse>(GET_POOLS_QUERY, {
          first: 1000, // Fetch up to 1000 pools
          skip: 0,
          orderBy: 'totalValueLockedUSD',
          orderDirection: 'desc',
        });

        if (response.pools && response.pools.length > 0) {
          const subgraphPools = response.pools.map(subgraphPoolToPool);
          setPools(subgraphPools);
        } else {
          setPools([]);
        }
      } catch (err) {
        console.error('Error fetching pools from subgraph:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch pools'));
        setPools([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoolsFromSubgraph();
  }, []);

  return { pools, isLoading, error };
}

