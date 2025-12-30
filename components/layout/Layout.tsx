'use client';

import { Header } from './Header';
import { Footer } from './Footer';
import { Navigation } from './Navigation';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Navigation />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

