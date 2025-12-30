import { Layout } from '@/components/layout/Layout';
import { SettingsPanel } from '@/components/settings/SettingsPanel';

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

