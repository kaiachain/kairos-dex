import { Layout } from '@/components/layout/Layout';
import { PositionList } from '@/components/positions/PositionList';
import { TokenBalances } from '@/components/positions/TokenBalances';
import { AddLiquidity } from '@/components/liquidity/AddLiquidity';

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

