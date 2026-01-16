import { Layout } from '../layout/Layout';
import { PositionDetails } from '@/features/positions/components/PositionDetails';
import { useParams } from 'react-router-dom';

export default function PositionDetailPage() {
  const { tokenId } = useParams<{ tokenId: string }>();

  if (!tokenId) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-error">Position token ID is required</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Background gradient shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="bg-shape bg-shape-1" />
          <div className="bg-shape bg-shape-2" />
          <div className="bg-shape bg-shape-3" />
        </div>

        {/* Position Details Content */}
        <div className="relative z-10 w-full max-w-4xl space-y-6">
          <PositionDetails tokenId={tokenId} />
        </div>
      </div>
    </Layout>
  );
}
