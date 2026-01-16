import { Layout } from '../layout/Layout';
import { AddLiquidity } from '@/features/liquidity/components/AddLiquidity';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTokenInfo } from '@/shared/hooks/useTokenInfo';
import { Token } from '@/shared/types/token';
import { CHAIN_ID } from '@/config/env';
import { useMemo } from 'react';

export default function AddLiquidityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const token0Address = searchParams.get('token0');
  const token1Address = searchParams.get('token1');
  const feeParam = searchParams.get('fee');
  
  // Fetch token info if addresses are provided
  const token0Info = useTokenInfo(token0Address);
  const token1Info = useTokenInfo(token1Address);
  
  // Create token objects if info is available
  const initialToken0: Token | null = useMemo(() => {
    if (token0Address && token0Info.decimals !== undefined && token0Info.symbol && token0Info.name) {
      return {
        address: token0Address,
        symbol: token0Info.symbol,
        name: token0Info.name,
        decimals: token0Info.decimals,
        chainId: CHAIN_ID,
      };
    }
    return null;
  }, [token0Address, token0Info]);
  
  const initialToken1: Token | null = useMemo(() => {
    if (token1Address && token1Info.decimals !== undefined && token1Info.symbol && token1Info.name) {
      return {
        address: token1Address,
        symbol: token1Info.symbol,
        name: token1Info.name,
        decimals: token1Info.decimals,
        chainId: CHAIN_ID,
      };
    }
    return null;
  }, [token1Address, token1Info]);
  
  const initialFee = feeParam ? parseFloat(feeParam) : undefined;
  
  // Determine if we should disable token selection (when coming from pool details)
  const disableTokenSelection = !!(initialToken0 && initialToken1 && initialFee);
  
  // Show loading state if we're fetching token info
  const isLoadingTokens = (token0Address && token0Info.isLoading) || (token1Address && token1Info.isLoading);

  return (
    <Layout>
      <div className="relative min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Background gradient shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="bg-shape bg-shape-1" />
          <div className="bg-shape bg-shape-2" />
          <div className="bg-shape bg-shape-3" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-[420px] space-y-8">
          <button
            onClick={() => navigate(-1)}
            className="flex gap-2 items-center px-4 py-2 font-medium rounded-lg border-2 transition-all border-border text-text-primary hover:bg-gray-50 dark:hover:bg-input-bg hover:border-[color:var(--border-hover)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          {isLoadingTokens ? (
            <div className="text-center py-12 text-text-secondary">Loading token information...</div>
          ) : (
            <AddLiquidity 
              initialToken0={initialToken0}
              initialToken1={initialToken1}
              initialFee={initialFee}
              disableTokenSelection={disableTokenSelection}
              fromPositionsPage={!disableTokenSelection}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
