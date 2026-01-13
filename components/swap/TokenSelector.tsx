'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Token } from '@/types/token';
import { formatAddress } from '@/lib/utils';
import { useTokenList } from '@/hooks/useTokenList';

interface TokenSelectorProps {
  selectedToken: Token | null;
  onTokenSelect: (token: Token | null) => void;
  excludeToken?: Token | null;
  disabled?: boolean;
}

export function TokenSelector({
  selectedToken,
  onTokenSelect,
  excludeToken,
  disabled = false,
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

  // Disable background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save the current overflow style
      const originalStyle = window.getComputedStyle(document.body).overflow;
      // Disable scrolling
      document.body.style.overflow = 'hidden';
      
      // Cleanup: restore scrolling when modal closes or component unmounts
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center space-x-2 px-4 py-2.5 bg-gray-50 dark:bg-input-bg rounded-xl border border-border transition-all min-w-[120px] font-medium ${
          disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-gray-100 dark:hover:bg-bg hover:border-[color:var(--border-hover)] cursor-pointer shadow-sm hover:shadow-md'
        }`}
      >
        {selectedToken ? (
          <>
            <span className="font-semibold text-text-primary">{selectedToken.symbol}</span>
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          </>
        ) : (
          <>
            <span className="text-text-secondary">Select</span>
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          </>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-white dark:bg-input-bg rounded-2xl shadow-2xl border border-border z-50 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-text-primary">Select a token</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-bg rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or paste address"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-bg rounded-xl border border-border outline-none focus:border-primary transition-colors text-text-primary placeholder-text-secondary"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-text-secondary">Loading tokens...</div>
              ) : filteredTokens.length === 0 ? (
                <div className="p-8 text-center text-text-secondary">No tokens found</div>
              ) : (
                <div className="p-2">
                  {filteredTokens.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => handleSelect(token)}
                      className="w-full flex items-center space-x-3 p-4 hover:bg-gray-50 dark:hover:bg-bg rounded-xl transition-colors"
                    >
                      <div className="w-10 h-10 bg-gray-200 dark:bg-bg rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-text-primary font-semibold">{token.symbol[0]}</span>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-semibold text-text-primary truncate">{token.symbol}</div>
                        <div className="text-sm text-text-secondary truncate">{token.name}</div>
                      </div>
                      <div className="text-xs text-text-secondary font-mono flex-shrink-0">
                        {formatAddress(token.address)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border">
              <button
                onClick={() => {
                  // Handle token import by address
                  const address = prompt('Enter token address:');
                  if (address) {
                    // Validate and add token
                    // This would typically call a function to import the token
                  }
                }}
                className="w-full text-primary hover:opacity-80 text-sm font-medium transition-colors py-2"
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

