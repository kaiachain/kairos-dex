import { useState, useCallback, useEffect, useRef } from 'react';
import { Token } from '@/types/token';

interface UseSwapFormProps {
  initialTokenIn?: Token | null;
  initialTokenOut?: Token | null;
}

/**
 * Hook for managing swap form state
 */
export function useSwapForm({ initialTokenIn, initialTokenOut }: UseSwapFormProps = {}) {
  const [tokenIn, setTokenIn] = useState<Token | null>(initialTokenIn || null);
  const [tokenOut, setTokenOut] = useState<Token | null>(initialTokenOut || null);
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [deadline, setDeadline] = useState(20);

  const handleAmountChange = useCallback((value: string) => {
    // Only allow valid number input
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmountIn(value);
    }
  }, []);

  const handleReverse = useCallback(() => {
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
  }, [tokenIn, tokenOut]);

  const handleMax = useCallback((balance: string | undefined) => {
    if (balance) {
      setAmountIn(balance);
    }
  }, []);

  return {
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
  };
}
