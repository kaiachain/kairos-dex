'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  
  // Store swap details for confirmation display
  const swapDetailsRef = useRef<{
    tokenIn: Token;
    tokenOut: Token;
    amountIn: string;
    amountOut: string;
  } | null>(null);
  
  // Track previous form values to detect changes
  const prevTokenInRef = useRef<Token | null>(null);
  const prevTokenOutRef = useRef<Token | null>(null);
  const prevAmountInRef = useRef<string>('');
  const hasShownConfirmationRef = useRef(false);
  const isProcessingSwapSuccessRef = useRef(false);

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
    console.log('Swap success callback called with hash:', hash);
    console.log('Current swap details:', { tokenIn, tokenOut, amountIn, amountOut: quote?.amountOut });
    
    // Store swap details before clearing the form
    if (tokenIn && tokenOut && amountIn && quote?.amountOut) {
      swapDetailsRef.current = {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: quote.amountOut,
      };
      console.log('Stored swap details:', swapDetailsRef.current);
    } else {
      console.warn('Missing swap details:', { tokenIn: !!tokenIn, tokenOut: !!tokenOut, amountIn, amountOut: !!quote?.amountOut });
    }
    
    // Mark that we're processing a swap success to prevent form change detection from resetting
    isProcessingSwapSuccessRef.current = true;
    
    setSwapHash(hash);
    hasShownConfirmationRef.current = true;
    
    // Show confirmation immediately
    setShowConfirmation(true);
    console.log('Setting showConfirmation to true');
    
    // Clear form after showing confirmation
    setAmountIn('');
    refetchBalanceIn?.();
    refetchBalanceOut?.();
    
    // Allow form change detection after a delay
    setTimeout(() => {
      isProcessingSwapSuccessRef.current = false;
      console.log('Swap success processing complete');
    }, 1000);
  }, [refetchBalanceIn, refetchBalanceOut, tokenIn, tokenOut, amountIn, quote]);

  // Reset confirmation on page load/reload
  // Note: React state automatically resets on page reload, but we ensure refs are cleared too
  useEffect(() => {
    // Reset confirmation state and refs on mount (handles page reload)
    setShowConfirmation(false);
    setSwapHash(null);
    swapDetailsRef.current = null;
    hasShownConfirmationRef.current = false;
    isProcessingSwapSuccessRef.current = false;
  }, []);

  // Reset confirmation when user changes swap form values
  useEffect(() => {
    // Don't reset if we're currently processing a swap success
    if (isProcessingSwapSuccessRef.current) {
      // Update refs without resetting
      prevTokenInRef.current = tokenIn;
      prevTokenOutRef.current = tokenOut;
      prevAmountInRef.current = amountIn;
      return;
    }

    // Only reset if we've shown a confirmation before
    if (!hasShownConfirmationRef.current || !showConfirmation) {
      // Update refs without resetting
      prevTokenInRef.current = tokenIn;
      prevTokenOutRef.current = tokenOut;
      prevAmountInRef.current = amountIn;
      return;
    }

    // Check if any form value has changed (only reset on user-initiated changes)
    const tokenInChanged = 
      (prevTokenInRef.current?.address !== tokenIn?.address) ||
      (prevTokenInRef.current === null && tokenIn !== null) ||
      (prevTokenInRef.current !== null && tokenIn === null);
    
    const tokenOutChanged = 
      (prevTokenOutRef.current?.address !== tokenOut?.address) ||
      (prevTokenOutRef.current === null && tokenOut !== null) ||
      (prevTokenOutRef.current !== null && tokenOut === null);
    
    // Only consider amountIn changed if it's not empty (user typing, not clearing after swap)
    const amountInChanged = prevAmountInRef.current !== amountIn && amountIn !== '';

    if (tokenInChanged || tokenOutChanged || amountInChanged) {
      // Reset confirmation when form changes
      setShowConfirmation(false);
      setSwapHash(null);
      swapDetailsRef.current = null;
      hasShownConfirmationRef.current = false;
    }

    // Update refs for next comparison
    prevTokenInRef.current = tokenIn;
    prevTokenOutRef.current = tokenOut;
    prevAmountInRef.current = amountIn;
  }, [tokenIn, tokenOut, amountIn, showConfirmation]);

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
      {(() => {
        if (!showConfirmation || !swapHash) return null;
        
        // Use stored swap details if available, otherwise fallback to current form values
        const details = swapDetailsRef.current || (tokenIn && tokenOut && amountIn && quote?.amountOut ? {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: quote.amountOut,
        } : null);
        
        if (!details) {
          console.warn('Cannot show confirmation: missing swap details', {
            hasStoredDetails: !!swapDetailsRef.current,
            hasFormValues: !!(tokenIn && tokenOut && amountIn && quote?.amountOut)
          });
          return null;
        }
        
        console.log('Rendering confirmation modal with details:', details);
        
        return (
          <SwapConfirmation
            tokenIn={details.tokenIn}
            tokenOut={details.tokenOut}
            amountIn={details.amountIn}
            amountOut={details.amountOut}
            transactionHash={swapHash}
            onClose={() => {
              console.log('Closing confirmation modal');
              setShowConfirmation(false);
              setSwapHash(null);
              swapDetailsRef.current = null;
              hasShownConfirmationRef.current = false;
              isProcessingSwapSuccessRef.current = false;
            }}
          />
        );
      })()}
    </div>
  );
}
