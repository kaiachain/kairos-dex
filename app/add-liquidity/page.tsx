'use client';

import { Layout } from '@/components/layout/Layout';
import { AddLiquidity } from '@/components/liquidity/AddLiquidity';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function AddLiquidityPage() {
  const router = useRouter();

  return (
    <Layout>
      <div className="relative min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-4">
        {/* Content */}
        <div className="relative z-10 w-full max-w-[420px] space-y-8">
          <button
            onClick={() => router.back()}
            className="flex gap-2 items-center px-4 py-2 font-medium rounded-lg border-2 transition-all border-border text-text-primary hover:bg-gray-50 dark:hover:bg-input-bg hover:border-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <AddLiquidity fromPositionsPage={true} />
        </div>
      </div>
    </Layout>
  );
}
