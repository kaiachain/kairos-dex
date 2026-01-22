
import { useEffect, useMemo, useCallback, useState } from 'react';
import { lazy, Suspense } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { TokenSelector } from './TokenSelector';
import { SwapButton } from './SwapButton';
import { SwapSettings } from './SwapSettings';
import { PriceInfo } from './PriceInfo';
import { TerminalStatus } from './TerminalStatus';
import { QuoteTimer } from './QuoteTimer';
import { ArrowDownUp, Loader2, AlertCircle, X } from 'lucide-react';
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
import { normalizeError, getUserFriendlyMessage } from '@/shared/utils/errorHandler';

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
  const { data: quote, isLoading: isQuoteLoading, error: quoteError, getCachedRoute, quoteTimestamp, routeDiagnostic } = useSwapQuote(
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
  const { writeContract: wrap, data: wrapHash, error: wrapError, isPending: isWrapPending, status: wrapStatus } = useWriteContract();
  const { isLoading: isWrappingTx, isSuccess: isWrapSuccess } = useWaitForTransactionReceipt({
    hash: wrapHash,
  });

  // Unwrap transaction
  const { writeContract: unwrap, data: unwrapHash, error: unwrapError, isPending: isUnwrapPending, status: unwrapStatus } = useWriteContract();
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
    if (!CONTRACT_WRAPPED_NATIVE_TOKEN) {
      console.error('Wrapped native token contract address not configured');
      return;
    }

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
      // Error will be handled by wrapError from useWriteContract
    }
  }, [wrapAmount, isWrapConnected, address, wrap]);

  const handleUnwrap = useCallback(async () => {
    if (!wrapAmount || parseFloat(wrapAmount) <= 0) return;
    if (!isWrapConnected || !address) return;
    if (!CONTRACT_WRAPPED_NATIVE_TOKEN) {
      console.error('Wrapped native token contract address not configured');
      return;
    }

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
      // Error will be handled by unwrapError from useWriteContract
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
      // Clear dismissed errors on success
      setDismissedErrors(new Set());
      const timer = setTimeout(() => setWrapAmount(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [isWrapSuccess, isUnwrapSuccess, refetchNativeBalance, refetchWkaiaBalance]);

  // Clear dismissed errors when errors change
  useEffect(() => {
    if (!wrapError) {
      setDismissedErrors(prev => {
        const next = new Set(prev);
        next.delete('wrap');
        return next;
      });
    }
  }, [wrapError]);

  useEffect(() => {
    if (!unwrapError) {
      setDismissedErrors(prev => {
        const next = new Set(prev);
        next.delete('unwrap');
        return next;
      });
    }
  }, [unwrapError]);

  useEffect(() => {
    if (!quoteError) {
      setDismissedErrors(prev => {
        const next = new Set(prev);
        next.delete('quote');
        return next;
      });
    }
  }, [quoteError]);

  const isWrapLoading = isWrappingTx || isUnwrappingTx;
  const isWrapWaitingSignature = isWrapping ? isWrapPending : isUnwrapPending;
  const wrapCurrentBalance = isWrapping ? nativeBalance?.formatted : wkaiaBalance;
  const isLoadingWrapBalance = isWrapping ? isLoadingNative : isLoadingWkaia;

  // Get button text and state based on current status
  const getWrapButtonText = useCallback(() => {
    if (isWrapWaitingSignature) {
      return isWrapping ? 'Confirm in Wallet...' : 'Confirm Unwrap in Wallet...';
    }
    if (isWrapLoading) {
      return isWrapping ? 'Wrapping...' : 'Unwrapping...';
    }
    return isWrapping ? `Wrap ${NATIVE_CURRENCY_SYMBOL}` : `Unwrap W${NATIVE_CURRENCY_SYMBOL}`;
  }, [isWrapWaitingSignature, isWrapLoading, isWrapping]);

  // Helper function to parse and format error messages
  const getErrorMessage = useCallback((error: unknown): string => {
    if (!error) return '';
    
    const normalizedError = normalizeError(error);
    let message = getUserFriendlyMessage(normalizedError);
    
    // Handle common wagmi/viem error patterns
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = String(error.message).toLowerCase();
      
      // User rejected transaction
      if (errorMessage.includes('user rejected') || errorMessage.includes('user denied')) {
        return 'Transaction was cancelled.';
      }
      
      // Insufficient funds
      if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
        return 'Insufficient balance for this transaction.';
      }
      
      // Gas estimation errors
      if (errorMessage.includes('gas') || errorMessage.includes('execution reverted')) {
        return 'Transaction failed. Please check your balance and try again.';
      }
      
      // Network errors
      if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('fetch')) {
        return 'Network error. Please check your connection and try again.';
      }
      
      // Contract-specific errors
      if (errorMessage.includes('revert') || errorMessage.includes('execution')) {
        // Try to extract revert reason if available
        const revertMatch = String(error.message).match(/revert\s+(.+)/i);
        if (revertMatch) {
          return `Transaction failed: ${revertMatch[1]}`;
        }
        return 'Transaction failed. Please try again.';
      }
    }
    
    return message;
  }, []);

  // State for error dismissal
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());
  
  const dismissError = useCallback((errorKey: string) => {
    setDismissedErrors(prev => new Set(prev).add(errorKey));
  }, []);

  // Get formatted error messages
  const wrapErrorMessage = useMemo(() => {
    if (!wrapError) return '';
    return getErrorMessage(wrapError);
  }, [wrapError, getErrorMessage]);

  const unwrapErrorMessage = useMemo(() => {
    if (!unwrapError) return '';
    return getErrorMessage(unwrapError);
  }, [unwrapError, getErrorMessage]);

  const quoteErrorMessage = useMemo(() => {
    if (!quoteError) return '';
    return getErrorMessage(quoteError);
  }, [quoteError, getErrorMessage]);

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
          disabled={!CONTRACT_WRAPPED_NATIVE_TOKEN}
          className={cn(
            'flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
            activeTab === 'wrap'
              ? 'bg-white dark:bg-card text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary',
            !CONTRACT_WRAPPED_NATIVE_TOKEN && 'opacity-50 cursor-not-allowed'
          )}
          title={!CONTRACT_WRAPPED_NATIVE_TOKEN ? 'Wrap functionality not configured' : undefined}
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
              <span className="text-xs text-error flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Unable to get quote
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

        {/* Quote Error Display */}
        {quoteError && !dismissedErrors.has('quote') && (
          <div className="flex items-start gap-3 p-4 bg-error/10 dark:bg-error/5 rounded-xl border border-error/30">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-error mb-1">Unable to Get Quote</p>
              <p className="text-xs text-error/80">{quoteErrorMessage || 'Failed to fetch swap quote. Please try again.'}</p>
              <p className="text-xs text-text-secondary mt-2">
                Try: Selecting different tokens, adjusting the amount, or checking your connection.
              </p>
            </div>
            <button
              onClick={() => dismissError('quote')}
              className="p-1 hover:bg-error/20 rounded transition-colors flex-shrink-0"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4 text-error" />
            </button>
          </div>
        )}

        {/* Price Info */}
        {showPriceInfo && quote && tokenIn && tokenOut && !quoteError && (
          <div className="space-y-2">
            <PriceInfo
              quote={quote}
              tokenIn={tokenIn}
              tokenOut={tokenOut}
              slippage={slippage}
              amountIn={amountIn}
            />
            {/* Quote Expiration Timer */}
            {quoteTimestamp && (
              <div className="flex justify-end">
                <QuoteTimer timestamp={quoteTimestamp} expirationTime={60000} />
              </div>
            )}
          </div>
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
          routeDiagnostic={routeDiagnostic}
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
      ) : !CONTRACT_WRAPPED_NATIVE_TOKEN ? (
        /* Wrap Not Configured */
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <AlertCircle className="w-12 h-12 text-text-secondary mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">Wrap Functionality Unavailable</h3>
          <p className="text-sm text-text-secondary text-center max-w-md">
            The wrapped native token contract address is not configured. Please contact the administrator or check your environment configuration.
          </p>
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
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers and decimal point
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setWrapAmount(value);
                    }
                  }}
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
          ) : isWrapWaitingSignature || isWrapLoading ? (
            <button
              disabled
              className="w-full py-4 bg-primary text-bg rounded-xl font-semibold cursor-not-allowed opacity-50 flex items-center justify-center gap-2"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              {getWrapButtonText()}
            </button>
          ) : (
            <button
              onClick={isWrapping ? handleWrap : handleUnwrap}
              className="w-full py-4 bg-primary text-bg rounded-xl font-semibold hover:opacity-90 transition-colors"
            >
              {getWrapButtonText()}
            </button>
          )}

          {/* Error Messages */}
          {wrapError && !dismissedErrors.has('wrap') && (
            <div className="flex items-start gap-3 p-4 bg-error/10 dark:bg-error/5 rounded-xl border border-error/30">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-error mb-1">Wrap Failed</p>
                <p className="text-xs text-error/80">
                  {wrapErrorMessage || 'Failed to wrap tokens. Please try again.'}
                </p>
              </div>
              <button
                onClick={() => dismissError('wrap')}
                className="p-1 hover:bg-error/20 rounded transition-colors flex-shrink-0"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4 text-error" />
              </button>
            </div>
          )}
          {unwrapError && !dismissedErrors.has('unwrap') && (
            <div className="flex items-start gap-3 p-4 bg-error/10 dark:bg-error/5 rounded-xl border border-error/30">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-error mb-1">Unwrap Failed</p>
                <p className="text-xs text-error/80">
                  {unwrapErrorMessage || 'Failed to unwrap tokens. Please try again.'}
                </p>
              </div>
              <button
                onClick={() => dismissError('unwrap')}
                className="p-1 hover:bg-error/20 rounded transition-colors flex-shrink-0"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4 text-error" />
              </button>
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
