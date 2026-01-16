import { Layout } from '../layout/Layout';
import { WrapInterface } from '@/components/wrap/WrapInterface';

export default function WrapPage() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">
          <h1 className="text-4xl font-bold text-center mb-8 text-text-primary">
            Wrap / Unwrap KAIA
          </h1>
          <p className="text-center text-text-secondary mb-8">
            Convert between native KAIA and WKAIA tokens
          </p>
          <WrapInterface />
        </div>
      </div>
    </Layout>
  );
}
