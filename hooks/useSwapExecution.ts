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
import { getRouterRoute } from '@/hooks/useSwapQuote';
import { addStatusMessage } from '@/contexts/SwapStatusContext';

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

  // Update status based on state
  useEffect(() => {
    if (error) {
      setStatus('error');
      return;
    }

    if (isSwapConfirmed) {
      setStatus('swap_confirmed');
      return;
    }

    if (isSwapping || swapHash) {
      setStatus(swapHash ? 'swap_pending' : 'swapping');
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
      console.log('Getting route from Smart Order Router...');
      // Always use Smart Order Router for execution - it handles all cases properly
      // including multi-hop routes, slippage, gas estimation, and multicall encoding
      const routeResult = await getRouterRoute(
        tokenIn,
        tokenOut,
        amountIn,
        slippage,
        deadline,
        address,
        provider,
        cachedRoute // Pass cached route - router may optimize if possible
      );

      if (!routeResult || !routeResult.methodParameters) {
        addStatusMessage('error', 'No route found', 'Please try again or check token pair');
        setError(new Error('No route found. Please try again.'));
        setStatus('error');
        setIsPreparingSwap(false);
        return;
      }

      console.log(`Route found: ${routeResult.quote.toExact()} ${tokenOut.symbol}`);
      addStatusMessage('success', `Route ready: ${routeResult.quote.toExact()} ${tokenOut.symbol}`, 'MethodParameters generated');

      setIsPreparingSwap(false);
      setStatus('swapping');
      addStatusMessage('loading', 'Sending swap transaction...', 'Waiting for wallet confirmation');
      console.log('Sending swap transaction...');
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
