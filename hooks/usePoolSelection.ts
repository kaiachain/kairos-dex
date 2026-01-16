import { useState, useMemo, useEffect } from 'react';
import { Pool } from '@/types/pool';
import { Token } from '@/types/token';
import { usePools } from '@/hooks/usePools';

interface UsePoolSelectionProps {
  initialToken0?: Token | null;
  initialToken1?: Token | null;
  initialFee?: number;
  fromPositionsPage?: boolean;
  onPoolSelect?: (pool: Pool | null) => void;
}

/**
 * Hook for managing pool selection in liquidity addition
 */
export function usePoolSelection({
  initialToken0,
  initialToken1,
  initialFee,
  fromPositionsPage = false,
  onPoolSelect,
}: UsePoolSelectionProps) {
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [poolSearchQuery, setPoolSearchQuery] = useState('');
  const { pools, isLoading: isLoadingPools } = usePools();

  // Filter pools based on search query
  const filteredPools = useMemo(() => {
    if (!poolSearchQuery) return pools;
    const query = poolSearchQuery.toLowerCase();
    return pools.filter(
      (pool) =>
        pool.token0.symbol.toLowerCase().includes(query) ||
        pool.token1.symbol.toLowerCase().includes(query) ||
        pool.token0.name.toLowerCase().includes(query) ||
        pool.token1.name.toLowerCase().includes(query) ||
        pool.address.toLowerCase().includes(query)
    );
  }, [pools, poolSearchQuery]);

  // Determine if we should show pool selector
  const showPoolSelector = fromPositionsPage && !selectedPool && !initialToken0 && !initialToken1;

  // Auto-populate tokens and fee when pool is selected
  useEffect(() => {
    if (selectedPool && onPoolSelect) {
      onPoolSelect(selectedPool);
    }
  }, [selectedPool, onPoolSelect]);

  return {
    selectedPool,
    setSelectedPool,
    poolSearchQuery,
    setPoolSearchQuery,
    filteredPools,
    isLoadingPools,
    showPoolSelector,
  };
}
