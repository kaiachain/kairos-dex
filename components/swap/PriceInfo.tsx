'use client';

import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { formatNumber } from '@/lib/utils';
import { Info } from 'lucide-react';

interface PriceInfoProps {
  quote: SwapQuote;
  tokenIn: Token;
  tokenOut: Token;
  slippage: number;
}

export function PriceInfo({ quote, tokenIn, tokenOut, slippage }: PriceInfoProps) {
  const priceImpact = quote.priceImpact || 0;
  const minAmountOut = quote.amountOut
    ? (parseFloat(quote.amountOut) * (1 - slippage / 100)).toFixed(6)
    : '0';

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-600 dark:text-gray-400">Price</span>
        <span className="font-medium">
          1 {tokenIn.symbol} = {formatNumber(quote.price || 0, 6)} {tokenOut.symbol}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-gray-600 dark:text-gray-400">Price Impact</span>
        <span
          className={`font-medium ${
            priceImpact > 3
              ? 'text-red-600 dark:text-red-400'
              : priceImpact > 1
              ? 'text-yellow-600 dark:text-yellow-400'
              : ''
          }`}
        >
          {formatNumber(priceImpact, 2)}%
        </span>
      </div>

      {priceImpact > 3 && (
        <div className="flex items-start space-x-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-yellow-800 dark:text-yellow-200">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="text-xs">
            High price impact! This trade will result in significant price movement.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-gray-600 dark:text-gray-400">Minimum received</span>
        <span className="font-medium">
          {minAmountOut} {tokenOut.symbol}
        </span>
      </div>

      {quote.gasEstimate && (
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Estimated Gas</span>
          <span className="font-medium">{quote.gasEstimate}</span>
        </div>
      )}
    </div>
  );
}

