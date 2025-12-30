'use client';

import { usePoolDetails } from '@/hooks/usePoolDetails';
import { formatCurrency, formatNumber, formatAddress } from '@/lib/utils';
import { AddLiquidity } from '@/components/liquidity/AddLiquidity';
import { useState } from 'react';

interface PoolDetailsProps {
  poolAddress: string;
}

export function PoolDetails({ poolAddress }: PoolDetailsProps) {
  const { pool, isLoading } = usePoolDetails(poolAddress);
  const [showAddLiquidity, setShowAddLiquidity] = useState(false);

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading pool details...</div>;
  }

  if (!pool) {
    return <div className="text-center py-12 text-gray-500">Pool not found</div>;
  }

  if (showAddLiquidity) {
    return (
      <div>
        <button
          onClick={() => setShowAddLiquidity(false)}
          className="mb-4 text-primary-600 dark:text-primary-400 hover:underline"
        >
          ← Back to Pool
        </button>
        <AddLiquidity />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {pool.token0.symbol} / {pool.token1.symbol}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {pool.feeTier}% fee tier
          </p>
          <p className="text-sm text-gray-500 font-mono mt-2">
            {formatAddress(pool.address)}
          </p>
        </div>
        <button
          onClick={() => setShowAddLiquidity(true)}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add Liquidity
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">TVL</div>
          <div className="text-2xl font-bold">{formatCurrency(pool.tvl)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">24h Volume</div>
          <div className="text-2xl font-bold">{formatCurrency(pool.volume24h)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">APR</div>
          <div className="text-2xl font-bold text-green-600">
            {formatNumber(pool.apr, 2)}%
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4">Pool Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">Current Price</div>
            <div className="font-semibold">
              1 {pool.token0.symbol} = {formatNumber(pool.currentPrice, 6)} {pool.token1.symbol}
            </div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">7d Volume</div>
            <div className="font-semibold">{formatCurrency(pool.volume7d)}</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">30d Volume</div>
            <div className="font-semibold">{formatCurrency(pool.volume30d)}</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">Created</div>
            <div className="font-semibold">
              {new Date(pool.createdAt * 1000).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

