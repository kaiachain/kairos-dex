'use client';

import Link from 'next/link';
import { Position } from '@/types/position';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PositionCardProps {
  position: Position;
}

export function PositionCard({ position }: PositionCardProps) {
  const isInRange = position.currentPrice >= position.priceMin && position.currentPrice <= position.priceMax;

  return (
    <Link href={`/positions/${position.tokenId}`}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
              {position.token0.symbol[0]}
            </div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center -ml-2">
              {position.token1.symbol[0]}
            </div>
            <div>
              <div className="font-semibold">
                {position.token0.symbol} / {position.token1.symbol}
              </div>
              <div className="text-xs text-gray-500">{position.feeTier}%</div>
            </div>
          </div>
          <div
            className={`px-2 py-1 rounded text-xs font-medium ${
              isInRange
                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            {isInRange ? 'In Range' : 'Out of Range'}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Value</span>
            <span className="font-semibold">{formatCurrency(position.value)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Uncollected Fees</span>
            <span className="font-semibold text-green-600">
              {formatCurrency(position.uncollectedFees)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Price Range</span>
            <span className="font-semibold text-xs">
              {formatNumber(position.priceMin, 4)} - {formatNumber(position.priceMax, 4)}
            </span>
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500">Token ID: {position.tokenId}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

