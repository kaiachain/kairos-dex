'use client';

import { useState } from 'react';
import { usePools } from '@/hooks/usePools';
import { PoolCard } from './PoolCard';
import { Search, Filter } from 'lucide-react';

export function PoolExplorer() {
  const { pools, isLoading } = usePools();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'tvl' | 'volume' | 'apr'>('tvl');

  const filteredPools = pools.filter((pool) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      pool.token0.symbol.toLowerCase().includes(query) ||
      pool.token1.symbol.toLowerCase().includes(query) ||
      pool.address.toLowerCase().includes(query)
    );
  });

  const sortedPools = [...filteredPools].sort((a, b) => {
    switch (sortBy) {
      case 'tvl':
        return b.tvl - a.tvl;
      case 'volume':
        return b.volume24h - a.volume24h;
      case 'apr':
        return b.apr - a.apr;
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pools by token name or address"
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none"
          >
            <option value="tvl">Sort by TVL</option>
            <option value="volume">Sort by Volume</option>
            <option value="apr">Sort by APR</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading pools...</div>
      ) : sortedPools.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No pools found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPools.map((pool) => (
            <PoolCard key={pool.address} pool={pool} />
          ))}
        </div>
      )}
    </div>
  );
}

