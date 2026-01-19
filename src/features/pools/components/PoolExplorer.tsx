
import { useState, useMemo, useCallback, useEffect } from 'react';
import { usePools } from '@/features/pools/hooks/usePools';
import { PoolCard } from './PoolCard';
import { Search, Filter } from 'lucide-react';
import { Pool } from '@/types/pool';

// Simple pagination component for large lists
function VirtualizedPoolGrid({ pools }: { pools: Pool[] }) {
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;
  const totalPages = Math.ceil(pools.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const visiblePools = pools.slice(startIndex, endIndex);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visiblePools.map((pool) => (
          <PoolCard key={pool.address} pool={pool} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-input-bg"
          >
            Previous
          </button>
          <span className="text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-input-bg"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// Simple debounce hook for search input
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function PoolExplorer() {
  const { pools, isLoading } = usePools();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'tvl' | 'volume' | 'apr'>('tvl');

  // Debounce search query to avoid filtering on every keystroke
  const debouncedSearchQuery = useDebounceValue(searchQuery, 300);

  // Memoize filtered pools
  const filteredPools = useMemo(() => {
    if (!debouncedSearchQuery) return pools;
    const query = debouncedSearchQuery.toLowerCase();
    return pools.filter((pool) => {
      return (
        pool.token0.symbol.toLowerCase().includes(query) ||
        pool.token1.symbol.toLowerCase().includes(query) ||
        pool.address.toLowerCase().includes(query)
      );
    });
  }, [pools, debouncedSearchQuery]);

  // Memoize sorted pools
  const sortedPools = useMemo(() => {
    return [...filteredPools].sort((a, b) => {
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
  }, [filteredPools, sortBy]);

  // Memoize handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as 'tvl' | 'volume' | 'apr');
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search pools by token name or address"
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-input-bg rounded-lg border border-border outline-none focus:border-primary text-text-primary"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-text-secondary" />
          <select
            value={sortBy}
            onChange={handleSortChange}
            className="px-4 py-2 bg-gray-50 dark:bg-input-bg rounded-lg border border-border outline-none focus:border-primary text-text-primary"
          >
            <option value="tvl">Sort by TVL</option>
            <option value="volume">Sort by Volume</option>
            <option value="apr">Sort by APR</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">Loading pools...</div>
      ) : sortedPools.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">No pools found</div>
      ) : sortedPools.length > 50 ? (
        // For large lists, use pagination instead of rendering all at once
        // For 1000+ items, consider installing @tanstack/react-virtual for true virtualization
        <VirtualizedPoolGrid pools={sortedPools} />
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

