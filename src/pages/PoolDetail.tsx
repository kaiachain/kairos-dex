import { Layout } from '@/components/layout/Layout';
import { PoolDetails } from '@/components/pools/PoolDetails';
import { useParams } from 'react-router-dom';

export default function PoolDetailPage() {
  const { address } = useParams<{ address: string }>();

  if (!address) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-error">Pool address is required</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <PoolDetails poolAddress={address} />
      </div>
    </Layout>
  );
}
