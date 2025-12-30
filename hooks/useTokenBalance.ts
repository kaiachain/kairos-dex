import { useReadContract, useAccount } from 'wagmi';
import { erc20Abi } from 'viem';
import { Token } from '@/types/token';
import { formatUnits } from '@/lib/utils';

export function useTokenBalance(token: Token | null) {
  const { address } = useAccount();

  const { data: balance, isLoading } = useReadContract({
    address: token?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!token && !!address && token.address !== '0x0000000000000000000000000000000000000000',
    },
  });

  // For native token, use useBalance from wagmi
  const { data: nativeBalance } = useAccount();

  if (!token) return { data: null, isLoading: false };

  if (token.address === '0x0000000000000000000000000000000000000000') {
    // Native token balance would be handled separately
    return { data: null, isLoading: false };
  }

  return {
    data: balance ? formatUnits(balance as bigint, token.decimals) : null,
    isLoading,
  };
}

