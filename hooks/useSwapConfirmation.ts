import { useState, useEffect, useRef, useCallback } from 'react';
import { Token } from '@/types/token';

interface SwapDetails {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
}

/**
 * Hook for managing swap confirmation state
 */
export function useSwapConfirmation() {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [swapHash, setSwapHash] = useState<string | null>(null);
  const swapDetailsRef = useRef<SwapDetails | null>(null);
  const hasShownConfirmationRef = useRef(false);
  const isProcessingSwapSuccessRef = useRef(false);

  // Track previous form values to detect changes
  const prevTokenInRef = useRef<Token | null>(null);
  const prevTokenOutRef = useRef<Token | null>(null);
  const prevAmountInRef = useRef<string>('');

  // Reset confirmation on mount
  useEffect(() => {
    setShowConfirmation(false);
    setSwapHash(null);
    swapDetailsRef.current = null;
    hasShownConfirmationRef.current = false;
    isProcessingSwapSuccessRef.current = false;
  }, []);

  const handleSwapSuccess = (
    hash: string,
    tokenIn: Token | null,
    tokenOut: Token | null,
    amountIn: string,
    amountOut: string | undefined
  ) => {
    if (tokenIn && tokenOut && amountIn && amountOut) {
      swapDetailsRef.current = {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
      };
    }

    isProcessingSwapSuccessRef.current = true;
    setSwapHash(hash);
    hasShownConfirmationRef.current = true;
    setShowConfirmation(true);

    setTimeout(() => {
      isProcessingSwapSuccessRef.current = false;
    }, 1000);
  };

  const resetConfirmation = useCallback((tokenIn: Token | null, tokenOut: Token | null, amountIn: string) => {
    // Don't reset if we're currently processing a swap success
    if (isProcessingSwapSuccessRef.current) {
      prevTokenInRef.current = tokenIn;
      prevTokenOutRef.current = tokenOut;
      prevAmountInRef.current = amountIn;
      return;
    }

    // Only reset if we've shown a confirmation before
    if (!hasShownConfirmationRef.current || !showConfirmation) {
      prevTokenInRef.current = tokenIn;
      prevTokenOutRef.current = tokenOut;
      prevAmountInRef.current = amountIn;
      return;
    }

    // Check if any form value has changed
    const tokenInChanged =
      (prevTokenInRef.current?.address !== tokenIn?.address) ||
      (prevTokenInRef.current === null && tokenIn !== null) ||
      (prevTokenInRef.current !== null && tokenIn === null);

    const tokenOutChanged =
      (prevTokenOutRef.current?.address !== tokenOut?.address) ||
      (prevTokenOutRef.current === null && tokenOut !== null) ||
      (prevTokenOutRef.current !== null && tokenOut === null);

    const amountInChanged = prevAmountInRef.current !== amountIn && amountIn !== '';

    if (tokenInChanged || tokenOutChanged || amountInChanged) {
      setShowConfirmation(false);
      setSwapHash(null);
      swapDetailsRef.current = null;
      hasShownConfirmationRef.current = false;
    }

    prevTokenInRef.current = tokenIn;
    prevTokenOutRef.current = tokenOut;
    prevAmountInRef.current = amountIn;
  }, [showConfirmation]);

  const closeConfirmation = () => {
    setShowConfirmation(false);
    setSwapHash(null);
    swapDetailsRef.current = null;
    hasShownConfirmationRef.current = false;
    isProcessingSwapSuccessRef.current = false;
  };

  return {
    showConfirmation,
    swapHash,
    swapDetails: swapDetailsRef.current,
    handleSwapSuccess,
    resetConfirmation,
    closeConfirmation,
  };
}
