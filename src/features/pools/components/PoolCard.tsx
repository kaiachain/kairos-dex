import React from 'react';
import { Link } from 'react-router-dom';
import { Pool } from '@/types/pool';
import { formatCurrency, formatNumber, formatAddress } from '@/lib/utils';

interface PoolCardProps {
  pool: Pool;
}

function PoolCardComponent({ pool }: PoolCardProps) {
  return (
    <Link to={`/pools/${pool.address}`}>
      <div className="bg-white dark:bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-bg rounded-full flex items-center justify-center text-text-primary">
              {pool.token0.symbol[0]}
            </div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-bg rounded-full flex items-center justify-center -ml-2 text-text-primary">
              {pool.token1.symbol[0]}
            </div>
            <div>
              <div className="font-semibold text-text-primary">
                {pool.token0.symbol} / {pool.token1.symbol}
              </div>
              <div className="text-xs text-text-secondary">{pool.feeTier}%</div>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">TVL</span>
            <span className="font-semibold text-text-primary">{formatCurrency(pool.tvl)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Volume 24h</span>
            <span className="font-semibold text-text-primary">{formatCurrency(pool.volume24h)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">APR</span>
            <span className="font-semibold text-success">{formatNumber(pool.apr, 2)}%</span>
          </div>
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-text-secondary font-mono">
              {formatAddress(pool.address)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Memoize component to prevent unnecessary re-renders
export const PoolCard = React.memo(PoolCardComponent);
