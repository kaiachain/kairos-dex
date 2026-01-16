import dynamic from 'next/dynamic';
import { Layout } from '@/components/layout/Layout';

// Dynamically import SettingsPanel to reduce initial bundle size
const SettingsPanel = dynamic(
  () => import('@/components/settings/SettingsPanel').then((mod) => ({ default: mod.SettingsPanel })),
  {
    loading: () => <div className="text-center py-12 text-text-secondary">Loading settings...</div>,
  }
);

export default function SettingsPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <SettingsPanel />
      </div>
    </Layout>
  );
}

