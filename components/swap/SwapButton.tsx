'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSendTransaction } from 'wagmi';
import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from '@/lib/utils';
import { erc20Abi } from 'viem';
import { createUncheckedTradeFromQuote } from '@/lib/sdk-utils';
import { SwapRouter, SwapOptions } from '@uniswap/v3-sdk';
import { Percent } from '@uniswap/sdk-core';
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

  const { writeContract: approveToken, data: approveHash } = useWriteContract();
  const { isLoading: isApprovingTx } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { sendTransaction: sendSwapTransaction, data: swapHash, error: sendSwapError } = useSendTransaction();
  const { isLoading: isSwapping, isError: isSwapError, error: swapReceiptError } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  // Log swap errors
  useEffect(() => {
    if (sendSwapError) {
      console.error('Send swap transaction error:', sendSwapError);
    }
    if (swapReceiptError) {
      console.error('Swap receipt error:', swapReceiptError);
    }
    if (isSwapError) {
      console.error('Swap transaction failed - check transaction receipt for revert reason');
    }
  }, [sendSwapError, swapReceiptError, isSwapError]);

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


  // Check if approval is needed and validate balance
  useEffect(() => {
    if (!tokenIn || !amountIn) {
      setNeedsApproval(false);
      return;
    }

    // If allowance or tokenBalance haven't loaded yet, don't update needsApproval
    if (allowance === undefined || tokenBalance === undefined) {
      return;
    }

    const requiredAmount = parseUnits(amountIn, tokenIn.decimals);
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
      });
    }

    setNeedsApproval(!hasEnoughAllowance);
  }, [tokenIn, amountIn, allowance, tokenBalance]);

  const handleApprove = async () => {
    if (!tokenIn || !amountIn) return;
    setIsApproving(true);
    try {
      // Approve a bit more than needed to avoid needing re-approval for small amounts
      // Following the guide: "we must give the SwapRouter approval to spend our tokens"
      const amountInWei = parseUnits(amountIn, tokenIn.decimals);
      // Approve 110% of input amount to account for small variations
      const approveAmount = (amountInWei * BigInt(110)) / BigInt(100);

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
    if (!tokenIn || !tokenOut || !amountIn || !amountOut || !address || !quote) return;

    // Following the Uniswap V3 SDK docs: "Executing a Trade"
    // Step 1: Check token approval (already handled by needsApproval state)
    const requiredAmount = parseUnits(amountIn, tokenIn.decimals);

    if (!allowance || allowance < requiredAmount) {
      console.warn('Insufficient allowance detected');
      setNeedsApproval(true);
      return;
    }

    if (!tokenBalance || tokenBalance < requiredAmount) {
      console.error('Insufficient token balance for swap');
      alert(`Insufficient ${tokenIn.symbol} balance.`);
      return;
    }

    // Validate quote has required data
    if (!quote.fee || !quote.poolAddress) {
      console.error('Quote missing required data (fee or poolAddress)');
      alert('Invalid quote. Please try again.');
      return;
    }

    try {
      // Step 2: Get fresh quote from QuoterV2 and create unchecked trade
      // Following the docs: "Constructing a route from pool information" and "Constructing an unchecked trade"
      // IMPORTANT: Use QuoterV2 to get the most accurate quote right before execution
      // This simulates the actual swap execution and accounts for price impact
      console.log('Getting fresh quote from QuoterV2 right before execution...');
      
      // Import functions needed
      const { createUncheckedTradeFromQuote } = await import('@/lib/sdk-utils');
      const { FeeAmount } = await import('@uniswap/v3-sdk');
      
      // Get fresh quote using QuoterV2 (most accurate)
      // First, we need to find which fee tier and pool to use
      const { createTrade } = await import('@/lib/sdk-utils');
      const feeTiers = [100, 500, 3000, 10000] as FeeAmount[];
      
      // Get pool info to determine fee tier
      const poolInfoResult = await createTrade(
        tokenIn,
        tokenOut,
        amountIn,
        feeTiers
      );

      if (!poolInfoResult) {
        console.error('Failed to find pool for swap');
        alert('Failed to prepare swap. Please try again.');
        return;
      }

      const { fee, poolAddress: tradePoolAddress } = poolInfoResult;
      
      // Now get fresh quote from QuoterV2
      const { getQuoteFromQuoterV2 } = await import('@/hooks/useSwapQuote');
      const freshQuote = await getQuoteFromQuoterV2(
        tokenIn,
        tokenOut,
        amountIn,
        fee
      );

      if (!freshQuote) {
        console.error('Failed to get fresh quote from QuoterV2');
        alert('Failed to get quote. The pool may not have enough liquidity. Please try a smaller amount.');
        return;
      }

      // Convert quote amountOut to human-readable format
      const freshAmountOut = (Number(freshQuote.amountOut) / 10 ** tokenOut.decimals).toFixed(6);
      
      console.log('Fresh quote from QuoterV2:', {
        amountOut: freshAmountOut,
        amountOutRaw: freshQuote.amountOut.toString(),
        fee,
        poolAddress: tradePoolAddress,
      });

      // Create unchecked trade from the fresh QuoterV2 quote
      const tradeResult = await createUncheckedTradeFromQuote(
        tokenIn,
        tokenOut,
        amountIn,
        freshAmountOut,
        tradePoolAddress,
        fee
      );

      if (!tradeResult) {
        console.error('Failed to create unchecked trade from fresh quote');
        alert('Failed to prepare swap. Please try again.');
        return;
      }

      const { trade, route } = tradeResult;
      
      // Verify trade is valid
      if (!trade || !trade.inputAmount || !trade.outputAmount) {
        console.error('Invalid trade created');
        alert('Invalid trade. Please try again.');
        return;
      }
      
      // Verify output amount is reasonable (not zero or negative)
      if (trade.outputAmount.quotient.toString() === '0') {
        console.error('Trade output amount is zero');
        alert('Invalid trade output. Please try again.');
        return;
      }
      
      // Verify route is valid
      if (!route || route.pools.length === 0) {
        console.error('Trade has no valid route or pools');
        alert('No valid route found. Please try again.');
        return;
      }
      
      // Log pool information for debugging
      const firstPool = route.pools[0];
      console.log('Pool information:', {
        poolAddress: tradePoolAddress,
        token0: firstPool.token0.symbol,
        token1: firstPool.token1.symbol,
        fee: firstPool.fee,
        liquidity: firstPool.liquidity?.toString() || 'unknown',
      });

      // Step 3: Set swap options
      // Following the docs: "Executing a trade" - setting options
      // Add a buffer to slippage to account for rounding, price impact, and low liquidity
      // Error "uint(9)" means "Too much requested" - the actual output is less than minimum
      // We need a larger buffer for pools with low liquidity or high price impact
      const slippageWithBuffer = slippage + 1.0; // Add 1% buffer to handle price impact and rounding
      const slippageTolerance = new Percent(Math.floor(slippageWithBuffer * 100), 10000);
      
      // Calculate deadline: current timestamp + deadline minutes
      // Ensure deadline is at least 1 minute in the future to avoid expiration
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const deadlineTimestamp = currentTimestamp + Math.max(deadline * 60, 60); // At least 1 minute

      // Validate deadline is in the future
      if (deadlineTimestamp <= currentTimestamp) {
        console.error('Invalid deadline:', {
          currentTimestamp,
          deadlineTimestamp,
          deadlineMinutes: deadline,
        });
        alert('Invalid deadline. Please try again.');
        return;
      }

      const options: SwapOptions = {
        slippageTolerance,
        deadline: deadlineTimestamp,
        recipient: address,
      };
      
      console.log('Swap options:', {
        slippagePercent: `${slippage}%`,
        slippageWithBuffer: `${slippageWithBuffer}%`,
        slippageTolerance: slippageTolerance.toFixed(),
      });

      // Step 4: Get method parameters from SwapRouter
      // Following the docs: "Use the SwapRouter class... to get the associated call parameters"
      const methodParameters = SwapRouter.swapCallParameters([trade], options);

      // Calculate minimum amount out for verification
      const minimumAmountOut = trade.minimumAmountOut(slippageTolerance);
      
      // Verify deadline is included in the calldata
      // Decode to verify (for debugging)
      console.log('Swap execution details:', {
        inputAmount: trade.inputAmount.toExact(),
        inputAmountRaw: trade.inputAmount.quotient.toString(),
        outputAmount: trade.outputAmount.toExact(),
        outputAmountRaw: trade.outputAmount.quotient.toString(),
        minimumOutput: minimumAmountOut.toExact(),
        minimumOutputRaw: minimumAmountOut.quotient.toString(),
        tokenOutDecimals: trade.outputAmount.currency.decimals,
        slippageTolerance: slippageTolerance.toFixed(),
        slippagePercent: `${slippage}%`,
        deadline: deadlineTimestamp,
        deadlineDate: new Date(deadlineTimestamp * 1000).toISOString(),
        currentTimestamp,
        currentDate: new Date(currentTimestamp * 1000).toISOString(),
        timeUntilDeadline: deadlineTimestamp - currentTimestamp,
        calldataLength: methodParameters.calldata.length,
        calldataPreview: methodParameters.calldata.substring(0, 100) + '...',
        value: methodParameters.value,
        to: CONTRACTS.SwapRouter02,
      });

      // Validate minimum output amount is reasonable
      // It should be close to outputAmount * (1 - slippage)
      const expectedMinimum = parseFloat(trade.outputAmount.toExact()) * (1 - slippage / 100);
      const actualMinimum = parseFloat(minimumAmountOut.toExact());
      const difference = Math.abs(expectedMinimum - actualMinimum) / expectedMinimum;
      
      if (difference > 0.01) { // More than 1% difference
        console.warn('Warning: Minimum output amount calculation might be incorrect:', {
          expectedMinimum,
          actualMinimum,
          difference: `${(difference * 100).toFixed(2)}%`,
        });
      }

      // Step 5: Send transaction
      // Following the docs: "Finally, we can construct a transaction from the method parameters and send the transaction"
      sendSwapTransaction({
        to: CONTRACTS.SwapRouter02 as `0x${string}`,
        data: methodParameters.calldata as `0x${string}`,
        value: methodParameters.value ? BigInt(methodParameters.value) : undefined,
      });

      console.log('Swap transaction sent successfully');
    } catch (error) {
      console.error('Swap error:', error);
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
