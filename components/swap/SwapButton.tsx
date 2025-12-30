'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits, formatUnits } from '@/lib/utils';
import { erc20Abi } from 'viem';
import { SwapRouter02_ABI } from '@/abis/SwapRouter02';

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

  const { writeContract: swap, data: swapHash } = useWriteContract();
  const { isLoading: isSwapping } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  // Check if approval is needed
  // This would typically check the allowance
  const checkApproval = async () => {
    if (!tokenIn || !amountIn || !address) return;
    // Implementation would check allowance here
    setNeedsApproval(true);
  };

  const handleApprove = async () => {
    if (!tokenIn || !amountIn) return;
    setIsApproving(true);
    try {
      approveToken({
        address: tokenIn.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [
          CONTRACTS.SwapRouter02 as `0x${string}`,
          parseUnits(amountIn, tokenIn.decimals),
        ],
      });
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut || !quote) return;

    const amountInWei = parseUnits(amountIn, tokenIn.decimals);
    const amountOutMin = parseUnits(
      (parseFloat(amountOut) * (1 - slippage / 100)).toString(),
      tokenOut.decimals
    );
    const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

    try {
      swap({
        address: CONTRACTS.SwapRouter02 as `0x${string}`,
        abi: SwapRouter02_ABI,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: tokenIn.address as `0x${string}`,
            tokenOut: tokenOut.address as `0x${string}`,
            fee: quote.fee || 3000,
            recipient: address!,
            deadline: BigInt(deadlineTimestamp),
            amountIn: amountInWei,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: BigInt(0),
          },
        ],
      });
    } catch (error) {
      console.error('Swap error:', error);
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

