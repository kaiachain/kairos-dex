import { Layout } from '@/components/layout/Layout';
import { PositionDetails } from '@/components/positions/PositionDetails';

export default function PositionDetailPage({
  params,
}: {
  params: { tokenId: string };
}) {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <PositionDetails tokenId={params.tokenId} />
      </div>
    </Layout>
  );
}

