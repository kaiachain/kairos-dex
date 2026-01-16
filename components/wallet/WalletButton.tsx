
import { Wallet, RefreshCw, AlertCircle, ChevronDown } from 'lucide-react';
import { formatAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { WalletConnectionState } from '@/types/wallet';

interface WalletButtonProps {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  address: `0x${string}` | undefined;
  isCorrectChain: boolean;
  showWalletMenu: boolean;
  mounted: boolean;
  onClick: () => void;
  onConnectClick: () => void;
}

export function WalletButton({
  isConnected,
  isConnecting,
  isReconnecting,
  address,
  isCorrectChain,
  showWalletMenu,
  mounted,
  onClick,
  onConnectClick,
}: WalletButtonProps) {
  if (!mounted) {
    return (
      <div className="flex items-center px-4 py-2 space-x-2 font-medium rounded-lg opacity-50 bg-primary text-bg">
        <Wallet className="w-4 h-4" />
        <span className="hidden sm:inline">Connect Wallet</span>
        <span className="sm:hidden">Connect</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex items-center px-4 py-2 space-x-2 font-medium rounded-lg transition-colors hover:opacity-90',
          isCorrectChain ? 'bg-primary text-bg' : 'bg-warning text-bg'
        )}
      >
        <Wallet className="w-4 h-4" />
        <span className="hidden sm:inline">{formatAddress(address || '')}</span>
        {!isCorrectChain && <AlertCircle className="w-4 h-4" />}
        <ChevronDown
          className={cn('w-4 h-4 transition-transform duration-200', showWalletMenu && 'rotate-180')}
        />
      </button>
    );
  }

  return (
    <button
      onClick={onConnectClick}
      disabled={isConnecting || isReconnecting}
      className={cn(
        'flex items-center space-x-2 px-4 py-2 bg-primary text-bg rounded-lg hover:opacity-90 transition-colors font-medium',
        (isConnecting || isReconnecting) && 'opacity-50 cursor-not-allowed'
      )}
    >
      {isConnecting || isReconnecting ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="hidden sm:inline">Connecting...</span>
          <span className="sm:hidden">Connecting...</span>
        </>
      ) : (
        <>
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">Connect Wallet</span>
          <span className="sm:hidden">Connect</span>
        </>
      )}
    </button>
  );
}
