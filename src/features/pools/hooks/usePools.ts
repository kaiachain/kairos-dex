import { useQuery } from '@tanstack/react-query';
import { Pool } from '@/types/pool';
import { query } from '@/lib/graphql';
import { GET_POOLS_QUERY } from '@/lib/graphql-queries';
import { SubgraphPoolsResponse } from '@/types/subgraph';
import { subgraphPoolToPool } from '@/lib/subgraph-utils';
import { queryKeys } from '@/src/providers';

async function fetchPoolsFromSubgraph(): Promise<Pool[]> {
  const response = await query<SubgraphPoolsResponse>(GET_POOLS_QUERY, {
    first: 1000, // Fetch up to 1000 pools
    skip: 0,
    orderBy: 'totalValueLockedUSD',
    orderDirection: 'desc',
  });

  if (response.pools && response.pools.length > 0) {
    return response.pools.map(subgraphPoolToPool);
  }
  return [];
}

export function usePools() {
  const {
    data: pools = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.pools.lists(),
    queryFn: fetchPoolsFromSubgraph,
    staleTime: 5 * 60 * 1000, // 5 minutes - pools don't change frequently
  });

  return { 
    pools, 
    isLoading, 
    error: error instanceof Error ? error : error ? new Error('Failed to fetch pools') : null 
  };
}

