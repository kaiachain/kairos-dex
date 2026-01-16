import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Providers } from './providers';
import Home from './pages/Home';
import PoolsPage from './pages/Pools';
import PoolDetailPage from './pages/PoolDetail';
import PositionsPage from './pages/Positions';
import PositionDetailPage from './pages/PositionDetail';
import AddLiquidityPage from './pages/AddLiquidity';
import ExplorePage from './pages/Explore';
import SettingsPage from './pages/Settings';
import WrapPage from './pages/Wrap';

function App() {
  return (
    <Providers>
      <BrowserRouter>
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
      </BrowserRouter>
    </Providers>
  );
}

export default App;
