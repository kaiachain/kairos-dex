
import { usePoolDetails } from '@/features/pools/hooks/usePoolDetails';
import { formatCurrency, formatNumber, formatAddress } from '@/lib/utils';
import { useAccount } from 'wagmi';
import { showToast } from '@/lib/showToast';
import { Plus, ExternalLink, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BLOCK_EXPLORER_URL } from '@/config/env';
import { useState } from 'react';

interface PoolDetailsProps {
  poolAddress: string;
}

export function PoolDetails({ poolAddress }: PoolDetailsProps) {
  const { pool, isLoading } = usePoolDetails(poolAddress);
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const [copiedToken0, setCopiedToken0] = useState(false);
  const [copiedToken1, setCopiedToken1] = useState(false);

  const handleAddLiquidityClick = () => {
    if (!isConnected) {
      showToast({
        type: 'warning',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first to add liquidity',
      });
    } else if (pool) {
      // Navigate to add-liquidity page with pool info as query parameters
      const params = new URLSearchParams({
        token0: pool.token0.address,
        token1: pool.token1.address,
        fee: pool.feeTier.toString(),
      });
      navigate(`/add-liquidity?${params.toString()}`);
    }
  };

  const handleCopyToken0 = () => {
    if (pool) {
      navigator.clipboard.writeText(pool.token0.address);
      setCopiedToken0(true);
      setTimeout(() => setCopiedToken0(false), 2000);
      showToast({
        type: 'success',
        title: 'Address copied',
        description: `${pool.token0.symbol} address copied to clipboard`,
        autoClose: 2000,
      });
    }
  };

  const handleCopyToken1 = () => {
    if (pool) {
      navigator.clipboard.writeText(pool.token1.address);
      setCopiedToken1(true);
      setTimeout(() => setCopiedToken1(false), 2000);
      showToast({
        type: 'success',
        title: 'Address copied',
        description: `${pool.token1.symbol} address copied to clipboard`,
        autoClose: 2000,
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-text-secondary">Loading pool details...</div>;
  }

  if (!pool) {
    return <div className="text-center py-12 text-text-secondary">Pool not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-text-primary">
            {pool.token0.symbol} / {pool.token1.symbol}
          </h1>
          <p className="text-text-secondary">
            {pool.feeTier}% fee tier
          </p>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-sm text-text-secondary font-mono">
              {formatAddress(pool.address)}
            </p>
            <a
              href={`${BLOCK_EXPLORER_URL}/address/${pool.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-primary transition-colors"
              aria-label="View pool on KairosScan Explorer"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
        <button
          onClick={handleAddLiquidityClick}
          className="flex items-center gap-2 px-4 py-2 border-2 border-border text-text-primary rounded-lg transition-all font-medium hover:bg-gray-50 dark:hover:bg-input-bg hover:border-[color:var(--border-hover)]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Liquidity</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
          <div className="text-sm text-text-secondary mb-1">TVL</div>
          <div className="text-2xl font-bold text-text-primary">{formatCurrency(pool.tvl)}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
          <div className="text-sm text-text-secondary mb-1">24h Volume</div>
          <div className="text-2xl font-bold text-text-primary">{formatCurrency(pool.volume24h)}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
          <div className="text-sm text-text-secondary mb-1">APR</div>
          <div className="text-2xl font-bold text-success">
            {formatNumber(pool.apr, 2)}%
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
        <h2 className="text-xl font-bold mb-4 text-text-primary">Pool Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-text-secondary mb-1">Current Price</div>
            <div className="font-semibold text-text-primary">
              1 {pool.token0.symbol} = {formatNumber(pool.currentPrice, 6)} {pool.token1.symbol}
            </div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">7d Volume</div>
            <div className="font-semibold text-text-primary">{formatCurrency(pool.volume7d)}</div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">30d Volume</div>
            <div className="font-semibold text-text-primary">{formatCurrency(pool.volume30d)}</div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">Created</div>
            <div className="font-semibold">
              {new Date(pool.createdAt * 1000).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
        <h2 className="text-xl font-bold mb-4 text-text-primary">Token Addresses</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-bg rounded-lg border border-border">
            <div className="flex-1">
              <div className="text-sm text-text-secondary mb-1">{pool.token0.symbol}</div>
              <div className="text-sm font-mono text-text-primary">{formatAddress(pool.token0.address)}</div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`${BLOCK_EXPLORER_URL}/address/${pool.token0.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-input-bg transition-colors text-text-secondary hover:text-primary"
                aria-label={`View ${pool.token0.symbol} on explorer`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={handleCopyToken0}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-input-bg transition-colors text-text-secondary hover:text-primary"
                aria-label={`Copy ${pool.token0.symbol} address`}
              >
                {copiedToken0 ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-bg rounded-lg border border-border">
            <div className="flex-1">
              <div className="text-sm text-text-secondary mb-1">{pool.token1.symbol}</div>
              <div className="text-sm font-mono text-text-primary">{formatAddress(pool.token1.address)}</div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`${BLOCK_EXPLORER_URL}/address/${pool.token1.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-input-bg transition-colors text-text-secondary hover:text-primary"
                aria-label={`View ${pool.token1.symbol} on explorer`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={handleCopyToken1}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-input-bg transition-colors text-text-secondary hover:text-primary"
                aria-label={`Copy ${pool.token1.symbol} address`}
              >
                {copiedToken1 ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

