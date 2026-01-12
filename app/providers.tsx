'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/config/wagmi';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

