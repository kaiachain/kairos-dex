'use client';

import Link from 'next/link';
import { Pool } from '@/types/pool';
import { formatCurrency, formatNumber, formatAddress } from '@/lib/utils';

interface PoolCardProps {
  pool: Pool;
}

export function PoolCard({ pool }: PoolCardProps) {
  return (
    <Link href={`/pools/${pool.address}`}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
              {pool.token0.symbol[0]}
            </div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center -ml-2">
              {pool.token1.symbol[0]}
            </div>
            <div>
              <div className="font-semibold">
                {pool.token0.symbol} / {pool.token1.symbol}
              </div>
              <div className="text-xs text-gray-500">{pool.feeTier}%</div>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">TVL</span>
            <span className="font-semibold">{formatCurrency(pool.tvl)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Volume 24h</span>
            <span className="font-semibold">{formatCurrency(pool.volume24h)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">APR</span>
            <span className="font-semibold text-green-600">{formatNumber(pool.apr, 2)}%</span>
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 font-mono">
              {formatAddress(pool.address)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

