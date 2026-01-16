import { useEffect, useRef } from 'react';
import { showToast } from '@/lib/showToast';
import { formatAddress } from '@/lib/utils';
import { CHAIN_NAME } from '@/config/env';
import { WalletConnectionState } from '@/types/wallet';

/**
 * Hook to manage wallet connection toast notifications
 */
export function useConnectionToasts({
  isConnected,
  isConnecting,
  isReconnecting,
  address,
  error,
  mounted,
}: WalletConnectionState & { mounted: boolean }) {
  const userInitiatedConnectionRef = useRef(false);
  const previousConnectedRef = useRef(false);

  // Track connection state changes and show success toast only for user-initiated connections
  useEffect(() => {
    if (!mounted) return;

    // If we just became connected and it was a user-initiated connection
    if (isConnected && !previousConnectedRef.current && userInitiatedConnectionRef.current) {
      // Small delay to ensure the connection is fully established and address is available
      setTimeout(() => {
        if (address) {
          showToast({
            type: 'success',
            title: 'Wallet connected successfully',
            description: `Connected: ${formatAddress(address)}`,
            autoClose: 3000,
          });
        } else {
          showToast({
            type: 'success',
            title: 'Wallet connected successfully',
            autoClose: 3000,
          });
        }
        userInitiatedConnectionRef.current = false;
      }, 300);
    }

    // Update previous state
    previousConnectedRef.current = isConnected;

    // Reset flag if connection fails or is disconnected
    if (!isConnected && !isConnecting) {
      userInitiatedConnectionRef.current = false;
    }
  }, [isConnected, isConnecting, mounted, address]);

  // Show error toasts
  useEffect(() => {
    if (error && mounted) {
      showToast({
        type: 'error',
        title: 'Wallet Connection Error',
        description: error.message || 'Failed to connect wallet',
        autoClose: 5000,
      });
      // Reset flag on error
      userInitiatedConnectionRef.current = false;
    }
  }, [error, mounted]);

  // Show reconnecting status (only for auto-reconnects, not user-initiated)
  useEffect(() => {
    if (isReconnecting && mounted && !userInitiatedConnectionRef.current) {
      showToast({
        type: 'info',
        title: 'Reconnecting to wallet...',
        autoClose: 3000,
      });
    }
  }, [isReconnecting, mounted]);

  return {
    markUserInitiated: () => {
      userInitiatedConnectionRef.current = true;
    },
    resetUserInitiated: () => {
      userInitiatedConnectionRef.current = false;
    },
  };
}
