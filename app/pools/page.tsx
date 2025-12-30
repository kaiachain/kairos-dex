'use client';

import { Layout } from '@/components/layout/Layout';
import { PoolExplorer } from '@/components/pools/PoolExplorer';
import { CreatePool } from '@/components/pools/CreatePool';
import { useState } from 'react';

export default function PoolsPage() {
  const [showCreatePool, setShowCreatePool] = useState(false);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Pools</h1>
          <button
            onClick={() => setShowCreatePool(!showCreatePool)}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {showCreatePool ? 'Browse Pools' : 'Create Pool'}
          </button>
        </div>

        {showCreatePool ? <CreatePool /> : <PoolExplorer />}
      </div>
    </Layout>
  );
}

