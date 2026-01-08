'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { TokenSelector } from './TokenSelector';
import { SwapButton } from './SwapButton';
import { SwapSettings } from './SwapSettings';
import { PriceInfo } from './PriceInfo';
import { SwapConfirmation } from './SwapConfirmation';
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
  const { data: quote, isLoading: isQuoteLoading, error: quoteError } = useSwapQuote(
    tokenIn,
    tokenOut,
    amountIn
  );

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [swapHash, setSwapHash] = useState<string | null>(null);

  const handleReverse = useCallback(() => {
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
    if (quote?.amountOut) {
      setAmountIn(quote.amountOut);
    }
  }, [tokenIn, tokenOut, quote]);

  const handleMax = useCallback(() => {
    if (balanceIn) {
      setAmountIn(balanceIn);
    }
  }, [balanceIn]);

  const handleSwapSuccess = useCallback((hash: string) => {
    setSwapHash(hash);
    setAmountIn('');
    refetchBalanceIn?.();
    refetchBalanceOut?.();
    // Show confirmation after a brief delay
    setTimeout(() => {
      setShowConfirmation(true);
    }, 500);
  }, [refetchBalanceIn, refetchBalanceOut]);

  const handleAmountChange = useCallback((value: string) => {
    // Only allow valid number input
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmountIn(value);
    }
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
        {/* Token In Input */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">From</label>
            {balanceIn && isConnected && (
              <button
                onClick={handleMax}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                Balance: {formatBalance(balanceIn, 4)}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                inputMode="decimal"
                value={amountIn}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.0"
                className="w-full text-2xl font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
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
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleReverse}
            className="p-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
            aria-label="Reverse tokens"
          >
            <ArrowDownUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Token Out Input */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">To</label>
            {isQuoteLoading ? (
              <span className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fetching quote...
              </span>
            ) : quote?.amountOut ? (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                ≈ {formatBalance(quote.amountOut, 6)}
              </span>
            ) : quoteError ? (
              <span className="text-xs text-red-600 dark:text-red-400">
                Quote error
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              {isQuoteLoading && tokenIn && tokenOut && amountIn && parseFloat(amountIn) > 0 ? (
                <div className="flex items-center justify-center h-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600 dark:text-primary-400" />
                </div>
              ) : (
                <input
                  type="text"
                  value={quote?.amountOut || ''}
                  placeholder="0.0"
                  readOnly
                  className="w-full text-2xl font-semibold bg-transparent border-none outline-none text-gray-400 dark:text-gray-500"
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
        {!isQuoteLoading && quote && tokenIn && tokenOut && amountIn && parseFloat(amountIn) > 0 && (
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

      {/* Swap Confirmation Modal */}
      {showConfirmation && swapHash && tokenIn && tokenOut && quote && (
        <SwapConfirmation
          tokenIn={tokenIn}
          tokenOut={tokenOut}
          amountIn={amountIn}
          amountOut={quote.amountOut}
          transactionHash={swapHash}
          onClose={() => {
            setShowConfirmation(false);
            setSwapHash(null);
          }}
        />
      )}
    </div>
  );
}
