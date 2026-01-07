'use client';

import { Token } from '@/types/token';

interface PriceRangeSelectorProps {
  token0: Token | null;
  token1: Token | null;
  priceRange: { min: string; max: string };
  onPriceRangeChange: (range: { min: string; max: string }) => void;
  fullRange: boolean;
  onFullRangeChange: (fullRange: boolean) => void;
  calculatedPriceRange?: { min: number | null; max: number | null };
  currentTick?: number | null;
  isFirstLiquidity?: boolean;
}

export function PriceRangeSelector({
  token0,
  token1,
  priceRange,
  onPriceRangeChange,
  fullRange,
  onFullRangeChange,
  calculatedPriceRange,
  currentTick,
  isFirstLiquidity = false,
}: PriceRangeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">Price Range</label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={fullRange}
            onChange={(e) => onFullRangeChange(e.target.checked)}
            disabled={isFirstLiquidity}
            className="rounded disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className={`text-sm ${isFirstLiquidity ? 'text-gray-400' : ''}`}>
            Full Range
          </span>
          {isFirstLiquidity && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2" title="Full range is not supported for first liquidity addition">
              (Disabled)
            </span>
          )}
        </label>
      </div>

      {isFirstLiquidity && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-yellow-700 dark:text-yellow-300 text-xs">
            <strong>Note:</strong> Full range positions are not supported for the first liquidity addition. Please use a custom price range instead.
          </p>
        </div>
      )}

      {!fullRange && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Min Price</label>
            <input
              type="text"
              value={priceRange.min}
              onChange={(e) =>
                onPriceRangeChange({ ...priceRange, min: e.target.value })
              }
              placeholder="0.0"
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max Price</label>
            <input
              type="text"
              value={priceRange.max}
              onChange={(e) =>
                onPriceRangeChange({ ...priceRange, max: e.target.value })
              }
              placeholder="0.0"
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none text-sm"
            />
          </div>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm">
        <div className="flex justify-between mb-2">
          <span className="text-gray-600 dark:text-gray-400">Current Price</span>
          <span className="font-semibold">
            {token0 && token1 ? `1 ${token0.symbol} = 1.0 ${token1.symbol}` : '-'}
          </span>
        </div>
        {!fullRange && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Entered Range</span>
              <span className="font-semibold">
                {priceRange.min || '0'} - {priceRange.max || '∞'} {token1?.symbol} per {token0?.symbol}
              </span>
            </div>
            {calculatedPriceRange && calculatedPriceRange.min !== null && calculatedPriceRange.max !== null && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Calculated Range</span>
                <span className="font-semibold text-primary-600 dark:text-primary-400">
                  {calculatedPriceRange.min.toFixed(4)} - {calculatedPriceRange.max.toFixed(4)} {token1?.symbol} per {token0?.symbol}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

