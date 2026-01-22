
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Token } from '@/shared/types/token';
import { SwapQuote } from '@/features/swap/types/swap';
import { useSwapExecution, SwapStatus } from '@/features/swap/hooks/useSwapExecution';
import { NoRouteFound } from './NoRouteFound';
import { RouteDiagnostic } from '@/features/swap/services/routeDiagnostics';

interface SwapButtonProps {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  slippage: number;
  deadline: number;
  quote: SwapQuote | null;
  isQuoteLoading: boolean;
  cachedRoute?: any; // Optional cached route for faster execution
  routeDiagnostic?: RouteDiagnostic | null; // Diagnostic info when route not found
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
  cachedRoute,
  routeDiagnostic,
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
    cachedRoute,
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
        className="w-full py-4 bg-secondary text-text-secondary rounded-2xl font-semibold cursor-not-allowed"
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
        className="w-full py-4 bg-secondary text-text-secondary rounded-2xl font-semibold cursor-not-allowed"
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
        className="w-full py-4 bg-secondary text-text-secondary rounded-2xl font-semibold cursor-not-allowed"
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
        className="w-full py-4 bg-secondary text-text-secondary rounded-2xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Fetching Quote...
      </button>
    );
  }

  // No quote available - show diagnostic if available
  if (!quote && !isQuoteLoading && tokenIn && tokenOut) {
    return (
      <NoRouteFound
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        diagnostic={routeDiagnostic || null}
        onRetry={() => {
          // Trigger refetch by updating amount (this will cause useSwapQuote to refetch)
          // The parent component should handle this, but we can at least show the button
        }}
      />
    );
  }

  // Error state
  if (error || status === 'error') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-3 bg-error/20 rounded-lg text-error text-sm border border-error/40">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error?.message || 'An error occurred'}</span>
        </div>
        {needsApproval ? (
          <button
            onClick={approve}
            className="w-full py-4 bg-primary text-bg rounded-2xl font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-lg"
          >
            Approve {tokenIn.symbol}
          </button>
        ) : (
          <button
            onClick={executeSwap}
            className="w-full py-4 bg-primary text-bg rounded-2xl font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-lg"
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
        className="w-full py-4 bg-primary text-bg rounded-2xl font-semibold cursor-not-allowed opacity-75 flex items-center justify-center gap-2"
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
        className="w-full py-4 bg-primary text-bg rounded-2xl font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-lg"
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
        className="w-full py-4 bg-primary text-bg rounded-2xl font-semibold cursor-not-allowed opacity-75 flex items-center justify-center gap-2"
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
        className="w-full py-4 bg-primary text-bg rounded-2xl font-semibold cursor-not-allowed opacity-75 flex items-center justify-center gap-2"
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
        className="w-full py-4 bg-success text-bg rounded-2xl font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
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
        className="w-full py-4 bg-primary text-bg rounded-2xl font-semibold cursor-not-allowed opacity-75 flex items-center justify-center gap-2"
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
        className="w-full py-4 bg-primary text-bg rounded-2xl font-semibold cursor-not-allowed opacity-75 flex items-center justify-center gap-2"
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
        className="w-full py-4 bg-success text-bg rounded-2xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
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
        <div className="bg-primary/20 rounded-lg p-3 border border-primary/40">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-text-primary">
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
        className="w-full py-4 bg-primary text-bg rounded-2xl font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-lg"
      >
        Swap
      </button>
    </div>
  );
}
