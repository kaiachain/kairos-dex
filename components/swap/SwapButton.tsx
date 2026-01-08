'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSendTransaction, usePublicClient } from 'wagmi';
import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits, formatUnits } from '@/lib/utils';
import { erc20Abi } from 'viem';
import { Loader2 } from 'lucide-react';
import { getAddress, isAddress } from 'viem';
import { JsonRpcProvider } from '@ethersproject/providers';
import { RPC_URL } from '@/config/env';
import { getRouterRoute } from '@/hooks/useSwapQuote';

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
  const publicClient = usePublicClient();
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
      const errorMessage = String(sendSwapError?.message || sendSwapError || '');
      if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
        console.log('User rejected the transaction');
      } else if (errorMessage.includes('insufficient funds')) {
        console.error('Insufficient funds for gas');
      }
    }
    
    if (swapHash && (isSwapError || swapReceiptError) && publicClient) {
      const fetchRevertReason = async () => {
        try {
          console.log('Fetching transaction receipt to get revert reason...');
          const receipt = await publicClient.getTransactionReceipt({ hash: swapHash });
          
          if (receipt.status === 'reverted') {
            console.error('Transaction reverted on-chain. Receipt:', receipt);
            console.error(`Transaction hash: ${swapHash}`);
            console.error(`Block explorer: https://kairos.kaiascan.io/tx/${swapHash}`);
          }
        } catch (receiptError) {
          console.error('Error fetching transaction receipt:', receiptError);
        }
      };
      
      fetchRevertReason();
    }
    
    if (swapReceiptError) {
      console.error('Swap receipt error:', swapReceiptError);
      const errorMessage = String(swapReceiptError?.message || swapReceiptError || '');
      
      if (swapHash) {
        alert(`Swap failed: ${errorMessage}\n\nTransaction hash: ${swapHash}\n\nCheck the block explorer for more details:\nhttps://kairos.kaiascan.io/tx/${swapHash}`);
      } else {
        alert(`Swap failed: ${errorMessage}\n\nCheck console for detailed error information.`);
      }
    }
  }, [sendSwapError, swapReceiptError, isSwapError, publicClient, swapHash]);

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

  /**
   * Execute swap using Smart Order Router
   * Following execute-swap-sdk.js pattern
   */
  const handleSwap = async () => {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut || !address || !quote) return;

    // Validate balance
    const requiredAmount = parseUnits(amountIn, tokenIn.decimals);
    if (!tokenBalance || tokenBalance < requiredAmount) {
      const balanceFormatted = tokenBalance ? formatUnits(tokenBalance, tokenIn.decimals) : '0';
      const requiredFormatted = formatUnits(requiredAmount, tokenIn.decimals);
      alert(`Insufficient ${tokenIn.symbol} balance. Required: ${requiredFormatted}, Available: ${balanceFormatted}`);
      return;
    }

    // Validate allowance
    if (!allowance || allowance < requiredAmount) {
      const allowanceFormatted = allowance ? formatUnits(allowance, tokenIn.decimals) : '0';
      const requiredFormatted = formatUnits(requiredAmount, tokenIn.decimals);
      alert(`Insufficient token allowance. Required: ${requiredFormatted}, Approved: ${allowanceFormatted}. Please approve more tokens.`);
      setNeedsApproval(true);
      return;
    }

    try {
      // Create provider from RPC URL
      const provider = new JsonRpcProvider(RPC_URL);

      // Get route from router (following execute-swap-sdk.js)
      console.log('Getting route from Smart Order Router...');
      const routeResult = await getRouterRoute(
        tokenIn,
        tokenOut,
        amountIn,
        slippage,
        deadline,
        address,
        provider
      );

      if (!routeResult || !routeResult.methodParameters) {
        console.error('No route found from router');
        alert('No route found. Please try again.');
        return;
      }

      console.log(`Route found: ${routeResult.quote.toExact()} ${tokenOut.symbol}`);

      // Get fee data for transaction
      const feeData = await provider.getFeeData();

      // Send transaction using method parameters from router
      // Following execute-swap-sdk.js: "Finally, we can construct a transaction from the method parameters"
      console.log('Sending swap transaction...');
      sendSwapTransaction({
        to: CONTRACTS.SwapRouter02 as `0x${string}`,
        data: routeResult.methodParameters.calldata as `0x${string}`,
        value: routeResult.methodParameters.value ? BigInt(routeResult.methodParameters.value) : undefined,
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
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
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
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold cursor-not-allowed opacity-50 flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Approving...
      </button>
    );
  }

  if (isSwapping) {
    return (
      <button
        disabled
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold cursor-not-allowed opacity-50 flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
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
