import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Providers } from './app/providers';
import { Layout } from './app/layout/Layout';

// Lazy load pages for code splitting
const Home = lazy(() => import('./app/pages/Home').then(m => ({ default: m.default })));
const PoolsPage = lazy(() => import('./app/pages/Pools').then(m => ({ default: m.default })));
const PoolDetailPage = lazy(() => import('./app/pages/PoolDetail').then(m => ({ default: m.default })));
const PositionsPage = lazy(() => import('./app/pages/Positions').then(m => ({ default: m.default })));
const PositionDetailPage = lazy(() => import('./app/pages/PositionDetail').then(m => ({ default: m.default })));
const AddLiquidityPage = lazy(() => import('./app/pages/AddLiquidity').then(m => ({ default: m.default })));
const ExplorePage = lazy(() => import('./app/pages/Explore').then(m => ({ default: m.default })));
const SettingsPage = lazy(() => import('./app/pages/Settings').then(m => ({ default: m.default })));
const WrapPage = lazy(() => import('./app/pages/Wrap').then(m => ({ default: m.default })));

// Loading fallback component
const PageLoader = () => (
  <Layout>
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-text-secondary">Loading...</div>
    </div>
  </Layout>
);

function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pools" element={<PoolsPage />} />
            <Route path="/pools/:address" element={<PoolDetailPage />} />
            <Route path="/positions" element={<PositionsPage />} />
            <Route path="/positions/:tokenId" element={<PositionDetailPage />} />
            <Route path="/add-liquidity" element={<AddLiquidityPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/wrap" element={<WrapPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </Providers>
  );
}

export default App;
