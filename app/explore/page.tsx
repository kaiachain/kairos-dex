import { Layout } from '@/components/layout/Layout';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

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

