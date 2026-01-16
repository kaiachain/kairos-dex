'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/config/wagmi';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SwapStatusProvider } from '@/contexts/SwapStatusContext';
import { ToastThemedContainer } from '@/components/common/ToastThemedContainer';
import { WalletConnectionMonitor } from '@/components/wallet/WalletConnectionMonitor';
import { useState, useEffect } from 'react';
import { setGlobalSwapStatusHandler } from '@/contexts/SwapStatusContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <SwapStatusProvider>
            <SwapStatusHandler />
            <WalletConnectionMonitor />
            {children}
            {/* Main toast container */}
            <ToastThemedContainer />
            {/* Optional: Special containers for specific pages */}
            <ToastThemedContainer containerId="claim" />
            <ToastThemedContainer containerId="scanner" />
          </SwapStatusProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

// Component to set up global handler for backward compatibility
function SwapStatusHandler() {
  const { addMessage } = require('@/contexts/SwapStatusContext').useSwapStatus();
  
  useEffect(() => {
    setGlobalSwapStatusHandler(addMessage);
  }, [addMessage]);

  return null;
}
