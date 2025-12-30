import { useState, useEffect } from 'react';
import { Pool } from '@/types/pool';
import { usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { Factory_ABI } from '@/abis/Factory';
import { Pool_ABI } from '@/abis/Pool';
import { erc20Abi, decodeEventLog } from 'viem';
import { Token } from '@/types/token';
import { FEE_TIERS } from '@/config/contracts';
import { useTokenList } from './useTokenList';

// Helper function to calculate price from sqrtPriceX96
function calculatePriceFromSqrtPriceX96(sqrtPriceX96: bigint, token0Decimals: number, token1Decimals: number): number {
  const Q96 = BigInt(2) ** BigInt(96);
  const price = (Number(sqrtPriceX96) / Number(Q96)) ** 2;
  const decimalsAdjustment = 10 ** (token0Decimals - token1Decimals);
  return price * decimalsAdjustment;
}

// Helper function to fetch pool data for a single address
async function fetchPoolData(
  poolAddress: string,
  publicClient: any
): Promise<Pool | null> {
  try {
    const normalizedAddress = poolAddress.toLowerCase().startsWith('0x')
      ? (poolAddress.toLowerCase() as `0x${string}`)
      : (`0x${poolAddress.toLowerCase().replace(/^0x/, '')}` as `0x${string}`);

    // Fetch pool contract data in parallel
    const [token0Address, token1Address, fee, slot0, liquidity] = await Promise.all([
      publicClient.readContract({
        address: normalizedAddress,
        abi: Pool_ABI,
        functionName: 'token0',
      }),
      publicClient.readContract({
        address: normalizedAddress,
        abi: Pool_ABI,
        functionName: 'token1',
      }),
      publicClient.readContract({
        address: normalizedAddress,
        abi: Pool_ABI,
        functionName: 'fee',
      }),
      publicClient.readContract({
        address: normalizedAddress,
        abi: Pool_ABI,
        functionName: 'slot0',
      }),
      publicClient.readContract({
        address: normalizedAddress,
        abi: Pool_ABI,
        functionName: 'liquidity',
      }),
    ]);

    // Fetch token info in parallel
    const [token0Symbol, token0Name, token0Decimals, token1Symbol, token1Name, token1Decimals] = await Promise.all([
      publicClient.readContract({
        address: token0Address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: token0Address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'name',
      }),
      publicClient.readContract({
        address: token0Address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: token1Address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: token1Address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'name',
      }),
      publicClient.readContract({
        address: token1Address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
    ]);

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

    return {
      address: normalizedAddress,
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
  } catch (error) {
    console.error(`Error fetching pool data for ${poolAddress}:`, error);
    return null;
  }
}

export function usePools() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [poolAddresses, setPoolAddresses] = useState<string[]>([]);
  const publicClient = usePublicClient();
  const { tokens } = useTokenList();

  // Watch for new PoolCreated events in real-time
  useEffect(() => {
    if (!publicClient || !CONTRACTS.V3CoreFactory) {
      return;
    }

    // Watch for new pools
    const unwatch = publicClient.watchContractEvent({
      address: CONTRACTS.V3CoreFactory as `0x${string}`,
      abi: Factory_ABI,
      eventName: 'PoolCreated',
      onLogs: (logs) => {
        logs.forEach((log) => {
          try {
            const decoded = decodeEventLog({
              abi: Factory_ABI,
              data: log.data,
              topics: log.topics,
            });
            
            let poolAddress: string | null = null;
            if (decoded.args && typeof decoded.args === 'object') {
              if ('pool' in decoded.args && decoded.args.pool) {
                poolAddress = String(decoded.args.pool).toLowerCase();
              } else if (Array.isArray(decoded.args)) {
                const addr = decoded.args[decoded.args.length - 1];
                if (addr && typeof addr === 'string') {
                  poolAddress = addr.toLowerCase();
                }
              }
            }
            
            if (poolAddress) {
              setPoolAddresses((prev) => {
                // Only add if not already in the list
                if (!prev.includes(poolAddress!)) {
                  const updated = [...prev, poolAddress!];
                  localStorage.setItem('poolAddresses', JSON.stringify(updated));
                  return updated;
                }
                return prev;
              });
            }
          } catch (error) {
            console.error('Error decoding new pool event:', error);
          }
        });
      },
    });

    return () => {
      unwatch();
    };
  }, [publicClient]);

  // Fetch pools using Factory.getPool() for known token pairs
  // This is more direct than scanning events and works for all token combinations
  useEffect(() => {
    if (!publicClient || !CONTRACTS.V3CoreFactory || tokens.length === 0) {
      // If no tokens, try to load from localStorage
      const savedPools = localStorage.getItem('poolAddresses');
      if (savedPools) {
        try {
          const savedAddresses = JSON.parse(savedPools) as string[];
          setPoolAddresses(savedAddresses);
          setIsLoading(false);
        } catch (e) {
          console.error('Error parsing saved pools:', e);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
      return;
    }

    const fetchPoolsFromFactory = async () => {
      try {
        setIsLoading(true);
        const foundAddresses: string[] = [];
        
        // Get all unique token pairs (avoid duplicates by ensuring token0 < token1)
        const tokenPairs: Array<[Token, Token]> = [];
        for (let i = 0; i < tokens.length; i++) {
          for (let j = i + 1; j < tokens.length; j++) {
            const token0 = tokens[i].address.toLowerCase() < tokens[j].address.toLowerCase() 
              ? tokens[i] 
              : tokens[j];
            const token1 = tokens[i].address.toLowerCase() < tokens[j].address.toLowerCase() 
              ? tokens[j] 
              : tokens[i];
            tokenPairs.push([token0, token1]);
          }
        }

        console.log(`Checking ${tokenPairs.length} token pairs across ${FEE_TIERS.length} fee tiers...`);

        // Check each token pair for all fee tiers
        const batchSize = 20; // Process in batches to avoid overwhelming RPC
        for (let i = 0; i < tokenPairs.length; i += batchSize) {
          const batch = tokenPairs.slice(i, i + batchSize);
          
          const batchPromises = batch.flatMap(([token0, token1]) =>
            FEE_TIERS.map(async (feeTier) => {
              try {
                const poolAddress = await publicClient.readContract({
                  address: CONTRACTS.V3CoreFactory as `0x${string}`,
                  abi: Factory_ABI,
                  functionName: 'getPool',
                  args: [
                    token0.address as `0x${string}`,
                    token1.address as `0x${string}`,
                    feeTier.value,
                  ],
                });

                // getPool returns zero address if pool doesn't exist
                if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
                  return (poolAddress as string).toLowerCase();
                }
                return null;
              } catch (error) {
                // Ignore errors for non-existent pools
                return null;
              }
            })
          );

          const batchResults = await Promise.all(batchPromises);
          const validAddresses = batchResults.filter((addr): addr is string => addr !== null);
          foundAddresses.push(...validAddresses);
        }

        // Remove duplicates
        const uniqueAddresses = [...new Set(foundAddresses)];
        console.log(`Found ${uniqueAddresses.length} pools using Factory.getPool()`);

        // Merge with saved pools from localStorage
        const savedPools = localStorage.getItem('poolAddresses');
        if (savedPools) {
          try {
            const savedAddresses = JSON.parse(savedPools) as string[];
            const mergedAddresses = [...new Set([...uniqueAddresses, ...savedAddresses])];
            console.log(`Merged with ${savedAddresses.length} saved pools, total: ${mergedAddresses.length}`);
            setPoolAddresses(mergedAddresses);
            localStorage.setItem('poolAddresses', JSON.stringify(mergedAddresses));
          } catch (e) {
            console.error('Error parsing saved pools:', e);
            setPoolAddresses(uniqueAddresses);
            if (uniqueAddresses.length > 0) {
              localStorage.setItem('poolAddresses', JSON.stringify(uniqueAddresses));
            }
          }
        } else {
          setPoolAddresses(uniqueAddresses);
          if (uniqueAddresses.length > 0) {
            localStorage.setItem('poolAddresses', JSON.stringify(uniqueAddresses));
          }
        }
      } catch (error) {
        console.error('Error fetching pools from Factory:', error);
        // Fallback to localStorage
        const savedPools = localStorage.getItem('poolAddresses');
        if (savedPools) {
          try {
            const savedAddresses = JSON.parse(savedPools) as string[];
            setPoolAddresses(savedAddresses);
            console.log(`Loaded ${savedAddresses.length} pools from localStorage`);
          } catch (e) {
            console.error('Error parsing saved pools:', e);
          }
        }
      }
    };

    fetchPoolsFromFactory();
  }, [publicClient, tokens]);

  // Fetch pool data for all addresses
  useEffect(() => {
    if (!publicClient || poolAddresses.length === 0) {
      setIsLoading(false);
      return;
    }

    const fetchAllPools = async () => {
      try {
        setIsLoading(true);
        
        // Fetch pool data for all addresses in parallel (with limit to avoid overwhelming)
        const batchSize = 10;
        const allPools: Pool[] = [];

        for (let i = 0; i < poolAddresses.length; i += batchSize) {
          const batch = poolAddresses.slice(i, i + batchSize);
          const poolPromises = batch.map((addr) => fetchPoolData(addr, publicClient));
          const batchResults = await Promise.all(poolPromises);
          const validPools = batchResults.filter((pool): pool is Pool => pool !== null);
          allPools.push(...validPools);
        }

        setPools(allPools);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching pool data:', error);
        setIsLoading(false);
      }
    };

    fetchAllPools();
  }, [poolAddresses, publicClient]);

  return { pools, isLoading };
}

