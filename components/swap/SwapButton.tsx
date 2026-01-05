'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSendTransaction } from 'wagmi';
import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from '@/lib/utils';
import { erc20Abi } from 'viem';
import { SwapRouter02_ABI } from '@/abis/SwapRouter02';
import { createTrade } from '@/lib/sdk-utils';
import { SwapRouter } from '@uniswap/v3-sdk';
import { Percent, TradeType } from '@uniswap/sdk-core';
import { FeeAmount } from '@uniswap/v3-sdk';

interface SwapButtonProps {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  slippage: number;
  deadline: number;
  quote: SwapQuote | null;
  isQuoteLoading: boolean;
}

export function SwapButton({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  slippage,
  deadline,
  quote,
  isQuoteLoading,
}: SwapButtonProps) {
  const { address, isConnected } = useAccount();
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [tradeData, setTradeData] = useState<any>(null);

  const { writeContract: approveToken, data: approveHash } = useWriteContract();
  const { isLoading: isApprovingTx } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { writeContract: swap, data: swapHash, error: swapError } = useWriteContract();
  const { sendTransaction: sendSwapTransaction, data: sendSwapHash, error: sendSwapError } = useSendTransaction();
  const swapTransactionHash = swapHash || sendSwapHash;
  const { isLoading: isSwapping, isError: isSwapError, error: swapReceiptError } = useWaitForTransactionReceipt({
    hash: swapTransactionHash,
  });

  // Log swap errors
  useEffect(() => {
    if (swapError) {
      console.error('Swap write error:', swapError);
    }
    if (sendSwapError) {
      console.error('Send swap transaction error:', sendSwapError);
    }
    if (swapReceiptError) {
      console.error('Swap receipt error:', swapReceiptError);
    }
    if (isSwapError) {
      console.error('Swap transaction failed - check transaction receipt for revert reason');
    }
  }, [swapError, sendSwapError, swapReceiptError, isSwapError]);

  // Check allowance
  const { data: allowance } = useReadContract({
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

  // Fetch trade data when quote changes
  // Only fetch if we have a quote (quote indicates a valid route was found)
  useEffect(() => {
    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0 || !quote) {
      setTradeData(null);
      return;
    }

    const fetchTradeData = async () => {
      try {
        console.log('Fetching trade data for swap button...');
        // Use the same fee tiers as useSwapQuote, including 100
        const feeTiers = [100, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH] as FeeAmount[];
        const tradeResult = await createTrade(tokenIn, tokenOut, amountIn, feeTiers);
        if (tradeResult) {
          console.log('Trade data fetched successfully for swap button');
          setTradeData(tradeResult);
        } else {
          console.warn('Trade data fetch returned null');
          setTradeData(null);
        }
      } catch (error) {
        console.error('Error fetching trade data:', error);
        setTradeData(null);
      }
    };

    fetchTradeData();
  }, [tokenIn, tokenOut, amountIn, quote]);

  // Check if approval is needed and validate balance
  // Use trade amount if available, otherwise use input amount
  useEffect(() => {
    // Don't reset needsApproval if data is still loading
    // Only check if we have the minimum required data
    if (!tokenIn || !amountIn) {
      setNeedsApproval(false);
      return;
    }

    // If allowance or tokenBalance haven't loaded yet, don't update needsApproval
    // This prevents false negatives while data is loading
    if (allowance === undefined || tokenBalance === undefined) {
      return;
    }

    // If we have tradeData, use the actual trade amount (more accurate)
    // Otherwise, use the parsed input amount
    let requiredAmount: bigint;
    if (tradeData?.trade) {
      requiredAmount = BigInt(tradeData.trade.inputAmount.quotient.toString());
    } else {
      requiredAmount = parseUnits(amountIn, tokenIn.decimals);
    }

    const hasEnoughBalance = tokenBalance >= requiredAmount;
    const hasEnoughAllowance = allowance >= requiredAmount;

    if (!hasEnoughBalance) {
      console.warn('Insufficient token balance:', {
        required: requiredAmount.toString(),
        available: tokenBalance.toString(),
      });
    }

    if (!hasEnoughAllowance) {
      console.log('Insufficient allowance detected:', {
        required: requiredAmount.toString(),
        approved: allowance.toString(),
        willShowApproveButton: true,
      });
    }

    setNeedsApproval(!hasEnoughAllowance);
  }, [tokenIn, amountIn, allowance, tokenBalance, tradeData]);

  const handleApprove = async () => {
    if (!tokenIn || !amountIn) return;
    setIsApproving(true);
    try {
      // Use trade amount if available, otherwise use input amount
      // Approve a bit more than needed to avoid needing re-approval for small amounts
      let approveAmount: bigint;
      if (tradeData?.trade) {
        // Approve 110% of trade amount to account for small variations
        const tradeAmount = BigInt(tradeData.trade.inputAmount.quotient.toString());
        approveAmount = (tradeAmount * BigInt(110)) / BigInt(100);
      } else {
        const amountInWei = parseUnits(amountIn, tokenIn.decimals);
        // Approve 110% of input amount
        approveAmount = (amountInWei * BigInt(110)) / BigInt(100);
      }

      approveToken({
        address: tokenIn.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [
          CONTRACTS.SwapRouter02 as `0x${string}`,
          approveAmount,
        ],
      });
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut || !address) return;

    // Check allowance FIRST before doing any expensive operations
    // Use tradeData amount if available, otherwise use input amount
    let requiredAmount: bigint;
    if (tradeData?.trade) {
      requiredAmount = BigInt(tradeData.trade.inputAmount.quotient.toString());
    } else {
      requiredAmount = parseUnits(amountIn, tokenIn.decimals);
    }

    // If allowance is insufficient, update needsApproval and return early
    if (!allowance || allowance < requiredAmount) {
      console.warn('Insufficient allowance detected, updating needsApproval state');
      setNeedsApproval(true);
      return;
    }

    // Check balance
    if (!tokenBalance || tokenBalance < requiredAmount) {
      console.error('Insufficient token balance for swap:', {
        required: requiredAmount.toString(),
        available: tokenBalance?.toString() || '0',
      });
      alert(`Insufficient ${tokenIn.symbol} balance.`);
      return;
    }

    try {
      // Refresh trade data right before swap to get latest price
      // This prevents slippage failures due to stale quotes
      console.log('Refreshing trade data before swap execution...');
      const feeTiers = [100, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH] as FeeAmount[];
      const freshTradeResult = await createTrade(tokenIn, tokenOut, amountIn, feeTiers);
      
      if (!freshTradeResult) {
        console.error('Failed to refresh trade data');
        alert('Failed to get fresh quote. Please try again.');
        return;
      }

      const { trade } = freshTradeResult;
      const slippageTolerance = new Percent(Math.floor(slippage * 100), 10000);
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

      // Double-check allowance with fresh trade amount (in case it's different)
      const freshRequiredAmount = BigInt(trade.inputAmount.quotient.toString());
      if (!allowance || allowance < freshRequiredAmount) {
        console.warn('Insufficient allowance after refreshing trade data, updating needsApproval state');
        setNeedsApproval(true);
        return;
      }

      if (!tokenBalance || tokenBalance < freshRequiredAmount) {
        console.error('Insufficient token balance for swap:', {
          required: freshRequiredAmount.toString(),
          available: tokenBalance?.toString() || '0',
        });
        alert(`Insufficient ${tokenIn.symbol} balance.`);
        return;
      }

      // Following the Uniswap V3 SDK docs: "Executing a trade"
      // Use SwapRouter.swapCallParameters to get the call parameters
      const options = {
        slippageTolerance,
        deadline: deadlineTimestamp,
        recipient: address,
      };

      // Get method parameters from SwapRouter
      // This handles all the complexity of constructing the swap call
      const methodParameters = SwapRouter.swapCallParameters([trade], options);

      // Calculate minimum amount out for debugging
      const amountOutMinimum = trade.minimumAmountOut(slippageTolerance);
      
      console.log('Swap execution details:', {
        inputAmount: trade.inputAmount.toExact(),
        outputAmount: trade.outputAmount.toExact(),
        minimumOutput: amountOutMinimum.toExact(),
        slippageTolerance: slippageTolerance.toFixed(),
        slippagePercent: `${slippage}%`,
        deadline: deadlineTimestamp,
        deadlineDate: new Date(deadlineTimestamp * 1000).toISOString(),
        currentTime: new Date().toISOString(),
        calldataLength: methodParameters.calldata.length,
        value: methodParameters.value,
        to: CONTRACTS.SwapRouter02,
        allowance: allowance?.toString(),
        balance: tokenBalance?.toString(),
        requiredAmount: freshRequiredAmount.toString(),
      });

      // Verify we have sufficient allowance and balance one more time
      if (!allowance || allowance < freshRequiredAmount) {
        console.error('Insufficient allowance at execution time:', {
          allowance: allowance?.toString(),
          required: freshRequiredAmount.toString(),
        });
        alert(`Insufficient ${tokenIn.symbol} allowance. Please approve first.`);
        setNeedsApproval(true);
        return;
      }

      if (!tokenBalance || tokenBalance < freshRequiredAmount) {
        console.error('Insufficient balance at execution time:', {
          balance: tokenBalance?.toString(),
          required: freshRequiredAmount.toString(),
        });
        alert(`Insufficient ${tokenIn.symbol} balance.`);
        return;
      }

      // Use the calldata directly from SwapRouter
      // This is the recommended approach as it handles all edge cases
      try {
        sendSwapTransaction({
          to: CONTRACTS.SwapRouter02 as `0x${string}`,
          data: methodParameters.calldata as `0x${string}`,
          value: methodParameters.value ? BigInt(methodParameters.value) : undefined,
        });
        
        console.log('Swap transaction sent successfully');
      } catch (sendError) {
        console.error('Error sending swap transaction:', sendError);
        alert('Failed to send swap transaction. Please check your wallet and try again.');
        return;
      }
    } catch (error) {
      console.error('Swap error:', error);
      // Log more details
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      alert('Swap failed. Please try again.');
    }
  };

  if (!isConnected) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
      >
        Connect Wallet
      </button>
    );
  }

  if (!tokenIn || !tokenOut) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
      >
        Select Tokens
      </button>
    );
  }

  if (!amountIn || parseFloat(amountIn) <= 0) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
      >
        Enter Amount
      </button>
    );
  }

  if (isQuoteLoading) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
      >
        Fetching Quote...
      </button>
    );
  }

  // Only require quote - tradeData will be fetched when quote is available
  // But we can proceed with just quote for now, tradeData is only needed for swap execution
  if (!quote) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
      >
        No Route Found
      </button>
    );
  }

  // If we have a quote but no tradeData yet, show loading
  if (!tradeData) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
      >
        Preparing Swap...
      </button>
    );
  }

  if (needsApproval && !isApproving && !isApprovingTx) {
    return (
      <button
        onClick={handleApprove}
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
      >
        Approve {tokenIn.symbol}
      </button>
    );
  }

  if (isApproving || isApprovingTx) {
    return (
      <button
        disabled
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold cursor-not-allowed opacity-50"
      >
        Approving...
      </button>
    );
  }

  if (isSwapping) {
    return (
      <button
        disabled
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold cursor-not-allowed opacity-50"
      >
        Swapping...
      </button>
    );
  }

  return (
    <button
      onClick={handleSwap}
      className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
    >
      Swap
    </button>
  );
}
