'use client';

import { LogOut, Copy, ExternalLink, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { formatAddress, formatBalance } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { BLOCK_EXPLORER_URL, CHAIN_NAME } from '@/config/env';
import { WalletConnectionState } from '@/types/wallet';
import { useState } from 'react';

interface WalletMenuProps {
  isOpen: boolean;
  onClose: () => void;
  address: `0x${string}` | undefined;
  balance: bigint | undefined;
  isCorrectChain: boolean;
  isReconnecting: boolean;
  error: Error | null;
  onCopy: () => void;
  onDisconnect: () => Promise<void>;
  onSwitchChain: () => Promise<void>;
  onRetryConnection: () => Promise<void>;
  copied: boolean;
}

export function WalletMenu({
  isOpen,
  onClose,
  address,
  balance,
  isCorrectChain,
  isReconnecting,
  error,
  onCopy,
  onDisconnect,
  onSwitchChain,
  onRetryConnection,
  copied,
}: WalletMenuProps) {
  if (!isOpen || !address) return null;

  const explorerUrl = `${BLOCK_EXPLORER_URL}/account/${address}`;

  return (
    <div className="overflow-hidden absolute right-0 z-50 mt-2 w-72 bg-white rounded-2xl border shadow-lg dark:bg-input-bg border-border animate-fade-in">
      <div className="p-4 border-b border-border">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold tracking-wide uppercase text-text-secondary">
            {isReconnecting ? 'Reconnecting...' : 'Connected'}
          </span>
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isReconnecting ? 'animate-pulse bg-warning' : 'bg-success'
            )}
          />
        </div>
        <div className="px-3 py-2 font-mono text-sm break-all bg-gray-50 rounded-lg border text-text-primary dark:bg-bg border-border">
          {address}
        </div>
        {!isCorrectChain && (
          <div className="p-3 mt-3 rounded-lg border bg-warning/10 border-warning/20">
            <div className="flex items-center mb-2 space-x-2 text-sm font-medium text-warning">
              <AlertCircle className="w-4 h-4" />
              <span>Wrong Network</span>
            </div>
            <button
              onClick={onSwitchChain}
              className="px-3 py-2 w-full text-sm font-medium rounded-lg transition-opacity bg-warning text-bg hover:opacity-90"
            >
              Switch to {CHAIN_NAME}
            </button>
          </div>
        )}
      </div>

      <div className="p-2">
        <button
          onClick={onCopy}
          className="flex justify-between items-center px-4 py-3 w-full text-sm rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-bg text-text-primary"
        >
          <div className="flex items-center space-x-3">
            <div className="flex justify-center items-center w-8 h-8 bg-gray-100 rounded-lg dark:bg-bg">
              <Copy className="w-4 h-4" />
            </div>
            <span className="font-medium">{copied ? 'Copied!' : 'Copy Address'}</span>
          </div>
          {copied && <Check className="w-4 h-4 text-success" />}
        </button>

        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center px-4 py-3 space-x-3 w-full text-sm rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-bg text-text-primary"
        >
          <div className="flex justify-center items-center w-8 h-8 bg-gray-100 rounded-lg dark:bg-bg">
            <ExternalLink className="w-4 h-4" />
          </div>
          <span className="font-medium">View on Explorer</span>
        </a>

        {balance !== undefined && (
          <div className="px-4 py-3 text-sm">
            <div className="mb-1 text-xs text-text-secondary">Balance</div>
            <div className="font-semibold text-text-primary">{formatBalance(Number(balance) / 1e18, 4)} KAIA</div>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 mb-2">
            <div className="p-3 rounded-lg border bg-error/10 border-error/20">
              <div className="flex items-center mb-2 space-x-2 text-xs text-error">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Connection Error</span>
              </div>
              <p className="mb-2 text-xs text-text-secondary">{error.message}</p>
              <button
                onClick={onRetryConnection}
                className="flex justify-center items-center px-3 py-2 space-x-2 w-full text-xs font-medium rounded-lg transition-opacity bg-error text-bg hover:opacity-90"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Connection</span>
              </button>
            </div>
          </div>
        )}

        <div className="my-2 border-t border-border" />

        <button
          onClick={onDisconnect}
          disabled={isReconnecting}
          className="flex items-center px-4 py-3 space-x-3 w-full text-sm rounded-xl transition-colors text-error hover:opacity-80 disabled:opacity-50"
        >
          <div className="flex justify-center items-center w-8 h-8 rounded-lg bg-error/20">
            <LogOut className="w-4 h-4" />
          </div>
          <span className="font-medium">Disconnect</span>
        </button>
      </div>
    </div>
  );
}
