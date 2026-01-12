'use client';

import { Layout } from '@/components/layout/Layout';
import { PoolExplorer } from '@/components/pools/PoolExplorer';
import { CreatePool } from '@/components/pools/CreatePool';
import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';

export default function PoolsPage() {
  const [showCreatePool, setShowCreatePool] = useState(false);

  return (
    <Layout>
      {showCreatePool ? (
        <div className="relative min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-4 overflow-hidden">
          {/* Background gradient shapes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="bg-shape bg-shape-1" />
            <div className="bg-shape bg-shape-2" />
            <div className="bg-shape bg-shape-3" />
          </div>

          {/* Create Pool Content */}
          <div className="relative z-10 w-full max-w-[420px] space-y-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-text-primary">Create Pool</h1>
              <button
                onClick={() => setShowCreatePool(false)}
                className="flex items-center gap-2 px-4 py-2 border-2 border-border text-text-primary rounded-lg hover:bg-gray-50 dark:hover:bg-input-bg hover:border-primary transition-all font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Browse Pools</span>
              </button>
            </div>
            <CreatePool />
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-text-primary">Pools</h1>
            <button
              onClick={() => setShowCreatePool(true)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-border text-text-primary rounded-lg hover:bg-gray-50 dark:hover:bg-input-bg hover:border-primary transition-all font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Create Pool</span>
            </button>
          </div>
          <PoolExplorer />
        </div>
      )}
    </Layout>
  );
}

