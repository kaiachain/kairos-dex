'use client';

import { useState, useEffect } from 'react';
import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { formatNumber, formatBalance } from '@/lib/utils';
import { Info, AlertTriangle } from 'lucide-react';
import { calculatePriceImpact, calculateSuggestedSlippage, calculateOptimalSwapSize } from '@/lib/swap-utils';
import { usePoolDetails } from '@/hooks/usePoolDetails';
import { RouteDisplay } from './RouteDisplay';

interface PriceInfoProps {
  quote: SwapQuote;
  tokenIn: Token;
  tokenOut: Token;
  slippage: number;
  amountIn: string;
}

export function PriceInfo({ quote, tokenIn, tokenOut, slippage, amountIn }: PriceInfoProps) {
  const [priceImpact, setPriceImpact] = useState<number>(quote.priceImpact || 0);
  const [optimalSwapSize, setOptimalSwapSize] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const { pool } = usePoolDetails(quote.poolAddress || '');

  useEffect(() => {
    const calculateImpact = async () => {
      if (!quote.poolAddress || !amountIn || !quote.amountOut || parseFloat(amountIn) <= 0) {
        return;
      }

      setIsCalculating(true);
      try {
        const impact = await calculatePriceImpact(
          amountIn,
          quote.amountOut,
          tokenIn,
          tokenOut,
          quote.poolAddress,
          quote.fee
        );
        setPriceImpact(impact);

        // Calculate optimal swap size
        const optimal = await calculateOptimalSwapSize(
          quote.poolAddress,
          tokenIn,
          tokenOut,
          quote.fee
        );
        setOptimalSwapSize(optimal);
      } catch (error) {
        console.error('Error calculating price impact:', error);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateImpact();
  }, [amountIn, quote.amountOut, quote.poolAddress, quote.fee, tokenIn, tokenOut]);

  const minAmountOut = quote.amountOut
    ? (() => {
        const amount = parseFloat(quote.amountOut) * (1 - slippage / 100);
        // Use scientific notation for very small numbers
        return amount < 0.000001 && amount > 0
          ? amount.toExponential(4)
          : amount.toFixed(6);
      })()
    : '0';

  const suggestedSlippage = priceImpact > 0 ? calculateSuggestedSlippage(priceImpact) : slippage;
  const slippageInsufficient = priceImpact > slippage * 0.8; // Warn if price impact is >80% of slippage

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3 text-sm border border-gray-700">
      {/* Route Display */}
      {quote.route && quote.route.length > 0 && (
        <RouteDisplay
          route={quote.route}
          tokenIn={tokenIn}
          tokenOut={tokenOut}
        />
      )}

      <div className="flex items-center justify-between">
        <span className="text-gray-400">Price</span>
        <span className="font-medium">
          1 {tokenIn.symbol} ={' '}
          {quote.price && quote.price > 0
            ? quote.price < 0.000001
              ? quote.price.toExponential(4)
              : formatNumber(quote.price, 6)
            : '0.000000'}{' '}
          {tokenOut.symbol}
        </span>
      </div>

      {/* Pool Liquidity */}
      {pool && (
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Pool Liquidity</span>
          <span className="font-medium text-white">
            {pool.tvl > 0 
              ? `$${formatBalance(pool.tvl, 2)}`
              : 'Low'}
          </span>
        </div>
      )}

      {/* Price Impact */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400">Price Impact</span>
        <span
          className={`font-medium ${
            priceImpact > 5
              ? 'text-red-400'
              : priceImpact > 3
              ? 'text-yellow-400'
              : 'text-white'
          }`}
        >
          {isCalculating ? '...' : formatNumber(priceImpact, 2)}%
        </span>
      </div>

      {/* Warnings */}
      {priceImpact > 5 && (
        <div className="flex items-start space-x-2 p-2 bg-red-900/20 rounded text-red-400 border border-red-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="text-xs space-y-1">
            <div className="font-semibold">Very High Price Impact!</div>
            <div>This trade will result in significant price movement. Consider using a smaller amount.</div>
            {suggestedSlippage > slippage && (
              <div>Recommended slippage: {suggestedSlippage.toFixed(1)}%</div>
            )}
          </div>
        </div>
      )}

      {priceImpact > 3 && priceImpact <= 5 && (
        <div className="flex items-start space-x-2 p-2 bg-yellow-900/20 rounded text-yellow-400 border border-yellow-800">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="text-xs">
            High price impact! This trade will result in significant price movement.
          </span>
        </div>
      )}

      {slippageInsufficient && priceImpact > 0 && (
        <div className="flex items-start space-x-2 p-2 bg-orange-900/20 rounded text-orange-400 border border-orange-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="text-xs space-y-1">
            <div className="font-semibold">Slippage may be insufficient</div>
            <div>
              Price impact ({priceImpact.toFixed(2)}%) is close to your slippage tolerance ({slippage}%).
            </div>
            {suggestedSlippage > slippage && (
              <div>Consider increasing slippage to {suggestedSlippage.toFixed(1)}%</div>
            )}
          </div>
        </div>
      )}

      {/* Optimal Swap Size Suggestion */}
      {optimalSwapSize && parseFloat(amountIn) > parseFloat(optimalSwapSize) * 1.2 && (
        <div className="flex items-start space-x-2 p-2 bg-blue-900/20 rounded text-blue-400 border border-blue-800">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <div className="font-semibold">Swap size suggestion</div>
            <div>
              For better price execution, consider swapping {optimalSwapSize} {tokenIn.symbol} or less.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-gray-400">Minimum received</span>
        <span className="font-medium text-white">
          {minAmountOut} {tokenOut.symbol}
        </span>
      </div>

      {quote.gasEstimate && (
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Estimated Gas</span>
          <span className="font-medium text-white">{quote.gasEstimate}</span>
        </div>
      )}
    </div>
  );
}

