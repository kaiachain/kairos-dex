
import { Token } from '@/types/token';
import { calculatePriceFromTick } from '@/lib/subgraph-utils';
import { useMemo } from 'react';

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
  // Calculate current price from tick
  const currentPrice = useMemo(() => {
    if (!token0 || !token1 || currentTick === null || currentTick === undefined) {
      return null;
    }

    // Sort tokens by address (same as Uniswap V3 does internally)
    const sortedToken0 = token0.address.toLowerCase() < token1.address.toLowerCase() ? token0 : token1;
    const sortedToken1 = token0.address.toLowerCase() < token1.address.toLowerCase() ? token1 : token0;

    // Calculate price using sorted tokens
    const price = calculatePriceFromTick(currentTick, sortedToken0.decimals, sortedToken1.decimals);

    // Handle edge cases (very large prices from calculatePriceFromTick)
    if (!isFinite(price) || price <= 0 || price > 1e30) {
      return null;
    }

    // Determine if we need to invert the price for display
    // If token0 is not the sorted token0, we need to invert
    const needsInversion = token0.address.toLowerCase() !== sortedToken0.address.toLowerCase();
    
    const displayPrice = needsInversion ? 1 / price : price;
    
    // Final check for valid display price
    if (!isFinite(displayPrice) || displayPrice <= 0) {
      return null;
    }
    
    return displayPrice;
  }, [token0, token1, currentTick]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-text-primary">Price Range</label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={fullRange}
            onChange={(e) => onFullRangeChange(e.target.checked)}
            disabled={isFirstLiquidity}
            className="rounded disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className={`text-sm ${isFirstLiquidity ? 'text-text-secondary' : 'text-text-primary'}`}>
            Full Range
          </span>
          {isFirstLiquidity && (
            <span className="text-xs text-secondary ml-2" title="Full range is not supported for first liquidity addition">
              (Disabled)
            </span>
          )}
        </label>
      </div>

      {isFirstLiquidity && (
        <div className="bg-secondary/20 border border-secondary/40 rounded-lg p-3">
          <p className="text-secondary text-xs">
            <strong>Note:</strong> Full range positions are not supported for the first liquidity addition. Please use a custom price range instead.
          </p>
        </div>
      )}

      {!fullRange && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Min Price</label>
            <input
              type="text"
              value={priceRange.min}
              onChange={(e) =>
                onPriceRangeChange({ ...priceRange, min: e.target.value })
              }
              placeholder="0.0"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-input-bg rounded-lg border border-border outline-none focus:border-primary text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Max Price</label>
            <input
              type="text"
              value={priceRange.max}
              onChange={(e) =>
                onPriceRangeChange({ ...priceRange, max: e.target.value })
              }
              placeholder="0.0"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-input-bg rounded-lg border border-border outline-none focus:border-primary text-sm text-text-primary"
            />
          </div>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-input-bg rounded-lg p-4 text-sm border border-border">
        <div className="flex justify-between mb-2">
          <span className="text-text-secondary">Current Price</span>
          <span className="font-semibold text-text-primary">
            {token0 && token1 && currentPrice !== null
              ? `1 ${token0.symbol} = ${currentPrice.toFixed(6)} ${token1.symbol}`
              : '-'}
          </span>
        </div>
        {!fullRange && (
          <>
            <div className="flex justify-between">
              <span className="text-text-secondary">Entered Range</span>
              <span className="font-semibold text-text-primary">
                {priceRange.min || '0'} - {priceRange.max || '∞'} {token1?.symbol} per {token0?.symbol}
              </span>
            </div>
            {calculatedPriceRange && calculatedPriceRange.min !== null && calculatedPriceRange.max !== null && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Calculated Range</span>
                <span className="font-semibold text-primary">
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

