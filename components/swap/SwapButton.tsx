'use client';

import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { useSwapExecution, SwapStatus } from '@/hooks/useSwapExecution';

interface SwapButtonProps {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  slippage: number;
  deadline: number;
  quote: SwapQuote | null;
  isQuoteLoading: boolean;
  onSwapSuccess?: (hash: string) => void;
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
  onSwapSuccess,
}: SwapButtonProps) {
  const {
    needsApproval,
    isApproving,
    isSwapping,
    isPreparingSwap,
    status,
    isConnected,
    error,
    approve,
    executeSwap,
    approveHash,
    swapHash,
    isSwapConfirmed,
  } = useSwapExecution({
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    slippage,
    deadline,
    quote,
    onSwapSuccess: onSwapSuccess ? ((hash: string) => onSwapSuccess(hash)) : undefined,
  });

  // Show status indicator above button - use type assertion to avoid narrowing issues
  const currentStatus = status as SwapStatus;
  const showStatusIndicator = 
    currentStatus === 'fetching_quote' ||
    currentStatus === 'approval_needed' ||
    currentStatus === 'approving' ||
    currentStatus === 'approval_pending' ||
    currentStatus === 'approval_confirmed' ||
    currentStatus === 'preparing_swap' ||
    currentStatus === 'swapping' ||
    currentStatus === 'swap_pending' ||
    currentStatus === 'swap_confirmed';

  // Not connected
  if (!isConnected) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-200 dark:bg-uniswap-dark-600 text-gray-500 dark:text-gray-400 rounded-2xl font-semibold cursor-not-allowed"
      >
        Connect Wallet
      </button>
    );
  }

  // No tokens selected
  if (!tokenIn || !tokenOut) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-200 dark:bg-uniswap-dark-600 text-gray-500 dark:text-gray-400 rounded-2xl font-semibold cursor-not-allowed"
      >
        Select Tokens
      </button>
    );
  }

  // No amount entered
  if (!amountIn || parseFloat(amountIn) <= 0) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-200 dark:bg-uniswap-dark-600 text-gray-500 dark:text-gray-400 rounded-2xl font-semibold cursor-not-allowed"
      >
        Enter Amount
      </button>
    );
  }

  // Loading quote
  if (isQuoteLoading) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-200 dark:bg-uniswap-dark-600 text-gray-500 dark:text-gray-400 rounded-2xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Fetching Quote...
      </button>
    );
  }

  // No quote available
  if (!quote) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-200 dark:bg-uniswap-dark-600 text-gray-500 dark:text-gray-400 rounded-2xl font-semibold cursor-not-allowed"
      >
        No Route Found
      </button>
    );
  }

  // Error state
  if (error || status === 'error') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-800 dark:text-red-200 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error?.message || 'An error occurred'}</span>
        </div>
        {needsApproval ? (
          <button
            onClick={approve}
            className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl font-semibold hover:from-primary-700 hover:to-primary-600 transition-all shadow-md hover:shadow-lg"
          >
            Approve {tokenIn.symbol}
          </button>
        ) : (
          <button
            onClick={executeSwap}
            className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl font-semibold hover:from-primary-700 hover:to-primary-600 transition-all shadow-md hover:shadow-lg"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // Preparing swap (getting route)
  if (isPreparingSwap || status === 'preparing_swap') {
    return (
      <button
        disabled
        className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl font-semibold cursor-not-allowed opacity-75 flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Preparing Swap...
      </button>
    );
  }

  // Needs approval
  if (needsApproval && !isApproving && status !== 'approval_pending' && status !== 'approval_confirmed') {
    return (
      <button
        onClick={approve}
        className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl font-semibold hover:from-primary-700 hover:to-primary-600 transition-all shadow-md hover:shadow-lg"
      >
        Approve {tokenIn.symbol}
      </button>
    );
  }

  // Approving (waiting for user confirmation)
  if (status === 'approving') {
    return (
      <button
        disabled
        className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl font-semibold cursor-not-allowed opacity-75 flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Confirm Approval in Wallet
      </button>
    );
  }

  // Approval pending (transaction sent, waiting for confirmation)
  if (status === 'approval_pending' && approveHash) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl font-semibold cursor-not-allowed opacity-75 flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Approving... (Confirming)
      </button>
    );
  }

  // Approval confirmed
  if (status === 'approval_confirmed') {
    return (
      <button
        onClick={executeSwap}
        className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-2xl font-semibold hover:from-green-700 hover:to-green-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="w-5 h-5" />
        Approval Confirmed - Swap Now
      </button>
    );
  }

  // Swapping (waiting for user confirmation)
  if (status === 'swapping') {
    return (
      <button
        disabled
        className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl font-semibold cursor-not-allowed opacity-75 flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Confirm Swap in Wallet
      </button>
    );
  }

  // Swap pending (transaction sent, waiting for confirmation)
  if (status === 'swap_pending' && swapHash) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl font-semibold cursor-not-allowed opacity-75 flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Swapping... (Confirming)
      </button>
    );
  }

  // Swap confirmed
  if (status === 'swap_confirmed') {
    return (
      <button
        disabled
        className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-2xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="w-5 h-5" />
        Swap Confirmed!
      </button>
    );
  }

  // Ready to swap
  return (
    <div className="space-y-2">
      {showStatusIndicator && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-blue-800 dark:text-blue-200">
              {(() => {
                switch (currentStatus) {
                  case 'fetching_quote':
                    return 'Fetching best quote...';
                  case 'approval_needed':
                    return `Approval needed for ${tokenIn?.symbol}`;
                  case 'approving':
                  case 'approval_pending':
                    return 'Approval transaction pending...';
                  case 'approval_confirmed':
                    return 'Approval confirmed! Ready to swap.';
                  case 'preparing_swap':
                    return 'Preparing swap route...';
                  case 'swapping':
                  case 'swap_pending':
                    return 'Swap transaction pending...';
                  case 'swap_confirmed':
                    return 'Swap confirmed!';
                  default:
                    return '';
                }
              })()}
            </span>
          </div>
        </div>
      )}
      <button
        onClick={executeSwap}
        className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl font-semibold hover:from-primary-700 hover:to-primary-600 transition-all shadow-md hover:shadow-lg"
      >
        Swap
      </button>
    </div>
  );
}
