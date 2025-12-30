import { useState, useEffect } from 'react';
import { Pool } from '@/types/pool';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { Pool_ABI } from '@/abis/Pool';
import { formatUnits } from '@/lib/utils';
import { Token } from '@/types/token';

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

  // Normalize pool address
  const normalizedAddress = poolAddress?.toLowerCase().startsWith('0x')
    ? (poolAddress.toLowerCase() as `0x${string}`)
    : poolAddress
    ? (`0x${poolAddress.toLowerCase().replace(/^0x/, '')}` as `0x${string}`)
    : undefined;

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

  // Combine all loading states
  const isAnyLoading =
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
    isLoadingToken1Decimals;

  useEffect(() => {
    if (isAnyLoading) {
      setIsLoading(true);
      return;
    }

    if (
      !token0Address ||
      !token1Address ||
      fee === undefined ||
      !slot0 ||
      !token0Symbol ||
      !token0Name ||
      token0Decimals === undefined ||
      !token1Symbol ||
      !token1Name ||
      token1Decimals === undefined
    ) {
      setIsLoading(false);
      setPool(null);
      return;
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

      // For now, set volumes, TVL, and APR to 0
      // In production, these would come from a subgraph or event indexing
      const poolData: Pool = {
        address: normalizedAddress || poolAddress,
        token0,
        token1,
        feeTier: Number(fee) / 10000, // Convert from basis points to percentage
        tvl: 0, // Would need to calculate from liquidity and reserves
        volume24h: 0, // Would need from subgraph/events
        volume7d: 0, // Would need from subgraph/events
        volume30d: 0, // Would need from subgraph/events
        apr: 0, // Would need to calculate from fees and TVL
        currentPrice,
        createdAt: Math.floor(Date.now() / 1000), // Would need from contract creation block
      };

      setPool(poolData);
      setIsLoading(false);
    } catch (error) {
      console.error('Error constructing pool data:', error);
      setPool(null);
      setIsLoading(false);
    }
  }, [
    poolAddress,
    normalizedAddress,
    token0Address,
    token1Address,
    fee,
    slot0,
    liquidity,
    token0Symbol,
    token0Name,
    token0Decimals,
    token1Symbol,
    token1Name,
    token1Decimals,
    isAnyLoading,
  ]);

  return { pool, isLoading };
}

