import { lazy, Suspense } from 'react';
import { Layout } from '../layout/Layout';

// Dynamically import AnalyticsDashboard to reduce initial bundle size (includes recharts)
const AnalyticsDashboard = lazy(
  () => import('@/components/analytics/AnalyticsDashboard').then((mod) => ({ default: mod.AnalyticsDashboard }))
);

export default function ExplorePage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Explore & Analytics</h1>
        <Suspense fallback={<div className="text-center py-12 text-text-secondary">Loading analytics...</div>}>
          <AnalyticsDashboard />
        </Suspense>
      </div>
    </Layout>
  );
}
