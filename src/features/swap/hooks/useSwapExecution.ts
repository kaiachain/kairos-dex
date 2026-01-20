/**
 * Hook for handling swap execution (approval + swap)
 * Separates business logic from UI components
 */

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSendTransaction, usePublicClient } from 'wagmi';
import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits, formatUnits } from '@/lib/utils';
import { erc20Abi } from 'viem';
import { maxUint256 } from 'viem';
import { JsonRpcProvider } from '@ethersproject/providers';
import { RPC_URL } from '@/config/env';
import { getRouterRoute } from '@/features/swap/hooks/useSwapQuote';
import { addStatusMessage } from '@/app/providers/contexts/SwapStatusContext';
import { getCachedQuote, getCacheKey } from '@/features/swap/utils/quoteCache';

export interface SwapExecutionState {
  needsApproval: boolean;
  isApproving: boolean;
  isSwapping: boolean;
  isApprovalConfirmed: boolean;
  isSwapConfirmed: boolean;
  error: Error | null;
}

export interface UseSwapExecutionOptions {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  slippage: number;
  deadline: number;
  quote: SwapQuote | null;
  cachedRoute?: any; // Optional cached route from quote hook
  onSwapSuccess?: (hash: string) => void;
}

export type SwapStatus = 
  | 'idle'
  | 'fetching_quote'
  | 'quote_ready'
  | 'approval_needed'
  | 'approving'
  | 'approval_pending'
  | 'approval_confirmed'
  | 'preparing_swap'
  | 'swapping'
  | 'swap_pending'
  | 'swap_confirmed'
  | 'error';

export function useSwapExecution({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  slippage,
  deadline,
  quote,
  cachedRoute,
  onSwapSuccess,
}: UseSwapExecutionOptions) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [isPreparingSwap, setIsPreparingSwap] = useState(false);
  
  const lastProcessedApprovalHash = useRef<string | undefined>(undefined);
  const lastProcessedSwapHash = useRef<string | undefined>(undefined);
  const latestRefetchedAllowance = useRef<bigint | undefined>(undefined);
  const refetchedAllowanceToken = useRef<string | undefined>(undefined);
  
  // Track swap parameters for the confirmed swap to detect when form changes
  const confirmedSwapParamsRef = useRef<{
    tokenInAddress: string | null;
    tokenOutAddress: string | null;
    amountIn: string;
    swapHash: string;
  } | null>(null);

  const { writeContract: approveToken, data: approveHash } = useWriteContract();
  const { isLoading: isApprovingTx, isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { sendTransaction: sendSwapTransaction, data: swapHash, error: sendSwapError } = useSendTransaction();
  const { isLoading: isSwapping, isError: isSwapError, isSuccess: isSwapConfirmed, error: swapReceiptError } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  // Check allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenIn?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && tokenIn
      ? [address, CONTRACTS.SwapRouter02 as `0x${string}`]
      : undefined,
    query: {
      enabled: !!tokenIn && !!address,
    },
  });

  // Check token balance
  const { data: tokenBalance } = useReadContract({
    address: tokenIn?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!tokenIn && !!address,
    },
  });

  // Track swap parameters when swapHash is set (when transaction is sent)
  // We capture params from a ref that's set in executeSwap to avoid timing issues
  const pendingSwapParamsRef = useRef<{
    tokenInAddress: string | null;
    tokenOutAddress: string | null;
    amountIn: string;
  } | null>(null);
  
  useEffect(() => {
    if (swapHash && swapHash !== lastProcessedSwapHash.current && pendingSwapParamsRef.current) {
      // Store the parameters that were used for this swap at the time it was sent
      confirmedSwapParamsRef.current = {
        ...pendingSwapParamsRef.current,
        swapHash: swapHash,
      };
      // Clear pending params after storing
      pendingSwapParamsRef.current = null;
    }
  }, [swapHash]);

  // Clear confirmed swap params when form values change significantly
  useEffect(() => {
    if (confirmedSwapParamsRef.current) {
      const currentParams = {
        tokenInAddress: tokenIn?.address || null,
        tokenOutAddress: tokenOut?.address || null,
        amountIn: amountIn || '',
      };
      
      // If parameters changed significantly, clear the confirmed swap reference
      // This includes: token changes, or amount changes (even if amount is cleared)
      const paramsChanged = 
        confirmedSwapParamsRef.current.tokenInAddress !== currentParams.tokenInAddress ||
        confirmedSwapParamsRef.current.tokenOutAddress !== currentParams.tokenOutAddress ||
        confirmedSwapParamsRef.current.amountIn !== currentParams.amountIn;
      
      if (paramsChanged) {
        confirmedSwapParamsRef.current = null;
      }
    }
  }, [tokenIn?.address, tokenOut?.address, amountIn]);

  // Update status based on state
  useEffect(() => {
    if (error) {
      setStatus('error');
      return;
    }

    const currentParams = {
      tokenInAddress: tokenIn?.address || null,
      tokenOutAddress: tokenOut?.address || null,
      amountIn: amountIn || '',
    };

    // Check if swapHash belongs to the current swap parameters
    // Only consider it valid if we have confirmed swap params that match
    const isCurrentSwap = confirmedSwapParamsRef.current !== null &&
      confirmedSwapParamsRef.current.swapHash === swapHash &&
      confirmedSwapParamsRef.current.tokenInAddress === currentParams.tokenInAddress &&
      confirmedSwapParamsRef.current.tokenOutAddress === currentParams.tokenOutAddress &&
      confirmedSwapParamsRef.current.amountIn === currentParams.amountIn;

    // Only show swap_confirmed if:
    // 1. Swap is confirmed (from wagmi)
    // 2. We have a swapHash
    // 3. We have confirmed swap params (form hasn't changed)
    // 4. The swapHash matches the current swap parameters
    // This prevents showing "Swap Confirmed" when form values change after a swap
    if (isSwapConfirmed && swapHash && confirmedSwapParamsRef.current !== null && isCurrentSwap) {
      setStatus('swap_confirmed');
      return;
    }

    // Only consider swapHash if it belongs to the current swap
    // If confirmedSwapParamsRef is null, it means form values changed, so ignore old swapHash
    // Otherwise, ignore it (it's from a previous swap with different parameters)
    if (isSwapping || (swapHash && isCurrentSwap)) {
      setStatus(swapHash && isCurrentSwap ? 'swap_pending' : 'swapping');
      return;
    }

    if (isPreparingSwap) {
      setStatus('preparing_swap');
      return;
    }

    if (isApprovalConfirmed) {
      setStatus('approval_confirmed');
      return;
    }

    if (isApproving || isApprovingTx || approveHash) {
      setStatus(approveHash ? 'approval_pending' : 'approving');
      return;
    }

    if (needsApproval) {
      setStatus('approval_needed');
      return;
    }

    if (quote) {
      setStatus('quote_ready');
      return;
    }

    setStatus('idle');
  }, [
    error,
    isSwapConfirmed,
    isSwapping,
    swapHash,
    isPreparingSwap,
    isApprovalConfirmed,
    isApproving,
    isApprovingTx,
    approveHash,
    needsApproval,
    quote,
    tokenIn?.address,
    tokenOut?.address,
    amountIn,
  ]);

  // Handle swap errors
  useEffect(() => {
    if (sendSwapError) {
      const errorMessage = String(sendSwapError?.message || sendSwapError || '');
      if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
        setError(new Error('Transaction rejected by user'));
        setStatus('error');
      } else if (errorMessage.includes('insufficient funds')) {
        setError(new Error('Insufficient funds for gas'));
        setStatus('error');
      } else {
        setError(new Error(errorMessage || 'Transaction failed'));
        setStatus('error');
      }
    }
    
    if (swapHash && (isSwapError || swapReceiptError) && publicClient) {
      const fetchRevertReason = async () => {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: swapHash });
          if (receipt.status === 'reverted') {
            setError(new Error(`Transaction reverted. Hash: ${swapHash}`));
            setStatus('error');
          }
        } catch (receiptError) {
          console.error('Error fetching transaction receipt:', receiptError);
        }
      };
      fetchRevertReason();
    }
    
    if (swapReceiptError) {
      const errorMessage = String(swapReceiptError?.message || swapReceiptError || '');
      setError(new Error(errorMessage || 'Swap transaction failed'));
      setStatus('error');
    }
  }, [sendSwapError, swapReceiptError, isSwapError, publicClient, swapHash]);

  // Call onSwapSuccess callback when swap transaction is confirmed
  useEffect(() => {
    if (isSwapConfirmed && onSwapSuccess && swapHash && swapHash !== lastProcessedSwapHash.current) {
      lastProcessedSwapHash.current = swapHash;
      addStatusMessage('success', `Swap transaction confirmed!`, `Hash: ${swapHash}`);
      onSwapSuccess(swapHash);
    }
  }, [isSwapConfirmed, onSwapSuccess, swapHash]);

  // Refetch allowance when approval transaction is confirmed
  useEffect(() => {
    if (isApprovalConfirmed && refetchAllowance && approveHash && approveHash !== lastProcessedApprovalHash.current) {
      lastProcessedApprovalHash.current = approveHash;
      setIsApproving(false);
      
      const refetch = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const result = await refetchAllowance();
          
          if (result.data !== undefined && tokenIn) {
            latestRefetchedAllowance.current = result.data as bigint;
            refetchedAllowanceToken.current = tokenIn.address;
            
            if (amountIn) {
              const requiredAmount = parseUnits(amountIn, tokenIn.decimals);
              const hasEnough = result.data >= requiredAmount;
              setNeedsApproval(!hasEnough);
            }
          }
        } catch (error) {
          console.error('Error refetching allowance:', error);
        }
      };
      refetch();
    }
  }, [isApprovalConfirmed, refetchAllowance, approveHash, tokenIn, amountIn]);

  // Clear refetched allowance when token changes
  useEffect(() => {
    if (tokenIn && refetchedAllowanceToken.current !== tokenIn.address) {
      latestRefetchedAllowance.current = undefined;
      refetchedAllowanceToken.current = undefined;
    }
  }, [tokenIn]);

  // Check if approval is needed and validate balance
  useEffect(() => {
    if (!tokenIn || !amountIn) {
      setNeedsApproval(false);
      return;
    }

    if (allowance === undefined || tokenBalance === undefined) {
      return;
    }

    const currentAllowance = (
      latestRefetchedAllowance.current !== undefined && 
      refetchedAllowanceToken.current === tokenIn.address
    ) 
      ? latestRefetchedAllowance.current 
      : allowance;

    const requiredAmount = parseUnits(amountIn, tokenIn.decimals);
    const hasEnoughBalance = tokenBalance >= requiredAmount;
    const hasEnoughAllowance = currentAllowance >= requiredAmount;

    if (!hasEnoughBalance) {
      console.warn('Insufficient token balance:', {
        required: requiredAmount.toString(),
        available: tokenBalance.toString(),
      });
    }

    setNeedsApproval(!hasEnoughAllowance);
  }, [tokenIn, amountIn, allowance, tokenBalance]);

  /**
   * Approve token spending
   */
  const approve = async () => {
    if (!tokenIn || !amountIn) {
      setError(new Error('Token and amount required for approval'));
      return;
    }
    
    setIsApproving(true);
    setError(null);
    
    try {
      approveToken({
        address: tokenIn.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [
          CONTRACTS.SwapRouter02 as `0x${string}`,
          maxUint256,
        ],
      });
    } catch (error) {
      console.error('Approval error:', error);
      setError(error instanceof Error ? error : new Error('Approval failed'));
      setIsApproving(false);
    }
  };

  /**
   * Execute swap
   */
  const executeSwap = async () => {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut || !address || !quote) {
      setError(new Error('Missing required swap parameters'));
      setStatus('error');
      return;
    }

    setError(null);
    setIsPreparingSwap(true);
    setStatus('preparing_swap');

    // Validate balance
    const requiredAmount = parseUnits(amountIn, tokenIn.decimals);
    if (!tokenBalance || tokenBalance < requiredAmount) {
      const balanceFormatted = tokenBalance ? formatUnits(tokenBalance, tokenIn.decimals) : '0';
      const requiredFormatted = formatUnits(requiredAmount, tokenIn.decimals);
      setError(new Error(`Insufficient ${tokenIn.symbol} balance. Required: ${requiredFormatted}, Available: ${balanceFormatted}`));
      setStatus('error');
      setIsPreparingSwap(false);
      return;
    }

    // Validate allowance
    const currentAllowance = (
      latestRefetchedAllowance.current !== undefined && 
      refetchedAllowanceToken.current === tokenIn.address
    ) 
      ? latestRefetchedAllowance.current 
      : allowance;
      
    if (!currentAllowance || currentAllowance < requiredAmount) {
      const allowanceFormatted = currentAllowance ? formatUnits(currentAllowance, tokenIn.decimals) : '0';
      const requiredFormatted = formatUnits(requiredAmount, tokenIn.decimals);
      setError(new Error(`Insufficient token allowance. Required: ${requiredFormatted}, Approved: ${allowanceFormatted}. Please approve more tokens.`));
      setNeedsApproval(true);
      setStatus('approval_needed');
      setIsPreparingSwap(false);
      return;
    }

    try {
      const provider = new JsonRpcProvider(RPC_URL);

      addStatusMessage('info', 'Preparing swap execution...', `Slippage: ${slippage}%, Deadline: ${deadline}min`);
      
      // Try to use cached route first to avoid refetching
      let routeResult: { route: any; methodParameters: any; quote: any } | null = null;
      
      if (cachedRoute?.route) {
        console.log('Using cached route for execution...');
        addStatusMessage('info', 'Using cached route', 'Regenerating methodParameters with your settings...');
        
        // Use cached route and regenerate methodParameters with user's slippage/deadline
        routeResult = await getRouterRoute(
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
          deadline,
          address,
          provider,
          cachedRoute // Pass cached route - router will reuse it and regenerate methodParameters
        );
      }
      
      // If cached route didn't work or wasn't available, wait briefly for background fetch
      if (!routeResult || !routeResult.methodParameters) {
        // Check cache again - route might have been fetched in background
        const cacheKey = getCacheKey(tokenIn, tokenOut, amountIn);
        const cached = getCachedQuote(cacheKey);
        
        if (cached?.routeResult?.route) {
          console.log('Found route in cache after brief wait, using it...');
          addStatusMessage('info', 'Using cached route', 'Route was being prepared in background');
          routeResult = await getRouterRoute(
            tokenIn,
            tokenOut,
            amountIn,
            slippage,
            deadline,
            address,
            provider,
            cached.routeResult // Use the cached route
          );
        }
      }
      
      // If still no route, wait a bit more for background fetch (max 3 seconds)
      if (!routeResult || !routeResult.methodParameters) {
        console.log('Waiting briefly for route to be ready...');
        addStatusMessage('info', 'Waiting for route...', 'Route is being prepared');
        
        // Wait up to 3 seconds, checking cache every 500ms
        for (let i = 0; i < 6; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const cacheKey2 = getCacheKey(tokenIn, tokenOut, amountIn);
          const cached2 = getCachedQuote(cacheKey2);
          
          if (cached2?.routeResult?.route) {
            console.log('Found route in cache after waiting, using it...');
            addStatusMessage('info', 'Using cached route', 'Route ready');
            routeResult = await getRouterRoute(
              tokenIn,
              tokenOut,
              amountIn,
              slippage,
              deadline,
              address,
              provider,
              cached2.routeResult
            );
            if (routeResult?.methodParameters) {
              break; // Success, exit loop
            }
          }
        }
      }
      
      // If cached route still not available, fetch fresh
      if (!routeResult || !routeResult.methodParameters) {
        console.log('Cached route not available, fetching fresh route...');
        addStatusMessage('loading', 'Getting route from Smart Order Router...', 'This may take a few seconds');
        routeResult = await getRouterRoute(
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
          deadline,
          address,
          provider,
          undefined // No cached route
        );
      }

      if (!routeResult || !routeResult.methodParameters) {
        addStatusMessage('error', 'No route found', 'Please try again or check token pair');
        setError(new Error('No route found. Please try again.'));
        setStatus('error');
        setIsPreparingSwap(false);
        return;
      }

      console.log(`Route ready: ${routeResult.quote.toExact()} ${tokenOut.symbol}`);
      addStatusMessage('success', `Route ready: ${routeResult.quote.toExact()} ${tokenOut.symbol}`, 'MethodParameters generated');

      setIsPreparingSwap(false);
      setStatus('swapping');
      addStatusMessage('loading', 'Sending swap transaction...', 'Waiting for wallet confirmation');
      console.log('Sending swap transaction...');
      
      // Capture swap parameters at execution time (before they might be cleared)
      pendingSwapParamsRef.current = {
        tokenInAddress: tokenIn.address,
        tokenOutAddress: tokenOut.address,
        amountIn: amountIn,
      };
      
      sendSwapTransaction({
        to: CONTRACTS.SwapRouter02 as `0x${string}`,
        data: routeResult.methodParameters.calldata as `0x${string}`,
        value: routeResult.methodParameters.value ? BigInt(routeResult.methodParameters.value) : undefined,
      });

      addStatusMessage('info', 'Transaction sent to wallet', 'Please confirm in your wallet');
      console.log('Swap transaction sent successfully');
    } catch (error) {
      console.error('Swap error:', error);
      setError(error instanceof Error ? error : new Error('Swap failed'));
      setStatus('error');
      setIsPreparingSwap(false);
    }
  };

  return {
    // State
    needsApproval,
    isApproving: isApproving || isApprovingTx,
    isSwapping,
    isPreparingSwap,
    isApprovalConfirmed,
    isSwapConfirmed,
    status,
    error,
    isConnected,
    
    // Transaction hashes
    approveHash,
    swapHash,
    
    // Actions
    approve,
    executeSwap,
    
    // Balance info
    tokenBalance,
    allowance,
  };
}
