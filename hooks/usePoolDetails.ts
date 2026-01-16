import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pool } from '@/types/pool';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { Pool_ABI } from '@/abis/Pool';
import { formatUnits } from '@/lib/utils';
import { Token } from '@/types/token';
import { query } from '@/lib/graphql';
import { GET_POOL_BY_ADDRESS_QUERY } from '@/lib/graphql-queries';
import { SubgraphPoolResponse } from '@/types/subgraph';
import { subgraphPoolToPool } from '@/lib/subgraph-utils';
import { queryKeys } from '@/src/providers';

// Helper function to calculate price from sqrtPriceX96
function calculatePriceFromSqrtPriceX96(sqrtPriceX96: bigint, token0Decimals: number, token1Decimals: number): number {
  // Price = (sqrtPriceX96 / 2^96)^2
  // Adjust for token decimals: price = (sqrtPriceX96 / 2^96)^2 * (10^token0Decimals / 10^token1Decimals)
  const Q96 = BigInt(2) ** BigInt(96);
  const price = (Number(sqrtPriceX96) / Number(Q96)) ** 2;
  const decimalsAdjustment = 10 ** (token0Decimals - token1Decimals);
  return price * decimalsAdjustment;
}

async function fetchPoolFromSubgraph(normalizedAddress: string): Promise<Pool | null> {
  try {
    const response = await query<SubgraphPoolResponse>(GET_POOL_BY_ADDRESS_QUERY, {
      id: normalizedAddress.toLowerCase(),
    });

    if (response.pool) {
      return subgraphPoolToPool(response.pool);
    }
    return null;
  } catch (subgraphError) {
    console.warn('Failed to fetch pool from subgraph, falling back to contracts:', subgraphError);
    return null;
  }
}

export function usePoolDetails(poolAddress: string) {
  // Normalize pool address - memoize to prevent unnecessary recalculations
  const normalizedAddress = useMemo(() => {
    if (!poolAddress) return undefined;
    return poolAddress?.toLowerCase().startsWith('0x')
      ? (poolAddress.toLowerCase() as `0x${string}`)
      : (`0x${poolAddress.toLowerCase().replace(/^0x/, '')}` as `0x${string}`);
  }, [poolAddress]);

  // Read pool contract data
  const { data: token0Address, isLoading: isLoadingToken0 } = useReadContract({
    address: normalizedAddress,
    abi: Pool_ABI,
    functionName: 'token0',
    query: {
      enabled: !!normalizedAddress && normalizedAddress.startsWith('0x'),
    },
  });

  const { data: token1Address, isLoading: isLoadingToken1 } = useReadContract({
    address: normalizedAddress,
    abi: Pool_ABI,
    functionName: 'token1',
    query: {
      enabled: !!normalizedAddress && normalizedAddress.startsWith('0x'),
    },
  });

  const { data: fee, isLoading: isLoadingFee } = useReadContract({
    address: normalizedAddress,
    abi: Pool_ABI,
    functionName: 'fee',
    query: {
      enabled: !!normalizedAddress && normalizedAddress.startsWith('0x'),
    },
  });

  const { data: slot0, isLoading: isLoadingSlot0 } = useReadContract({
    address: normalizedAddress,
    abi: Pool_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!normalizedAddress && normalizedAddress.startsWith('0x'),
    },
  });

  const { data: liquidity, isLoading: isLoadingLiquidity } = useReadContract({
    address: normalizedAddress,
    abi: Pool_ABI,
    functionName: 'liquidity',
    query: {
      enabled: !!normalizedAddress && normalizedAddress.startsWith('0x'),
    },
  });

  // Fetch token0 info
  const { data: token0Symbol, isLoading: isLoadingToken0Symbol } = useReadContract({
    address: token0Address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'symbol',
    query: {
      enabled: !!token0Address,
    },
  });

  const { data: token0Name, isLoading: isLoadingToken0Name } = useReadContract({
    address: token0Address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'name',
    query: {
      enabled: !!token0Address,
    },
  });

  const { data: token0Decimals, isLoading: isLoadingToken0Decimals } = useReadContract({
    address: token0Address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    query: {
      enabled: !!token0Address,
    },
  });

  // Fetch token1 info
  const { data: token1Symbol, isLoading: isLoadingToken1Symbol } = useReadContract({
    address: token1Address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'symbol',
    query: {
      enabled: !!token1Address,
    },
  });

  const { data: token1Name, isLoading: isLoadingToken1Name } = useReadContract({
    address: token1Address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'name',
    query: {
      enabled: !!token1Address,
    },
  });

  const { data: token1Decimals, isLoading: isLoadingToken1Decimals } = useReadContract({
    address: token1Address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    query: {
      enabled: !!token1Address,
    },
  });

  // Combine all loading states - memoize to prevent unnecessary recalculations
  const isAnyLoading = useMemo(
    () =>
      isLoadingToken0 ||
      isLoadingToken1 ||
      isLoadingFee ||
      isLoadingSlot0 ||
      isLoadingLiquidity ||
      isLoadingToken0Symbol ||
      isLoadingToken0Name ||
      isLoadingToken0Decimals ||
      isLoadingToken1Symbol ||
      isLoadingToken1Name ||
      isLoadingToken1Decimals,
    [
      isLoadingToken0,
      isLoadingToken1,
      isLoadingFee,
      isLoadingSlot0,
      isLoadingLiquidity,
      isLoadingToken0Symbol,
      isLoadingToken0Name,
      isLoadingToken0Decimals,
      isLoadingToken1Symbol,
      isLoadingToken1Name,
      isLoadingToken1Decimals,
    ]
  );

  // Check if all contract data is ready for fallback
  const isContractDataReady = useMemo(
    () =>
      !!token0Address &&
      !!token1Address &&
      fee !== undefined &&
      !!slot0 &&
      !!token0Symbol &&
      !!token0Name &&
      token0Decimals !== undefined &&
      !!token1Symbol &&
      !!token1Name &&
      token1Decimals !== undefined,
    [
      token0Address,
      token1Address,
      fee,
      slot0,
      token0Symbol,
      token0Name,
      token0Decimals,
      token1Symbol,
      token1Name,
      token1Decimals,
    ]
  );

  // Fetch from subgraph first using React Query
  const {
    data: subgraphPool,
    isLoading: isLoadingSubgraph,
    error: subgraphError,
  } = useQuery({
    queryKey: queryKeys.pools.detail(normalizedAddress || ''),
    queryFn: () => normalizedAddress ? fetchPoolFromSubgraph(normalizedAddress) : null,
    enabled: !!normalizedAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Build pool from contracts as fallback
  const contractPool = useMemo(() => {
    if (subgraphPool || !isContractDataReady || isAnyLoading) {
      return null;
    }

    try {
      const sqrtPriceX96 = (slot0 as any)[0] as bigint;
      const currentPrice = calculatePriceFromSqrtPriceX96(
        sqrtPriceX96,
        Number(token0Decimals),
        Number(token1Decimals)
      );

      const token0: Token = {
        address: token0Address as string,
        symbol: token0Symbol as string,
        name: token0Name as string,
        decimals: Number(token0Decimals),
      };

      const token1: Token = {
        address: token1Address as string,
        symbol: token1Symbol as string,
        name: token1Name as string,
        decimals: Number(token1Decimals),
      };

      // Fallback pool data without subgraph metrics
      return {
        address: normalizedAddress || poolAddress,
        token0,
        token1,
        feeTier: Number(fee) / 10000,
        tvl: 0,
        volume24h: 0,
        volume7d: 0,
        volume30d: 0,
        apr: 0,
        currentPrice,
        createdAt: Math.floor(Date.now() / 1000),
      } as Pool;
    } catch (error) {
      console.error('Error constructing pool data:', error);
      return null;
    }
  }, [
    subgraphPool,
    isContractDataReady,
    isAnyLoading,
    slot0,
    token0Address,
    token0Symbol,
    token0Name,
    token0Decimals,
    token1Address,
    token1Symbol,
    token1Name,
    token1Decimals,
    fee,
    normalizedAddress,
    poolAddress,
  ]);

  // Determine final pool and loading state
  const pool = subgraphPool || contractPool;
  const isLoading = isLoadingSubgraph || (isAnyLoading && !subgraphPool && !contractPool);

  return { pool, isLoading };
}

