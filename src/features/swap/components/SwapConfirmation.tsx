
import { CheckCircle2, ExternalLink, X } from 'lucide-react';
import { Token } from '@/types/token';
import { formatBalance } from '@/lib/utils';
import { BLOCK_EXPLORER_URL } from '@/config/env';

interface SwapConfirmationProps {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
  transactionHash: string;
  onClose: () => void;
}

export function SwapConfirmation({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  transactionHash,
  onClose,
}: SwapConfirmationProps) {
  const explorerUrl = `${BLOCK_EXPLORER_URL}/tx/${transactionHash}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card rounded-3xl shadow-lg max-w-md w-full p-6 border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-text-primary">Swap Successful</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-bg rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
        </div>

        {/* Swap Details */}
        <div className="space-y-4 mb-6">
          <div className="bg-gray-50 dark:bg-input-bg rounded-2xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-secondary">You paid</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-text-primary">{formatBalance(amountIn, 6)}</span>
              <span className="text-lg text-text-secondary">{tokenIn.symbol}</span>
            </div>
          </div>

          <div className="flex justify-center -my-2">
            <div className="bg-gray-200 dark:bg-bg rounded-full p-1.5">
              <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-input-bg rounded-2xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-secondary">You received</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-success">
                {formatBalance(amountOut, 6)}
              </span>
              <span className="text-lg text-text-secondary">{tokenOut.symbol}</span>
            </div>
          </div>
        </div>

        {/* Transaction Link */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-input-bg rounded-xl border border-border mb-6">
          <span className="text-sm text-text-secondary">Transaction</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:opacity-80 hover:underline"
          >
            <span className="font-mono text-xs">
              {transactionHash.slice(0, 6)}...{transactionHash.slice(-4)}
            </span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-primary text-bg rounded-2xl font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-lg"
        >
          Close
        </button>
      </div>
    </div>
  );
}
