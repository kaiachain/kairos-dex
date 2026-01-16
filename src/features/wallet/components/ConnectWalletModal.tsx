
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, RefreshCw } from 'lucide-react';
import { WalletConnector } from '@/types/wallet';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import {
  getConnectorName,
  getConnectorIcon,
  getEmojiFallback,
  getConnectorDescription,
  filterUniqueConnectors,
} from '@/lib/wallet-utils';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectors: WalletConnector[];
  onConnect: (connector: WalletConnector) => Promise<void>;
  isConnecting: boolean;
}

export function ConnectWalletModal({
  isOpen,
  onClose,
  connectors,
  onConnect,
  isConnecting,
}: ConnectWalletModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useClickOutside(modalRef, (event) => {
    if (isOpen) {
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

  const uniqueConnectors = filterUniqueConnectors(connectors);

  const handleConnect = async (connector: WalletConnector) => {
    try {
      setConnectingId(connector.id);
      await onConnect(connector);
      onClose();
    } catch (error) {
      console.error('Connection error:', error);
      // Error is handled by the hook and will show toast
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center backdrop-blur-sm bg-black/60 animate-fade-in">
      <div
        ref={modalRef}
        className="mx-4 w-full max-w-md bg-white rounded-2xl border shadow-2xl dark:bg-input-bg border-border animate-scale-in"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-text-primary">Connect Wallet</h2>
            <button
              onClick={onClose}
              disabled={isConnecting}
              className="flex justify-center items-center w-8 h-8 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-bg text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mb-6 text-sm text-text-secondary">
            Connect your wallet to continue. By connecting, you agree to our Terms of Service.
          </p>

          <div className="space-y-2">
            {uniqueConnectors.map((connector) => {
              const isConnectingThis = connectingId === connector.id || (isConnecting && !connectingId);
              const walletName = getConnectorName(connector) || 'Wallet';
              const iconUrl = getConnectorIcon(connector);

              return (
                <button
                  key={connector.uid}
                  onClick={() => handleConnect(connector)}
                  disabled={isConnectingThis}
                  className="w-full flex items-center space-x-4 px-4 py-4 bg-gray-50 dark:bg-input-bg hover:bg-gray-100 dark:hover:bg-bg rounded-xl transition-all duration-200 border border-border hover:border-[color:var(--border-hover)] group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex overflow-hidden justify-center items-center w-10 h-10 bg-gray-200 rounded-lg transition-transform dark:bg-bg group-hover:scale-110">
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt={walletName}
                        className="w-full h-full object-contain p-1.5"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to emoji if image fails to load
                          const target = e.target as HTMLImageElement;
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.fallback-emoji')) {
                            target.style.display = 'none';
                            const fallback = document.createElement('div');
                            fallback.className = 'flex justify-center items-center text-2xl fallback-emoji';
                            fallback.textContent = getEmojiFallback(walletName);
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-2xl">{getEmojiFallback(walletName)}</span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-text-primary">{walletName}</div>
                    <div className="text-xs text-text-secondary">
                      {isConnectingThis ? 'Connecting...' : getConnectorDescription(connector)}
                    </div>
                  </div>
                  {isConnectingThis ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-text-secondary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-text-secondary rotate-[-90deg] group-hover:text-text-primary transition-colors" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-6 mt-6 border-t border-border">
            <p className="text-xs text-center text-text-secondary">
              New to Ethereum?{' '}
              <a
                href="https://ethereum.org/en/wallets/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-primary hover:opacity-80"
              >
                Learn more about wallets
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
