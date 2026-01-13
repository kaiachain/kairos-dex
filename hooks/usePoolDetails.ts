import { useState, useEffect, useMemo, useRef } from 'react';
import { Pool } from '@/types/pool';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { Pool_ABI } from '@/abis/Pool';
import { formatUnits } from '@/lib/utils';
import { Token } from '@/types/token';
import { query } from '@/lib/graphql';
import { GET_POOL_BY_ADDRESS_QUERY, GET_POOL_DAY_DATA_QUERY, GET_POOL_HOUR_DATA_QUERY } from '@/lib/graphql-queries';
import { SubgraphPoolResponse } from '@/types/subgraph';
import { subgraphPoolToPool } from '@/lib/subgraph-utils';

// Helper function to calculate price from sqrtPriceX96
function calculatePriceFromSqrtPriceX96(sqrtPriceX96: bigint, token0Decimals: number, token1Decimals: number): number {
  // Price = (sqrtPriceX96 / 2^96)^2
  // Adjust for token decimals: price = (sqrtPriceX96 / 2^96)^2 * (10^token0Decimals / 10^token1Decimals)
  const Q96 = BigInt(2) ** BigInt(96);
  const price = (Number(sqrtPriceX96) / Number(Q96)) ** 2;
  const decimalsAdjustment = 10 ** (token0Decimals - token1Decimals);
  return price * decimalsAdjustment;
}

export function usePoolDetails(poolAddress: string) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchStateRef = useRef<{ address: string; hasFetched: boolean; contractBuilt: boolean }>({ 
    address: '', 
    hasFetched: false,
    contractBuilt: false 
  });

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

  // Fetch from subgraph first - only run once per pool address
  useEffect(() => {
    if (!normalizedAddress || !poolAddress) {
      setIsLoading(false);
      setPool(null);
      fetchStateRef.current = { address: '', hasFetched: false, contractBuilt: false };
      return;
    }

    // Reset fetch flag when pool address changes
    if (fetchStateRef.current.address !== normalizedAddress) {
      fetchStateRef.current = { address: normalizedAddress, hasFetched: false, contractBuilt: false };
      setIsLoading(true);
      setPool(null);
    }

    // Only fetch once per pool address
    if (fetchStateRef.current.hasFetched && fetchStateRef.current.address === normalizedAddress) {
      return;
    }

    const fetchPoolFromSubgraph = async () => {
      fetchStateRef.current.hasFetched = true;
      
      try {
        // Try to fetch from subgraph first
        try {
          const response = await query<SubgraphPoolResponse>(GET_POOL_BY_ADDRESS_QUERY, {
            id: normalizedAddress.toLowerCase(),
          });

          if (response.pool) {
            const poolData = subgraphPoolToPool(response.pool);
            setPool(poolData);
            setIsLoading(false);
            return;
          }
        } catch (subgraphError) {
          console.warn('Failed to fetch pool from subgraph, falling back to contracts:', subgraphError);
        }

        // If subgraph fetch failed, wait for contract data
        // This will be handled by the second useEffect
      } catch (error) {
        console.error('Error fetching pool from subgraph:', error);
        // Continue to fallback
      }
    };

    fetchPoolFromSubgraph();
  }, [poolAddress, normalizedAddress]);

  // Fallback to contract-based fetching - only when subgraph fails and contract data is ready
  useEffect(() => {
    // Skip if we already have pool data
    if (pool) {
      return;
    }

    // Skip if address doesn't match or we haven't attempted subgraph fetch
    if (!normalizedAddress || !poolAddress || fetchStateRef.current.address !== normalizedAddress || !fetchStateRef.current.hasFetched) {
      return;
    }

    // Skip if we've already built from contracts
    if (fetchStateRef.current.contractBuilt) {
      return;
    }

    // Skip if still loading contract data
    if (isAnyLoading) {
      return;
    }

    // Only proceed if contract data is ready
    if (!isContractDataReady) {
      setIsLoading(false);
      setPool(null);
      return;
    }

    const buildPoolFromContracts = () => {
      fetchStateRef.current.contractBuilt = true;
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
        const poolData: Pool = {
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
        };

        setPool(poolData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error constructing pool data:', error);
        setPool(null);
        setIsLoading(false);
      }
    };

    buildPoolFromContracts();
  }, [
    pool,
    normalizedAddress,
    poolAddress,
    isAnyLoading,
    isContractDataReady,
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
  ]);

  return { pool, isLoading };
}

