'use client';

import { Header } from './Header';
import { Footer } from './Footer';
import { WalletConnectionGuard } from '../wallet/WalletConnectionGuard';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <WalletConnectionGuard />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

