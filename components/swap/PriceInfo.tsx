
import { useState, useEffect } from 'react';
import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { formatNumber, formatBalance } from '@/lib/utils';
import { Info, AlertTriangle } from 'lucide-react';
import { calculatePriceImpact, calculateSuggestedSlippage } from '@/lib/swap-utils';
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
  const [isCalculating, setIsCalculating] = useState(false);
  const { pool } = usePoolDetails(quote.poolAddress || '');

  useEffect(() => {
    const calculateImpact = async () => {
      if (!quote.poolAddress || !amountIn || !quote.amountOut || parseFloat(amountIn) <= 0) {
        return;
      }

      setIsCalculating(true);
      try {
        if (quote.fee !== undefined && quote.poolAddress) {
          const impact = await calculatePriceImpact(
            amountIn,
            quote.amountOut,
            tokenIn,
            tokenOut,
            quote.poolAddress,
            quote.fee
          );
          setPriceImpact(impact);
        }
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
    <div className="bg-gray-50 dark:bg-input-bg rounded-xl p-4 space-y-3 text-sm border border-border">
      {/* Route Display */}
      {quote.route && quote.route.length > 0 && (
        <RouteDisplay
          route={quote.route}
          tokenIn={tokenIn}
          tokenOut={tokenOut}
        />
      )}

      <div className="flex items-center justify-between">
        <span className="text-text-secondary">Price</span>
        <span className="font-medium text-text-primary">
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
          <span className="text-text-secondary">Pool Liquidity</span>
          <span className="font-medium text-text-primary">
            {pool.tvl > 0 
              ? `$${formatBalance(pool.tvl, 2)}`
              : 'Low'}
          </span>
        </div>
      )}

      {/* Price Impact */}
      <div className="flex items-center justify-between">
        <span className="text-text-secondary">Price Impact</span>
        <span
          className={`font-medium ${
            priceImpact > 5
              ? 'text-error'
              : priceImpact > 3
              ? 'text-secondary'
              : 'text-text-primary'
          }`}
        >
          {isCalculating ? '...' : formatNumber(priceImpact, 2)}%
        </span>
      </div>

      {/* Warnings */}
      {priceImpact > 5 && (
        <div className="flex items-start space-x-2 p-2 bg-error/20 rounded text-error border border-error/40">
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
        <div className="flex items-start space-x-2 p-2 bg-secondary/20 rounded text-secondary border border-secondary/40">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="text-xs">
            High price impact! This trade will result in significant price movement.
          </span>
        </div>
      )}

      {slippageInsufficient && priceImpact > 0 && (
        <div className="flex items-start space-x-2 p-2 bg-error/20 rounded text-error border border-error/40">
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

      <div className="flex items-center justify-between">
        <span className="text-text-secondary">Minimum received</span>
        <span className="font-medium text-text-primary">
          {minAmountOut} {tokenOut.symbol}
        </span>
      </div>

      {quote.gasEstimate && (
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Estimated Gas</span>
          <span className="font-medium text-text-primary">{quote.gasEstimate}</span>
        </div>
      )}
    </div>
  );
}

