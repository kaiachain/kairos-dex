import { Layout } from '../layout/Layout';
import { PositionList } from '@/features/positions/components/PositionList';
import { TokenBalances } from '@/features/positions/components/TokenBalances';

export default function PositionsPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <TokenBalances />
          <h1 className="text-3xl font-bold mb-6">Your Positions</h1>
          <PositionList />
        </div>
      </div>
    </Layout>
  );
}
