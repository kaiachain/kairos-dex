'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { TokenSelector } from './TokenSelector';
import { SwapButton } from './SwapButton';
import { SwapSettings } from './SwapSettings';
import { PriceInfo } from './PriceInfo';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { Token } from '@/types/token';
import { useSwapQuote } from '@/hooks/useSwapQuote';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { formatBalance } from '@/lib/utils';

export function SwapInterface() {
  const { isConnected } = useAccount();
  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [deadline, setDeadline] = useState(20);
  const [expertMode, setExpertMode] = useState(false);

  const { data: balanceIn, refetch: refetchBalanceIn } = useTokenBalance(tokenIn);
  const { data: balanceOut, refetch: refetchBalanceOut } = useTokenBalance(tokenOut);
  const { data: quote, isLoading: isQuoteLoading } = useSwapQuote(
    tokenIn,
    tokenOut,
    amountIn
  );

  const handleReverse = () => {
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
    if (quote?.amountOut) {
      setAmountIn(quote.amountOut);
    }
  };

  const handleMax = () => {
    if (balanceIn) {
      setAmountIn(balanceIn);
    }
  };

  const handleSwapSuccess = () => {
    // Reset input amount
    setAmountIn('');
    
    // Refetch balances for both tokens to show updated amounts
    if (refetchBalanceIn) {
      refetchBalanceIn();
    }
    if (refetchBalanceOut) {
      refetchBalanceOut();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Swap</h2>
        <SwapSettings
          slippage={slippage}
          deadline={deadline}
          expertMode={expertMode}
          onSlippageChange={setSlippage}
          onDeadlineChange={setDeadline}
          onExpertModeChange={setExpertMode}
        />
      </div>

      <div className="space-y-4">
        {/* Token In */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">From</label>
            {balanceIn && (
              <button
                onClick={handleMax}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Balance: {formatBalance(balanceIn, 2)}
              </button>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                placeholder="0.0"
                className="w-full text-2xl font-semibold bg-transparent border-none outline-none"
                disabled={!tokenIn}
              />
            </div>
            <TokenSelector
              selectedToken={tokenIn}
              onTokenSelect={setTokenIn}
              excludeToken={tokenOut}
            />
          </div>
        </div>

        {/* Reverse Button */}
        <div className="flex justify-center -my-2">
          <button
            onClick={handleReverse}
            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowDownUp className="w-5 h-5" />
          </button>
        </div>

        {/* Token Out */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">To</label>
            {isQuoteLoading ? (
              <span className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fetching quote...
              </span>
            ) : quote?.amountOut ? (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                ≈ {quote.amountOut}
              </span>
            ) : null}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              {isQuoteLoading && tokenIn && tokenOut && amountIn && parseFloat(amountIn) > 0 ? (
                <div className="flex items-center justify-center h-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600 dark:text-primary-400" />
                </div>
              ) : (
                <input
                  type="text"
                  value={isQuoteLoading ? '' : (quote?.amountOut || '')}
                  placeholder="0.0"
                  readOnly
                  className="w-full text-2xl font-semibold bg-transparent border-none outline-none text-gray-400"
                />
              )}
            </div>
            <TokenSelector
              selectedToken={tokenOut}
              onTokenSelect={setTokenOut}
              excludeToken={tokenIn}
            />
          </div>
        </div>

        {/* Price Info */}
        {!isQuoteLoading && quote && tokenIn && tokenOut && (
          <PriceInfo
            quote={quote}
            tokenIn={tokenIn}
            tokenOut={tokenOut}
            slippage={slippage}
            amountIn={amountIn}
          />
        )}

        {/* Swap Button */}
        <SwapButton
          tokenIn={tokenIn}
          tokenOut={tokenOut}
          amountIn={amountIn}
          amountOut={quote?.amountOut || ''}
          slippage={slippage}
          deadline={deadline}
          quote={quote}
          isQuoteLoading={isQuoteLoading}
          onSwapSuccess={handleSwapSuccess}
        />
      </div>
    </div>
  );
}

