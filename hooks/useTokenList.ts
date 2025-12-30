import { useState, useEffect } from 'react';
import { Token } from '@/types/token';
import { CONTRACT_WRAPPED_NATIVE_TOKEN, CHAIN_ID } from '@/config/env';

// Default token list - in production, this would come from an API or token list service
// Note: For Uniswap V3, native tokens (KAIA) must use the Wrapped token address (WKAIA)
// The zero address (0x0000...0000) will cause transaction failures
const DEFAULT_TOKENS: Token[] = [
  // Wrapped KAIA - required for Uniswap V3 pools
  // If WKAIA address is not configured, this will be empty and should be added manually
  ...(CONTRACT_WRAPPED_NATIVE_TOKEN
    ? [
        {
          address: CONTRACT_WRAPPED_NATIVE_TOKEN,
          symbol: 'WKAIA',
          name: 'Wrapped KAIA',
          decimals: 18,
          chainId: CHAIN_ID,
        },
      ]
    : []),
  {
    address: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 18,
    chainId: CHAIN_ID,
  },
];

export function useTokenList() {
  const [tokens, setTokens] = useState<Token[]>(DEFAULT_TOKENS);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load tokens from localStorage if available
    const savedTokens = localStorage.getItem('customTokens');
    if (savedTokens) {
      try {
        const customTokens = JSON.parse(savedTokens);
        setTokens([...DEFAULT_TOKENS, ...customTokens]);
      } catch (error) {
        console.error('Error loading custom tokens:', error);
      }
    }

    // In production, fetch from token list API
    // fetchTokenList();
  }, []);

  return { tokens, isLoading };
}

