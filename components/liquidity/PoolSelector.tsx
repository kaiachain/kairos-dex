
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Pool } from '@/types/pool';
import { formatAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PoolSelectorProps {
  pools: Pool[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (pool: Pool) => void;
  onClose: () => void;
}

export function PoolSelector({
  pools,
  isLoading,
  searchQuery,
  onSearchChange,
  onSelect,
  onClose,
}: PoolSelectorProps) {
  return (
    <div className="mb-6 p-4 bg-gray-50 dark:bg-input-bg rounded-2xl border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Select Pool</h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-bg rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search pools by token symbol or address"
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-bg rounded-xl border border-border outline-none focus:border-primary transition-colors text-text-primary placeholder-text-secondary"
        />
      </div>
      <div className="max-h-64 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-text-secondary">Loading pools...</div>
        ) : pools.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">No pools found</div>
        ) : (
          pools.map((pool) => (
            <button
              key={pool.address}
              onClick={() => onSelect(pool)}
              className={cn(
                'w-full p-4 text-left bg-white dark:bg-bg rounded-xl border border-border hover:border-primary transition-colors',
                'hover:shadow-md'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-text-primary">
                    {pool.token0.symbol} / {pool.token1.symbol}
                  </div>
                  <div className="text-sm text-text-secondary mt-1">
                    Fee: {pool.feeTier}% • {formatAddress(pool.address)}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
