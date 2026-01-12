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
          {/* Hero Title */}
          <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-text-primary leading-tight">
              Swap anytime, anywhere.
            </h1>
          </div>

          {/* Swap Interface Card */}
          <div className="relative">
            <SwapInterface />
          </div>

          {/* Subtitle */}
          <p className="text-center text-text-secondary text-sm">
            Buy and sell crypto on 16+ networks including Ethereum, Unichain, and Base.
          </p>
        </div>
      </div>
    </Layout>
  );
}

