
import { useEffect, useMemo, useCallback, useState } from 'react';
import { lazy, Suspense } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { TokenSelector } from './TokenSelector';
import { SwapButton } from './SwapButton';
import { SwapSettings } from './SwapSettings';
import { PriceInfo } from './PriceInfo';
import { TerminalStatus } from './TerminalStatus';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { useSwapQuote } from '@/features/swap/hooks/useSwapQuote';
import { useTokenBalance } from '@/shared/hooks/useTokenBalance';
import { useSwapStatus } from '@/features/swap/hooks/useSwapStatus';
import { useSwapForm } from '@/features/swap/hooks/useSwapForm';
import { useSwapConfirmation } from '@/features/swap/hooks/useSwapConfirmation';
import { formatBalance, parseUnits } from '@/lib/utils';
import { CONTRACT_WRAPPED_NATIVE_TOKEN, NATIVE_CURRENCY_SYMBOL } from '@/config/env';
import { WKAIA_ABI } from '@/abis/WKAIA';
import { Token } from '@/shared/types/token';
import { cn } from '@/lib/utils';

// Dynamically import SwapConfirmation to reduce initial bundle size
const SwapConfirmation = lazy(
  () => import('./SwapConfirmation').then((mod) => ({ default: mod.SwapConfirmation }))
);

type TabMode = 'swap' | 'wrap';

export function SwapInterface() {
  const [activeTab, setActiveTab] = useState<TabMode>('swap');
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

  // Wrap/Unwrap state and handlers
  const { address, isConnected: isWrapConnected } = useAccount();
  const [wrapAmount, setWrapAmount] = useState('');
  const [isWrapping, setIsWrapping] = useState(true);

  // Get native KAIA balance for wrap
  const { data: nativeBalance, isLoading: isLoadingNative, refetch: refetchNativeBalance } = useBalance({
    address,
    query: {
      enabled: !!address && isWrapConnected,
    },
  });

  // Get WKAIA token object
  const wkaiaToken: Token = {
    address: CONTRACT_WRAPPED_NATIVE_TOKEN || '',
    symbol: `W${NATIVE_CURRENCY_SYMBOL}`,
    name: `Wrapped ${NATIVE_CURRENCY_SYMBOL}`,
    decimals: 18,
  };

  // Get WKAIA balance
  const { data: wkaiaBalance, isLoading: isLoadingWkaia, refetch: refetchWkaiaBalance } = useTokenBalance(wkaiaToken);

  // Wrap transaction
  const { writeContract: wrap, data: wrapHash, error: wrapError } = useWriteContract();
  const { isLoading: isWrappingTx, isSuccess: isWrapSuccess } = useWaitForTransactionReceipt({
    hash: wrapHash,
  });

  // Unwrap transaction
  const { writeContract: unwrap, data: unwrapHash, error: unwrapError } = useWriteContract();
  const { isLoading: isUnwrappingTx, isSuccess: isUnwrapSuccess } = useWaitForTransactionReceipt({
    hash: unwrapHash,
  });

  const handleWrapMax = useCallback(() => {
    if (isWrapping && nativeBalance) {
      const maxAmount = parseFloat(nativeBalance.formatted) - 0.01;
      if (maxAmount > 0) {
        setWrapAmount(maxAmount.toString());
      } else {
        setWrapAmount(nativeBalance.formatted);
      }
    } else if (!isWrapping && wkaiaBalance) {
      setWrapAmount(wkaiaBalance);
    }
  }, [isWrapping, nativeBalance, wkaiaBalance]);

  const handleWrap = useCallback(async () => {
    if (!wrapAmount || parseFloat(wrapAmount) <= 0) return;
    if (!isWrapConnected || !address) return;

    try {
      const amountWei = parseUnits(wrapAmount, 18);
      wrap({
        address: CONTRACT_WRAPPED_NATIVE_TOKEN as `0x${string}`,
        abi: WKAIA_ABI,
        functionName: 'deposit',
        value: amountWei,
      });
    } catch (error) {
      console.error('Wrap error:', error);
    }
  }, [wrapAmount, isWrapConnected, address, wrap]);

  const handleUnwrap = useCallback(async () => {
    if (!wrapAmount || parseFloat(wrapAmount) <= 0) return;
    if (!isWrapConnected || !address) return;

    try {
      const amountWei = parseUnits(wrapAmount, 18);
      unwrap({
        address: CONTRACT_WRAPPED_NATIVE_TOKEN as `0x${string}`,
        abi: WKAIA_ABI,
        functionName: 'withdraw',
        args: [amountWei],
      });
    } catch (error) {
      console.error('Unwrap error:', error);
    }
  }, [wrapAmount, isWrapConnected, address, unwrap]);

  const handleWrapToggle = useCallback(() => {
    setIsWrapping(!isWrapping);
    setWrapAmount('');
  }, [isWrapping]);

  // Reset wrap amount and refetch balances on success
  useEffect(() => {
    if (isWrapSuccess || isUnwrapSuccess) {
      refetchNativeBalance();
      refetchWkaiaBalance();
      const timer = setTimeout(() => setWrapAmount(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [isWrapSuccess, isUnwrapSuccess, refetchNativeBalance, refetchWkaiaBalance]);

  const isWrapLoading = isWrappingTx || isUnwrappingTx;
  const wrapCurrentBalance = isWrapping ? nativeBalance?.formatted : wkaiaBalance;
  const isLoadingWrapBalance = isWrapping ? isLoadingNative : isLoadingWkaia;

  return (
    <div className="bg-white dark:bg-card rounded-3xl shadow-lg p-6 border border-border">
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 p-1 bg-gray-100 dark:bg-input-bg rounded-2xl">
        <button
          onClick={() => setActiveTab('swap')}
          className={cn(
            'flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
            activeTab === 'swap'
              ? 'bg-white dark:bg-card text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          )}
        >
          Swap
        </button>
        <button
          onClick={() => setActiveTab('wrap')}
          className={cn(
            'flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
            activeTab === 'wrap'
              ? 'bg-white dark:bg-card text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          )}
        >
          Wrap
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-text-primary">
          {activeTab === 'swap' ? 'Swap' : 'Wrap / Unwrap'}
        </h2>
        {activeTab === 'swap' && (
          <SwapSettings
            slippage={slippage}
            deadline={deadline}
            onSlippageChange={setSlippage}
            onDeadlineChange={setDeadline}
          />
        )}
      </div>

      {activeTab === 'swap' ? (

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
      ) : (
        /* Wrap/Unwrap Interface */
        <div className="space-y-3">
          {/* From Token */}
          <div className="bg-gray-50 dark:bg-input-bg rounded-2xl p-4 border border-border hover:border-[color:var(--border-hover)] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">You pay</label>
              {wrapCurrentBalance && isWrapConnected && (
                <button
                  onClick={handleWrapMax}
                  className="text-xs text-primary hover:opacity-80 font-medium transition-colors"
                >
                  Balance: {isLoadingWrapBalance ? '...' : formatBalance(wrapCurrentBalance, 4)}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={wrapAmount}
                  onChange={(e) => setWrapAmount(e.target.value)}
                  placeholder="0"
                  className="w-full text-3xl font-semibold bg-transparent border-none outline-none text-text-primary placeholder-text-secondary"
                  disabled={!isWrapConnected}
                />
              </div>
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-input-bg rounded-xl border border-border min-w-[120px]">
                <span className="text-lg font-semibold text-text-primary">
                  {isWrapping ? NATIVE_CURRENCY_SYMBOL : `W${NATIVE_CURRENCY_SYMBOL}`}
                </span>
              </div>
            </div>
          </div>

          {/* Reverse Button */}
          <div className="flex justify-center -my-1 relative z-10">
            <button
              onClick={handleWrapToggle}
              className="p-2.5 bg-white dark:bg-card border-2 border-border rounded-full hover:bg-gray-50 dark:hover:bg-bg transition-all shadow-md hover:shadow-lg hover:border-[color:var(--border-hover)]"
              aria-label="Reverse wrap/unwrap"
            >
              <ArrowDownUp className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* To Token */}
          <div className="bg-gray-50 dark:bg-input-bg rounded-2xl p-4 border border-border hover:border-[color:var(--border-hover)] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">You receive</label>
              {!isWrapping && nativeBalance && (
                <span className="text-xs text-text-secondary font-medium">
                  Balance: {formatBalance(nativeBalance.formatted, 4)}
                </span>
              )}
              {isWrapping && wkaiaBalance && (
                <span className="text-xs text-text-secondary font-medium">
                  Balance: {formatBalance(wkaiaBalance, 4)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={wrapAmount}
                  placeholder="0"
                  readOnly
                  className="w-full text-3xl font-semibold bg-transparent border-none outline-none text-text-secondary placeholder-text-secondary"
                />
              </div>
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-input-bg rounded-xl border border-border min-w-[120px]">
                <span className="text-lg font-semibold text-text-primary">
                  {isWrapping ? `W${NATIVE_CURRENCY_SYMBOL}` : NATIVE_CURRENCY_SYMBOL}
                </span>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
            <p className="text-sm text-text-primary">
              {isWrapping
                ? `Wrapping converts your native ${NATIVE_CURRENCY_SYMBOL} to W${NATIVE_CURRENCY_SYMBOL} (Wrapped ${NATIVE_CURRENCY_SYMBOL}) tokens, which can be used in Uniswap V3 pools and swaps.`
                : `Unwrapping converts your W${NATIVE_CURRENCY_SYMBOL} tokens back to native ${NATIVE_CURRENCY_SYMBOL}.`}
            </p>
          </div>

          {/* Action Button */}
          {!isWrapConnected ? (
            <button
              disabled
              className="w-full py-4 bg-secondary text-text-secondary rounded-xl font-semibold cursor-not-allowed"
            >
              Connect Wallet
            </button>
          ) : !wrapAmount || parseFloat(wrapAmount) <= 0 ? (
            <button
              disabled
              className="w-full py-4 bg-secondary text-text-secondary rounded-xl font-semibold cursor-not-allowed"
            >
              Enter Amount
            </button>
          ) : isWrapping && nativeBalance && parseFloat(wrapAmount) > parseFloat(nativeBalance.formatted) ? (
            <button
              disabled
              className="w-full py-4 bg-secondary text-text-secondary rounded-xl font-semibold cursor-not-allowed"
            >
              Insufficient Balance
            </button>
          ) : !isWrapping && wkaiaBalance && parseFloat(wrapAmount) > parseFloat(wkaiaBalance) ? (
            <button
              disabled
              className="w-full py-4 bg-secondary text-text-secondary rounded-xl font-semibold cursor-not-allowed"
            >
              Insufficient Balance
            </button>
          ) : isWrapLoading ? (
            <button
              disabled
              className="w-full py-4 bg-primary text-bg rounded-xl font-semibold cursor-not-allowed opacity-50"
            >
              {isWrapping ? 'Wrapping...' : 'Unwrapping...'}
            </button>
          ) : (
            <button
              onClick={isWrapping ? handleWrap : handleUnwrap}
              className="w-full py-4 bg-primary text-bg rounded-xl font-semibold hover:opacity-90 transition-colors"
            >
              {isWrapping ? `Wrap ${NATIVE_CURRENCY_SYMBOL}` : `Unwrap W${NATIVE_CURRENCY_SYMBOL}`}
            </button>
          )}

          {/* Error Messages */}
          {wrapError && (
            <div className="bg-error/20 rounded-xl p-4 border border-error/40">
              <p className="text-sm text-error">
                Error: {wrapError.message || 'Failed to wrap tokens'}
              </p>
            </div>
          )}
          {unwrapError && (
            <div className="bg-error/20 rounded-xl p-4 border border-error/40">
              <p className="text-sm text-error">
                Error: {unwrapError.message || 'Failed to unwrap tokens'}
              </p>
            </div>
          )}

          {/* Success Messages */}
          {isWrapSuccess && (
            <div className="bg-success/20 rounded-xl p-4 border border-success/40">
              <p className="text-sm text-success">
                Successfully wrapped {wrapAmount} {NATIVE_CURRENCY_SYMBOL} to W{NATIVE_CURRENCY_SYMBOL}!
              </p>
            </div>
          )}
          {isUnwrapSuccess && (
            <div className="bg-success/20 rounded-xl p-4 border border-success/40">
              <p className="text-sm text-success">
                Successfully unwrapped {wrapAmount} W{NATIVE_CURRENCY_SYMBOL} to {NATIVE_CURRENCY_SYMBOL}!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Swap Confirmation Modal */}
      {activeTab === 'swap' && showConfirmation && swapHash && swapDetails && (
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
