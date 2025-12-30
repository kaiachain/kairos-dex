import { Layout } from '@/components/layout/Layout';
import { PoolDetails } from '@/components/pools/PoolDetails';

export default function PoolDetailPage({
  params,
}: {
  params: { address: string };
}) {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <PoolDetails poolAddress={params.address} />
      </div>
    </Layout>
  );
}

