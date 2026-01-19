
import { useEffect, useMemo, useCallback } from 'react';
import { lazy, Suspense } from 'react';
import { useAccount } from 'wagmi';
import { TokenSelector } from './TokenSelector';
import { SwapButton } from './SwapButton';
import { SwapSettings } from './SwapSettings';
import { PriceInfo } from './PriceInfo';
import { TerminalStatus } from './TerminalStatus';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { useSwapQuote } from '@/hooks/useSwapQuote';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useSwapStatus } from '@/contexts/SwapStatusContext';
import { useSwapForm } from '@/hooks/useSwapForm';
import { useSwapConfirmation } from '@/hooks/useSwapConfirmation';
import { formatBalance } from '@/lib/utils';

// Dynamically import SwapConfirmation to reduce initial bundle size
const SwapConfirmation = lazy(
  () => import('./SwapConfirmation').then((mod) => ({ default: mod.SwapConfirmation }))
);

export function SwapInterface() {
  const { isConnected } = useAccount();
  const {
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    deadline,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    setSlippage,
    setDeadline,
    handleAmountChange,
    handleReverse,
    handleMax,
  } = useSwapForm();

  const { data: balanceIn, refetch: refetchBalanceIn } = useTokenBalance(tokenIn);
  const { data: balanceOut, refetch: refetchBalanceOut } = useTokenBalance(tokenOut);
  const { data: quote, isLoading: isQuoteLoading, error: quoteError, getCachedRoute } = useSwapQuote(
    tokenIn,
    tokenOut,
    amountIn
  );
  const { messages: statusMessages, clearMessages } = useSwapStatus();

  const {
    showConfirmation,
    swapHash,
    swapDetails,
    handleSwapSuccess,
    resetConfirmation,
    closeConfirmation,
  } = useSwapConfirmation();

  // Memoize handlers to prevent unnecessary re-renders
  const handleReverseWithQuote = useCallback(() => {
    handleReverse();
    if (quote?.amountOut) {
      setAmountIn(quote.amountOut);
    }
  }, [handleReverse, quote?.amountOut, setAmountIn]);

  const handleMaxWithBalance = useCallback(() => {
    if (balanceIn) {
      handleMax(balanceIn);
    }
  }, [balanceIn, handleMax]);

  const onSwapSuccess = useCallback((hash: string) => {
    handleSwapSuccess(hash, tokenIn, tokenOut, amountIn, quote?.amountOut);
    clearMessages();
    setAmountIn('');
    refetchBalanceIn?.();
    refetchBalanceOut?.();
  }, [handleSwapSuccess, tokenIn, tokenOut, amountIn, quote?.amountOut, clearMessages, setAmountIn, refetchBalanceIn, refetchBalanceOut]);

  // Memoize formatted balance display
  const formattedBalanceIn = useMemo(() => {
    return balanceIn ? formatBalance(balanceIn, 4) : '';
  }, [balanceIn]);

  // Memoize formatted quote amount
  const formattedAmountOut = useMemo(() => {
    return quote?.amountOut ? formatBalance(quote.amountOut, 6) : '';
  }, [quote?.amountOut]);

  // Memoize condition for showing price info
  const showPriceInfo = useMemo(() => {
    return !isQuoteLoading && quote && tokenIn && tokenOut && amountIn && parseFloat(amountIn) > 0;
  }, [isQuoteLoading, quote, tokenIn, tokenOut, amountIn]);

  // Memoize condition for showing terminal status
  const showTerminalStatus = useMemo(() => {
    return isQuoteLoading || statusMessages.length > 0;
  }, [isQuoteLoading, statusMessages.length]);

  // Reset confirmation when form changes
  useEffect(() => {
    resetConfirmation(tokenIn, tokenOut, amountIn);
    if (tokenIn || tokenOut || amountIn) {
      clearMessages();
    }
  }, [tokenIn, tokenOut, amountIn, resetConfirmation, clearMessages]);

  return (
    <div className="bg-white dark:bg-card rounded-3xl shadow-lg p-6 border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-text-primary">Swap</h2>
        <SwapSettings
          slippage={slippage}
          deadline={deadline}
          onSlippageChange={setSlippage}
          onDeadlineChange={setDeadline}
        />
      </div>

      <div className="space-y-3">
        {/* Token In Input */}
        <div className="bg-gray-50 dark:bg-input-bg rounded-2xl p-4 border border-border hover:border-[color:var(--border-hover)] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">You pay</label>
            {balanceIn && isConnected && (
              <button
                onClick={handleMaxWithBalance}
                className="text-xs text-primary hover:opacity-80 font-medium transition-colors"
              >
                Balance: {formattedBalanceIn}
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
                placeholder="0"
                className="w-full text-3xl font-semibold bg-transparent border-none outline-none text-text-primary placeholder-text-secondary"
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
        <div className="flex justify-center -my-1 relative z-10">
          <button
            onClick={handleReverseWithQuote}
            className="p-2.5 bg-white dark:bg-card border-2 border-border rounded-full hover:bg-gray-50 dark:hover:bg-bg transition-all shadow-md hover:shadow-lg hover:border-[color:var(--border-hover)]"
            aria-label="Reverse tokens"
          >
            <ArrowDownUp className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Token Out Input */}
        <div className="bg-gray-50 dark:bg-input-bg rounded-2xl p-4 border border-border hover:border-[color:var(--border-hover)] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">You receive</label>
            {isQuoteLoading ? (
              <span className="text-xs text-text-secondary flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fetching quote...
              </span>
            ) : quote?.amountOut ? (
              <span className="text-xs text-text-secondary font-medium">
                ≈ {formattedAmountOut}
              </span>
            ) : quoteError ? (
              <span className="text-xs text-error">
                Quote error
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              {isQuoteLoading && tokenIn && tokenOut && amountIn && parseFloat(amountIn) > 0 ? (
                <div className="flex items-center justify-center h-14">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <input
                  type="text"
                  value={quote?.amountOut || ''}
                  placeholder="0"
                  readOnly
                  className="w-full text-3xl font-semibold bg-transparent border-none outline-none text-text-secondary placeholder-text-secondary"
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
        {showPriceInfo && quote && tokenIn && tokenOut && (
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
          cachedRoute={getCachedRoute?.()}
          onSwapSuccess={onSwapSuccess}
        />

        {/* Terminal Status - Developer View */}
        {showTerminalStatus && (
          <div className="mt-4">
            <TerminalStatus 
              messages={statusMessages} 
              isActive={showTerminalStatus}
            />
          </div>
        )}
      </div>

      {/* Swap Confirmation Modal */}
      {showConfirmation && swapHash && swapDetails && (
        <Suspense fallback={null}>
          <SwapConfirmation
          tokenIn={swapDetails.tokenIn}
          tokenOut={swapDetails.tokenOut}
          amountIn={swapDetails.amountIn}
          amountOut={swapDetails.amountOut}
          transactionHash={swapHash}
          onClose={closeConfirmation}
        />
        </Suspense>
      )}
    </div>
  );
}
