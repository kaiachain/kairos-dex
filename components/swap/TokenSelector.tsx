'use client';

import { useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Token } from '@/types/token';
import { formatAddress } from '@/lib/utils';
import { useTokenList } from '@/hooks/useTokenList';

interface TokenSelectorProps {
  selectedToken: Token | null;
  onTokenSelect: (token: Token | null) => void;
  excludeToken?: Token | null;
}

export function TokenSelector({
  selectedToken,
  onTokenSelect,
  excludeToken,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { tokens, isLoading } = useTokenList();

  const filteredTokens = tokens.filter((token) => {
    if (excludeToken && token.address === excludeToken.address) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      token.name.toLowerCase().includes(query) ||
      token.symbol.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    );
  });

  const handleSelect = (token: Token) => {
    onTokenSelect(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-w-[120px]"
      >
        {selectedToken ? (
          <>
            <span className="font-semibold">{selectedToken.symbol}</span>
            <ChevronDown className="w-4 h-4" />
          </>
        ) : (
          <>
            <span className="text-gray-500">Select</span>
            <ChevronDown className="w-4 h-4" />
          </>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[500px] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Select a token</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or paste address"
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading tokens...</div>
              ) : filteredTokens.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No tokens found</div>
              ) : (
                <div className="p-2">
                  {filteredTokens.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => handleSelect(token)}
                      className="w-full flex items-center space-x-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                        {token.symbol[0]}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{token.symbol}</div>
                        <div className="text-sm text-gray-500">{token.name}</div>
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {formatAddress(token.address)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  // Handle token import by address
                  const address = prompt('Enter token address:');
                  if (address) {
                    // Validate and add token
                    // This would typically call a function to import the token
                  }
                }}
                className="w-full text-primary-600 dark:text-primary-400 hover:underline text-sm"
              >
                Import token by address
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

