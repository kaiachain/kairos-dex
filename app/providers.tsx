'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/config/wagmi';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastThemedContainer } from '@/components/common/ToastThemedContainer';
import { WalletConnectionMonitor } from '@/components/wallet/WalletConnectionMonitor';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <WalletConnectionMonitor />
          {children}
          {/* Main toast container */}
          <ToastThemedContainer />
          {/* Optional: Special containers for specific pages */}
          <ToastThemedContainer containerId="claim" />
          <ToastThemedContainer containerId="scanner" />
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

