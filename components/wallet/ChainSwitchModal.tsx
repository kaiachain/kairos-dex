
import { RefreshCw, X } from 'lucide-react';
import { useRef, useEffect } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { CHAIN_NAME } from '@/config/env';
import { cn } from '@/lib/utils';

interface ChainSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchChain: () => Promise<void>;
  currentChainId?: number;
  isSwitching: boolean;
}

export function ChainSwitchModal({
  isOpen,
  onClose,
  onSwitchChain,
  currentChainId,
  isSwitching,
}: ChainSwitchModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, (event) => {
    if (isOpen && !isSwitching) {
      onClose();
    }
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSwitchChain = async () => {
    try {
      await onSwitchChain();
    } catch (error) {
      console.error('Chain switch error:', error);
    }
  };

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center backdrop-blur-sm bg-black/60 animate-fade-in">
      <div
        ref={modalRef}
        className="mx-4 w-full max-w-sm bg-white rounded-2xl border shadow-2xl dark:bg-input-bg border-border animate-scale-in"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-text-primary">Wrong Network</h2>
            {!isSwitching && (
              <button
                onClick={onClose}
                className="flex justify-center items-center w-8 h-8 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-bg text-text-secondary hover:text-text-primary"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Message */}
          <p className="mb-6 text-sm text-text-secondary">
            Please switch to <span className="font-medium text-text-primary">{CHAIN_NAME}</span> to continue.
          </p>

          {/* Action Button */}
          <button
            onClick={handleSwitchChain}
            disabled={isSwitching}
            className={cn(
              "w-full flex justify-center items-center space-x-2 px-4 py-3 font-medium rounded-lg transition-opacity",
              "bg-primary text-bg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSwitching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Switching...</span>
              </>
            ) : (
              <span>Switch Network</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
