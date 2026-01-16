import dynamic from 'next/dynamic';
import { Layout } from '@/components/layout/Layout';

// Dynamically import AnalyticsDashboard to reduce initial bundle size (includes recharts)
const AnalyticsDashboard = dynamic(
  () => import('@/components/analytics/AnalyticsDashboard').then((mod) => ({ default: mod.AnalyticsDashboard })),
  {
    loading: () => <div className="text-center py-12 text-text-secondary">Loading analytics...</div>,
    ssr: false, // Analytics dashboard uses client-side only features
  }
);

export default function ExplorePage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Explore & Analytics</h1>
        <AnalyticsDashboard />
      </div>
    </Layout>
  );
}

