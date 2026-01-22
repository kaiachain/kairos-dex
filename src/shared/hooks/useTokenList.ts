import { useState, useEffect, useCallback } from 'react';
import { Token } from '@/types/token';
import { CONTRACT_WRAPPED_NATIVE_TOKEN, CHAIN_ID } from '@/config/env';
import { fetchTokenInfo } from './useTokenInfo';
import { getAddress, isAddress } from 'viem';

// Default token addresses - decimals will be fetched from contract
// Note: For Uniswap V3, native tokens (KAIA) must use the Wrapped token address (WKAIA)
// The zero address (0x0000...0000) will cause transaction failures
const DEFAULT_TOKEN_ADDRESSES = [
  // Wrapped KAIA - required for Uniswap V3 pools
  ...(CONTRACT_WRAPPED_NATIVE_TOKEN ? [CONTRACT_WRAPPED_NATIVE_TOKEN] : []),
  '0xd077a400968890eacc75cdc901f0356c943e4fdb', // USDT
  '0x2725b2503f5aa0f612f258e43c24df794550c313', // ABC
  '0xef408df4d326e41d9b13804d4ad9e8f696ca33dd', // XYZ
];

export function useTokenList() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const normalizeAddress = useCallback((address: string) => {
    try {
      return getAddress(address);
    } catch {
      return address;
    }
  }, []);

  const persistCustomTokens = useCallback(
    (allTokens: Token[]) => {
      const customTokens = allTokens.filter(
        (token) =>
          !DEFAULT_TOKEN_ADDRESSES.some(
            (defaultAddress) =>
              defaultAddress.toLowerCase() === token.address.toLowerCase(),
          ),
      );
      localStorage.setItem('customTokens', JSON.stringify(customTokens));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('customTokensUpdated'));
      }
    },
    [],
  );

  const loadTokens = useCallback(async () => {
    setIsLoading(true);
    const loadedTokens: Token[] = [];

    // Fetch token info from contracts
    for (const address of DEFAULT_TOKEN_ADDRESSES) {
      const normalizedAddress = normalizeAddress(address);
      try {
        const tokenInfo = await fetchTokenInfo(normalizedAddress);
        if (tokenInfo) {
          loadedTokens.push({
            address: normalizedAddress,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            decimals: tokenInfo.decimals,
            chainId: CHAIN_ID,
          });
        }
      } catch (error) {
        console.error(`Error fetching token info for ${normalizedAddress}:`, error);
      }
    }

    // Load custom tokens from localStorage
    const savedTokens = localStorage.getItem('customTokens');
    if (savedTokens) {
      try {
        const customTokens = JSON.parse(savedTokens) as Token[];
        // For custom tokens, fetch decimals if not already set
        for (const token of customTokens) {
          const normalizedAddress = normalizeAddress(token.address);
          if (!token.decimals || token.decimals === 18) {
            // Fetch decimals from contract if missing or default
            const tokenInfo = await fetchTokenInfo(normalizedAddress);
            if (tokenInfo) {
              token.decimals = tokenInfo.decimals;
              token.symbol = token.symbol || tokenInfo.symbol;
              token.name = token.name || tokenInfo.name;
            }
          }
          token.address = normalizedAddress;
          token.chainId = token.chainId ?? CHAIN_ID;
        }
        loadedTokens.push(...customTokens);
      } catch (error) {
        console.error('Error loading custom tokens:', error);
      }
    }

    setTokens(loadedTokens);
    setIsLoading(false);
  }, [normalizeAddress]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  useEffect(() => {
    const handleStorageUpdate = () => {
      loadTokens();
    };

    window.addEventListener('customTokensUpdated', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);

    return () => {
      window.removeEventListener('customTokensUpdated', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [loadTokens]);

  const addCustomToken = useCallback(
    async (address: string) => {
      const trimmed = address.trim();
      if (!isAddress(trimmed)) {
        throw new Error('Enter a valid token contract address');
      }
      const checksumAddress = getAddress(trimmed);

      const exists = tokens.some(
        (token) => token.address.toLowerCase() === checksumAddress.toLowerCase(),
      );
      if (exists) {
        throw new Error('Token already in the list');
      }

      const tokenInfo = await fetchTokenInfo(checksumAddress);
      if (!tokenInfo) {
        throw new Error('Unable to fetch token info from contract');
      }

      const newToken: Token = {
        address: checksumAddress,
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        decimals: tokenInfo.decimals,
        chainId: CHAIN_ID,
      };

      setTokens((prev) => {
        const hasToken = prev.some(
          (token) => token.address.toLowerCase() === checksumAddress.toLowerCase(),
        );
        if (hasToken) return prev;
        const updatedTokens = [...prev, newToken];
        persistCustomTokens(updatedTokens);
        return updatedTokens;
      });

      return newToken;
    },
    [persistCustomTokens, tokens],
  );

  return { tokens, isLoading, addCustomToken };
}

