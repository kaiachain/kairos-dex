'use client';

import { usePoolDetails } from '@/hooks/usePoolDetails';
import { formatCurrency, formatNumber, formatAddress } from '@/lib/utils';
import { useAccount } from 'wagmi';
import { showToast } from '@/lib/showToast';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PoolDetailsProps {
  poolAddress: string;
}

export function PoolDetails({ poolAddress }: PoolDetailsProps) {
  const { pool, isLoading } = usePoolDetails(poolAddress);
  const { isConnected } = useAccount();
  const router = useRouter();

  const handleAddLiquidityClick = () => {
    if (!isConnected) {
      showToast({
        type: 'warning',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first to add liquidity',
      });
    } else if (pool) {
      // Navigate to add-liquidity page with pool info as query parameters
      const params = new URLSearchParams({
        token0: pool.token0.address,
        token1: pool.token1.address,
        fee: pool.feeTier.toString(),
      });
      router.push(`/add-liquidity?${params.toString()}`);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-text-secondary">Loading pool details...</div>;
  }

  if (!pool) {
    return <div className="text-center py-12 text-text-secondary">Pool not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-text-primary">
            {pool.token0.symbol} / {pool.token1.symbol}
          </h1>
          <p className="text-text-secondary">
            {pool.feeTier}% fee tier
          </p>
          <p className="text-sm text-text-secondary font-mono mt-2">
            {formatAddress(pool.address)}
          </p>
        </div>
        <button
          onClick={handleAddLiquidityClick}
          className="flex items-center gap-2 px-4 py-2 border-2 border-border text-text-primary rounded-lg transition-all font-medium hover:bg-gray-50 dark:hover:bg-input-bg hover:border-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Add Liquidity</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
          <div className="text-sm text-text-secondary mb-1">TVL</div>
          <div className="text-2xl font-bold text-text-primary">{formatCurrency(pool.tvl)}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
          <div className="text-sm text-text-secondary mb-1">24h Volume</div>
          <div className="text-2xl font-bold text-text-primary">{formatCurrency(pool.volume24h)}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
          <div className="text-sm text-text-secondary mb-1">APR</div>
          <div className="text-2xl font-bold text-success">
            {formatNumber(pool.apr, 2)}%
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
        <h2 className="text-xl font-bold mb-4 text-text-primary">Pool Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-text-secondary mb-1">Current Price</div>
            <div className="font-semibold text-text-primary">
              1 {pool.token0.symbol} = {formatNumber(pool.currentPrice, 6)} {pool.token1.symbol}
            </div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">7d Volume</div>
            <div className="font-semibold text-text-primary">{formatCurrency(pool.volume7d)}</div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">30d Volume</div>
            <div className="font-semibold text-text-primary">{formatCurrency(pool.volume30d)}</div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">Created</div>
            <div className="font-semibold">
              {new Date(pool.createdAt * 1000).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

