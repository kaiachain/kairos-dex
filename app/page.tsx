import { SwapInterface } from '@/components/swap/SwapInterface';
import { Layout } from '@/components/layout/Layout';

export default function Home() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">
          <h1 className="text-4xl font-bold text-center mb-8">
            Uniswap V3 DEX
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
            Kairos Testnet
          </p>
          <SwapInterface />
        </div>
      </div>
    </Layout>
  );
}

