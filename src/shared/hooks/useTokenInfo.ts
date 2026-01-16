import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { Token } from '@/types/token';

/**
 * Hook to fetch token info (decimals, symbol, name) from contract
 */
export function useTokenInfo(tokenAddress: string | null) {
  const { data: decimals, isLoading: isLoadingDecimals } = useReadContract({
    address: tokenAddress as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    query: {
      enabled: !!tokenAddress,
    },
  });

  const { data: symbol, isLoading: isLoadingSymbol } = useReadContract({
    address: tokenAddress as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'symbol',
    query: {
      enabled: !!tokenAddress,
    },
  });

  const { data: name, isLoading: isLoadingName } = useReadContract({
    address: tokenAddress as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'name',
    query: {
      enabled: !!tokenAddress,
    },
  });

  return {
    decimals: decimals !== undefined ? Number(decimals) : undefined,
    symbol: symbol as string | undefined,
    name: name as string | undefined,
    isLoading: isLoadingDecimals || isLoadingSymbol || isLoadingName,
  };
}

/**
 * Fetch token info from contract (for use outside React components)
 */
export async function fetchTokenInfo(tokenAddress: string) {
  // Use the public client from sdk-utils
  const { createPublicClient, http } = await import('viem');
  const { kairosTestnet } = await import('@/config/wagmi');
  const { RPC_URL } = await import('@/config/env');
  
  const publicClient = createPublicClient({
    chain: kairosTestnet,
    transport: http(RPC_URL),
  });
  
  try {
    const [decimals, symbol, name] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'name',
      }),
    ]);

    return {
      decimals: Number(decimals),
      symbol: symbol as string,
      name: name as string,
    };
  } catch (error) {
    console.error('Error fetching token info:', error);
    return null;
  }
}

