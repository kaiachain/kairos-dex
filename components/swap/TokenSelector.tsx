'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import { isAddress } from 'viem';
import { Token } from '@/types/token';
import { formatAddress } from '@/lib/utils';
import { useTokenInfo } from '@/hooks/useTokenInfo';
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
  const [importAddress, setImportAddress] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { tokens, isLoading, addCustomToken } = useTokenList();

  const normalizedImportAddress = importAddress.trim();
  const isAddressValid = isAddress(normalizedImportAddress);
  const {
    symbol: previewSymbol,
    name: previewName,
    decimals: previewDecimals,
    isLoading: isPreviewLoading,
  } = useTokenInfo(isAddressValid ? normalizedImportAddress : null);

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
    setImportAddress('');
  };

  const handleImport = async () => {
    if (!isAddressValid) return;
    setImportError(null);
    setIsImporting(true);

    try {
      const token = await addCustomToken(normalizedImportAddress);
      handleSelect(token);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to import token';
      setImportError(message);
    } finally {
      setIsImporting(false);
    }
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

  // When a user pastes an address in the search field, mirror it in the import form
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!importAddress && isAddress(trimmed)) {
      setImportAddress(trimmed);
    }
  }, [importAddress, searchQuery]);

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
          <div className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-white dark:bg-card rounded-3xl shadow-2xl border border-border z-50 max-h-[80vh] flex flex-col">
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
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-input-bg rounded-xl border border-border outline-none focus:border-primary transition-colors text-text-primary placeholder-text-secondary"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-text-secondary">Loading tokens...</div>
              ) : filteredTokens.length === 0 ? (
                <div className="p-8 text-center text-text-secondary">
                  <div>No tokens found.</div>
                  <div className="text-sm mt-2">Paste a token address below to import it.</div>
                </div>
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

            <div className="p-4 border-t border-border bg-gray-50 dark:bg-input-bg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-secondary uppercase tracking-wide">Import token by address</span>
                {isImporting && <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={importAddress}
                  onChange={(e) => setImportAddress(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 px-3 py-2 bg-white dark:bg-bg rounded-xl border border-border outline-none focus:border-primary transition-colors text-text-primary placeholder-text-secondary"
                />
                <button
                  onClick={handleImport}
                  disabled={!isAddressValid || isImporting}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isAddressValid && !isImporting
                      ? 'bg-primary text-bg hover:opacity-90 shadow-md hover:shadow-lg'
                      : 'bg-secondary text-text-secondary cursor-not-allowed'
                  }`}
                >
                  {isImporting ? 'Importing…' : 'Import'}
                </button>
              </div>
              {importAddress && !isAddressValid && (
                <div className="text-xs text-error">Enter a valid contract address</div>
              )}
              {isAddressValid && (
                <div className="bg-white dark:bg-bg rounded-2xl p-4 border border-border">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">Token preview</div>
                      <div className="font-semibold text-text-primary truncate">
                        {isPreviewLoading ? 'Fetching token...' : previewSymbol || 'Unknown symbol'}
                      </div>
                      <div className="text-sm text-text-secondary truncate">
                        {isPreviewLoading ? 'Loading details…' : previewName || 'Name unavailable'}
                      </div>
                    </div>
                    <div className="text-right text-xs text-text-secondary flex-shrink-0">
                      <div className="font-mono">{formatAddress(normalizedImportAddress)}</div>
                      {previewDecimals !== undefined && (
                        <div className="mt-1">Decimals: {previewDecimals}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {importError && (
                <div className="p-3 bg-error/20 border border-error/40 rounded-lg">
                  <div className="text-sm text-error font-semibold">{importError}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

