import { SwapInterface } from '@/components/swap/SwapInterface';
import { Layout } from '@/components/layout/Layout';

export default function Home() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4 bg-gradient-to-b from-gray-50 to-white dark:from-uniswap-dark dark:to-uniswap-dark-800">
        <div className="w-full max-w-[420px]">
          <SwapInterface />
        </div>
      </div>
    </Layout>
  );
}

