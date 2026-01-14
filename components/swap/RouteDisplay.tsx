'use client';

import { useState, useEffect } from 'react';
import { Token } from '@/types/token';
import { ArrowRight, Info } from 'lucide-react';
import { useTokenList } from '@/hooks/useTokenList';
import { fetchTokenInfo } from '@/hooks/useTokenInfo';

interface RouteDisplayProps {
  route: string[];
  tokenIn: Token;
  tokenOut: Token;
}

interface RouteToken {
  address: string;
  symbol: string;
  isLoading: boolean;
}

export function RouteDisplay({ route, tokenIn, tokenOut }: RouteDisplayProps) {
  const { tokens } = useTokenList();
  const [routeTokens, setRouteTokens] = useState<RouteToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRouteTokens = async () => {
      if (!route || route.length < 2) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const loadedTokens: RouteToken[] = [];

      for (const address of route) {
        const addressLower = address.toLowerCase();
        
        // Check if it's the input or output token (we already have their info)
        if (addressLower === tokenIn.address.toLowerCase()) {
          loadedTokens.push({
            address: addressLower,
            symbol: tokenIn.symbol,
            isLoading: false,
          });
          continue;
        }
        
        if (addressLower === tokenOut.address.toLowerCase()) {
          loadedTokens.push({
            address: addressLower,
            symbol: tokenOut.symbol,
            isLoading: false,
          });
          continue;
        }

        // Check if token is in the token list
        const tokenFromList = tokens.find(
          (t) => t.address.toLowerCase() === addressLower
        );

        if (tokenFromList) {
          loadedTokens.push({
            address: addressLower,
            symbol: tokenFromList.symbol,
            isLoading: false,
          });
        } else {
          // Fetch token info from contract
          loadedTokens.push({
            address: addressLower,
            symbol: '...',
            isLoading: true,
          });

          try {
            const tokenInfo = await fetchTokenInfo(address);
            if (tokenInfo) {
              const index = loadedTokens.findIndex(
                (t) => t.address === addressLower
              );
              if (index !== -1) {
                loadedTokens[index] = {
                  address: addressLower,
                  symbol: tokenInfo.symbol,
                  isLoading: false,
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching token info for ${address}:`, error);
            // Use shortened address as fallback
            const index = loadedTokens.findIndex(
              (t) => t.address === addressLower
            );
            if (index !== -1) {
              loadedTokens[index] = {
                address: addressLower,
                symbol: `${address.slice(0, 6)}...${address.slice(-4)}`,
                isLoading: false,
              };
            }
          }
        }
      }

      setRouteTokens(loadedTokens);
      setIsLoading(false);
    };

    loadRouteTokens();
  }, [route, tokenIn, tokenOut, tokens]);

  // Don't show route if it's invalid or a direct swap (only 2 tokens)
  // For direct swaps, users can see it's direct from the token selection
  if (!route || route.length <= 2) {
    return null;
  }

  const hops = route.length - 1;
  const isMultiHop = hops > 1;

  return (
    <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-text-primary">
            Route ({hops} {hops === 1 ? 'hop' : 'hops'})
          </span>
        </div>
        {isMultiHop && (
          <span className="text-xs text-primary bg-primary/20 px-2 py-0.5 rounded">
            Multi-hop
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2 flex-wrap">
        {isLoading ? (
          <div className="text-sm text-text-secondary">
            Loading route...
          </div>
        ) : (
          routeTokens.map((token, index) => (
            <div key={`${token.address}-${index}`} className="flex items-center gap-2">
              <span
                className={`text-sm font-medium px-2 py-1 rounded ${
                  index === 0
                    ? 'bg-primary/20 text-primary'
                    : index === routeTokens.length - 1
                    ? 'bg-primary/20 text-primary'
                    : 'bg-white dark:bg-card text-text-primary'
                }`}
              >
                {token.isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  token.symbol
                )}
              </span>
              {index < routeTokens.length - 1 && (
                <ArrowRight className="w-4 h-4 text-primary" />
              )}
            </div>
          ))
        )}
      </div>
      
      {isMultiHop && (
        <div className="mt-2 text-xs text-text-secondary">
          This swap will route through {hops - 1} intermediate token{hops - 1 > 1 ? 's' : ''} for optimal pricing.
        </div>
      )}
    </div>
  );
}
