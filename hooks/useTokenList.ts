import { useState, useEffect } from 'react';
import { Token } from '@/types/token';
import { CONTRACT_WRAPPED_NATIVE_TOKEN, CHAIN_ID } from '@/config/env';
import { fetchTokenInfo } from './useTokenInfo';

// Default token addresses - decimals will be fetched from contract
// Note: For Uniswap V3, native tokens (KAIA) must use the Wrapped token address (WKAIA)
// The zero address (0x0000...0000) will cause transaction failures
const DEFAULT_TOKEN_ADDRESSES = [
  // Wrapped KAIA - required for Uniswap V3 pools
  ...(CONTRACT_WRAPPED_NATIVE_TOKEN ? [CONTRACT_WRAPPED_NATIVE_TOKEN] : []),
  '0xd077a400968890eacc75cdc901f0356c943e4fdb', // USDT
  '0xf142b2781d37dBA0E13C992EB412F30A7aB768EA', // YTK
  '0x30BA1A6c002ad0510e2521E6373C3e76f553D67f', // MTK
];

export function useTokenList() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTokens = async () => {
      setIsLoading(true);
      const loadedTokens: Token[] = [];

      // Fetch token info from contracts
      for (const address of DEFAULT_TOKEN_ADDRESSES) {
        try {
          const tokenInfo = await fetchTokenInfo(address);
          if (tokenInfo) {
            loadedTokens.push({
              address,
              symbol: tokenInfo.symbol,
              name: tokenInfo.name,
              decimals: tokenInfo.decimals,
              chainId: CHAIN_ID,
            });
          }
        } catch (error) {
          console.error(`Error fetching token info for ${address}:`, error);
        }
      }

      // Load custom tokens from localStorage
      const savedTokens = localStorage.getItem('customTokens');
      if (savedTokens) {
        try {
          const customTokens = JSON.parse(savedTokens) as Token[];
          // For custom tokens, fetch decimals if not already set
          for (const token of customTokens) {
            if (!token.decimals || token.decimals === 18) {
              // Fetch decimals from contract if missing or default
              const tokenInfo = await fetchTokenInfo(token.address);
              if (tokenInfo) {
                token.decimals = tokenInfo.decimals;
              }
            }
          }
          loadedTokens.push(...customTokens);
        } catch (error) {
          console.error('Error loading custom tokens:', error);
        }
      }

      setTokens(loadedTokens);
      setIsLoading(false);
    };

    loadTokens();
  }, []);

  return { tokens, isLoading };
}

