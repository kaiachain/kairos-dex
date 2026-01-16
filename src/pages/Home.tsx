import { SwapInterface } from '@/components/swap/SwapInterface';
import { Layout } from '@/components/layout/Layout';

export default function Home() {
  return (
    <Layout>
      <div className="relative min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Background gradient shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="bg-shape bg-shape-1" />
          <div className="bg-shape bg-shape-2" />
          <div className="bg-shape bg-shape-3" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-[420px] space-y-8">
          {/* Swap Interface Card */}
          <div className="relative">
            <SwapInterface />
          </div>

          {/* Subtitle */}
          <p className="text-center text-text-secondary text-sm">
            Trade tokens on Kaia Testnet - Built for developers to test and experiment with DeFi protocols.
          </p>
        </div>
      </div>
    </Layout>
  );
}
