import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/config/wagmi';
import { ThemeProvider } from './providers/contexts/ThemeContext';
import { SwapStatusProvider } from './providers/contexts/SwapStatusContext';
import { ToastThemedContainer } from '@/shared/components/ToastThemedContainer';
import { WalletConnectionMonitor } from '@/features/wallet/components/WalletConnectionMonitor';
import { useState, useEffect } from 'react';
import { setGlobalSwapStatusHandler } from './providers/contexts/SwapStatusContext';
import { useSwapStatus } from './providers/contexts/SwapStatusContext';

// Query key factories for consistent caching
export const queryKeys = {
  pools: {
    all: ['pools'] as const,
    lists: () => [...queryKeys.pools.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.pools.lists(), filters] as const,
    details: () => [...queryKeys.pools.all, 'detail'] as const,
    detail: (address: string) => [...queryKeys.pools.details(), address] as const,
  },
  positions: {
    all: ['positions'] as const,
    lists: () => [...queryKeys.positions.all, 'list'] as const,
    list: (owner: string) => [...queryKeys.positions.lists(), owner] as const,
    details: () => [...queryKeys.positions.all, 'detail'] as const,
    detail: (tokenId: string) => [...queryKeys.positions.details(), tokenId] as const,
  },
  protocol: {
    stats: ['protocol', 'stats'] as const,
  },
};

// Configure QueryClient with optimal defaults
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes (subgraph queries)
        staleTime: 5 * 60 * 1000,
        // Cache data for 10 minutes after it becomes unused
        gcTime: 10 * 60 * 1000,
        // Don't refetch on window focus for better UX
        refetchOnWindowFocus: false,
        // Retry failed requests 2 times with exponential backoff
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Network mode for offline support
        networkMode: 'online',
      },
      mutations: {
        // Retry mutations once
        retry: 1,
        networkMode: 'online',
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

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

// Component to set up global handler
function SwapStatusHandler() {
  const { addMessage } = useSwapStatus();
  
  useEffect(() => {
    setGlobalSwapStatusHandler(addMessage);
  }, [addMessage]);

  return null;
}
