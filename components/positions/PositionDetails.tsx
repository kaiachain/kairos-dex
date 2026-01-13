'use client';

import { useState } from 'react';
import { usePositionDetails } from '@/hooks/usePositionDetails';
import { formatCurrency, formatNumber, formatBalance } from '@/lib/utils';
import { useWriteContract, useAccount } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { PositionManager_ABI } from '@/abis/PositionManager';
import { Plus, Minus, Coins, ExternalLink, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface PositionDetailsProps {
  tokenId: string;
}

const FULL_RANGE_THRESHOLD = 1e40;

export function PositionDetails({ tokenId }: PositionDetailsProps) {
  const router = useRouter();
  const { address } = useAccount();
  const { position, isLoading } = usePositionDetails(tokenId);
  const [removeAmount, setRemoveAmount] = useState('');
  const { writeContract: collectFees } = useWriteContract();

  // Extract pool address from tokenId (format: owner-pool-tickLower-tickUpper)
  const poolAddress = tokenId.split('-').length >= 2 ? tokenId.split('-')[1] : null;

  const handleCollectFees = () => {
    if (!position || !address) return;

    collectFees({
      address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
      abi: PositionManager_ABI,
      functionName: 'collect',
      args: [
        {
          tokenId: BigInt(tokenId),
          recipient: address,
          amount0Max: BigInt(2 ** 128 - 1),
          amount1Max: BigInt(2 ** 128 - 1),
        },
      ],
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-text-secondary">
        Loading position details...
      </div>
    );
  }

  if (!position) {
    return (
      <div className="text-center py-12 text-text-secondary">
        Position not found
      </div>
    );
  }

  // Check if position is full range (covers all prices)
  const isFullRange = position.priceMin === 0 && position.priceMax >= FULL_RANGE_THRESHOLD;
  
  // Determine if position is in range
  // For full range positions, always consider them in range
  // For regular positions, use price-based comparison as primary (more intuitive for users)
  // Tick-based comparison is used as secondary validation
  let isInRange: boolean;
  if (isFullRange) {
    isInRange = true;
  } else {
    // Primary check: price-based comparison (what users see and understand)
    const priceInRange =
      position.currentPrice >= position.priceMin &&
      position.currentPrice <= position.priceMax;
    
    // Secondary check: tick-based comparison (more accurate for Uniswap V3 mechanics)
    let tickInRange: boolean | null = null;
    if (
      position.tickLower !== undefined &&
      position.tickUpper !== undefined &&
      position.currentTick !== undefined
    ) {
      tickInRange =
        position.currentTick >= position.tickLower &&
        position.currentTick <= position.tickUpper;
      
      // Log warning if there's a mismatch (indicates potential data/calculation issue)
      if (tickInRange !== priceInRange) {
        console.warn('Tick and price range mismatch:', {
          tickInRange,
          priceInRange,
          currentPrice: position.currentPrice,
          priceMin: position.priceMin,
          priceMax: position.priceMax,
          currentTick: position.currentTick,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
        });
      }
    }
    
    // Use price-based result as primary (what's displayed to users)
    // This ensures the UI matches what users see in the price range visualization
    isInRange = priceInRange;
  }

  // Get all events sorted by timestamp (newest first)
  const allEvents = [
    ...(position.mints || []).map((mint) => ({
      type: 'mint' as const,
      data: mint,
      timestamp: parseInt(mint.timestamp, 10),
    })),
    ...(position.burns || []).map((burn) => ({
      type: 'burn' as const,
      data: burn,
      timestamp: parseInt(burn.timestamp, 10),
    })),
    ...(position.collects || []).map((collect) => ({
      type: 'collect' as const,
      data: collect,
      timestamp: parseInt(collect.timestamp, 10),
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/positions')}
        className="mb-4 text-primary hover:opacity-80 hover:underline"
      >
        ← Back to Positions
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-text-primary">
            {position.token0.symbol} / {position.token1.symbol}
          </h1>
          <div className="flex items-center gap-3">
            <div
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                isInRange
                  ? 'bg-success/20 text-success'
                  : 'bg-secondary/20 text-secondary'
              }`}
            >
              {isInRange ? 'In Range' : 'Out of Range'}
            </div>
            <span className="text-sm text-text-secondary">
              {position.feeTier}% fee tier
            </span>
          </div>
        </div>
        {poolAddress && (
          <Link
            href={`/pools/${poolAddress}`}
            className="flex items-center gap-2 px-4 py-2 border-2 border-border text-text-primary rounded-lg hover:bg-gray-50 dark:hover:bg-input-bg hover:border-[color:var(--border-hover)] transition-all font-medium"
          >
            <span>View Pool</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
          <div className="text-sm text-text-secondary mb-1">Position Value</div>
          <div className="text-2xl font-bold text-text-primary">
            {formatCurrency(position.value)}
          </div>
          {position.token0Amount !== undefined &&
            position.token1Amount !== undefined && (
              <div className="text-xs text-text-secondary mt-2">
                {formatBalance(position.token0Amount, 4)} {position.token0.symbol} +{' '}
                {formatBalance(position.token1Amount, 4)} {position.token1.symbol}
              </div>
            )}
        </div>

        <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
          <div className="text-sm text-text-secondary mb-1">Uncollected Fees</div>
          <div className="text-2xl font-bold text-success">
            {formatCurrency(position.uncollectedFees)}
          </div>
          {position.feesEarned > 0 && (
            <div className="text-xs text-text-secondary mt-2">
              Total earned: {formatCurrency(position.feesEarned)}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
          <div className="text-sm text-text-secondary mb-1">Current Price</div>
          <div className="text-2xl font-bold text-text-primary">
            {formatNumber(position.currentPrice, 6)}
          </div>
          <div className="text-xs text-text-secondary mt-2">
            {position.token1.symbol} per {position.token0.symbol}
          </div>
        </div>
      </div>

      {/* Price Range */}
      <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
        <h2 className="text-xl font-bold mb-4 text-text-primary">Price Range</h2>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <div className="text-text-secondary mb-1">Min Price</div>
            <div className="font-semibold text-text-primary">
              {position.priceMin === 0 ? (
                <span className="text-text-secondary">0 (Full Range)</span>
              ) : (
                `${formatNumber(position.priceMin, 6)} ${position.token1.symbol}`
              )}
            </div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">Max Price</div>
            <div className="font-semibold text-text-primary">
              {position.priceMax >= FULL_RANGE_THRESHOLD ? (
                <span className="text-text-secondary">∞ (Full Range)</span>
              ) : (
                `${formatNumber(position.priceMax, 6)} ${position.token1.symbol}`
              )}
            </div>
          </div>
        </div>
        {isFullRange ? (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm text-text-primary">
              This is a full-range position covering all possible prices (like Uniswap V2)
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {/* Progress Bar Container */}
            <div className="w-full bg-gray-200 dark:bg-bg rounded-full h-4 relative overflow-hidden">
              {(() => {
                // Calculate a reasonable scale for visualization
                const priceRange = position.priceMax - position.priceMin;
                
                // Determine how much to extend the range based on current price position
                // If current price is outside range, extend more to show it
                const currentBelowMin = position.currentPrice < position.priceMin;
                const currentAboveMax = position.currentPrice > position.priceMax;
                
                // Extend range to include current price with context
                let extendedMin = Math.max(0, position.priceMin - priceRange * 0.2);
                let extendedMax = position.priceMax + priceRange * 0.2;
                
                // If current price is outside range, extend further to show it
                if (currentBelowMin) {
                  extendedMin = Math.max(0, position.currentPrice - priceRange * 0.1);
                }
                if (currentAboveMax) {
                  extendedMax = position.currentPrice + priceRange * 0.1;
                }
                
                const extendedRange = extendedMax - extendedMin;
                
                // Calculate positions as percentages
                const minPercent = ((position.priceMin - extendedMin) / extendedRange) * 100;
                const maxPercent = ((position.priceMax - extendedMin) / extendedRange) * 100;
                const currentPercent = ((position.currentPrice - extendedMin) / extendedRange) * 100;
                
                // Clamp values to 0-100
                const clampedMin = Math.max(0, Math.min(100, minPercent));
                const clampedMax = Math.max(0, Math.min(100, maxPercent));
                const clampedCurrent = Math.max(0, Math.min(100, currentPercent));
                const rangeWidth = clampedMax - clampedMin;
                
                return (
                  <>
                    {/* Position range bar (colored section from min to max) */}
                    <div
                      className={`absolute h-4 rounded-full transition-colors ${
                        isInRange ? 'bg-success' : 'bg-secondary'
                      }`}
                      style={{
                        left: `${clampedMin}%`,
                        width: `${rangeWidth}%`,
                      }}
                    />
                    {/* Current price marker - make it more visible */}
                    <div
                      className={`absolute top-0 h-4 w-1.5 rounded-full z-10 shadow-lg ${
                        isInRange ? 'bg-primary' : 'bg-error'
                      }`}
                      style={{
                        left: `${clampedCurrent}%`,
                        transform: 'translateX(-50%)',
                      }}
                    />
                    {/* Current price indicator dot */}
                    <div
                      className={`absolute top-1/2 h-2 w-2 rounded-full z-20 border-2 border-white dark:border-card ${
                        isInRange ? 'bg-primary' : 'bg-error'
                      }`}
                      style={{
                        left: `${clampedCurrent}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  </>
                );
              })()}
            </div>
            {/* Price labels below the bar */}
            <div className="flex justify-between text-xs text-text-secondary px-1">
              <span>{formatNumber(position.priceMin, 4)}</span>
              <span className={`font-semibold ${isInRange ? 'text-text-primary' : 'text-error'}`}>
                Current: {formatNumber(position.currentPrice, 4)}
                {!isInRange && (
                  <span className="ml-1">
                    {position.currentPrice < position.priceMin ? '(Below)' : '(Above)'}
                  </span>
                )}
              </span>
              <span>{formatNumber(position.priceMax, 4)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Event History */}
      {allEvents.length > 0 && (
        <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
          <h2 className="text-xl font-bold mb-4 text-text-primary">Event History</h2>
          <div className="space-y-3">
            {allEvents.map((event, index) => {
              const isMint = event.type === 'mint';
              const isBurn = event.type === 'burn';
              const isCollect = event.type === 'collect';
              const eventData = event.data;

              return (
                <div
                  key={`${event.type}-${eventData.id}-${index}`}
                  className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-input-bg rounded-lg border border-border"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isMint
                        ? 'bg-success/20 text-success'
                        : isBurn
                        ? 'bg-error/20 text-error'
                        : 'bg-primary/20 text-primary'
                    }`}
                  >
                    {isMint ? (
                      <Plus className="w-5 h-5" />
                    ) : isBurn ? (
                      <Minus className="w-5 h-5" />
                    ) : (
                      <Coins className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold capitalize text-text-primary">{event.type}</span>
                      <span className="text-xs text-text-secondary flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-text-secondary space-y-1">
                      {isMint && (
                        <>
                          <div>
                            Added: {formatBalance(eventData.amount0 || '0', 4)}{' '}
                            {position.token0.symbol} +{' '}
                            {formatBalance(eventData.amount1 || '0', 4)}{' '}
                            {position.token1.symbol}
                          </div>
                          {eventData.amountUSD &&
                            parseFloat(eventData.amountUSD) > 0 && (
                              <div className="text-xs">
                                Value: {formatCurrency(parseFloat(eventData.amountUSD))}
                              </div>
                            )}
                        </>
                      )}
                      {isBurn && (
                        <>
                          <div>
                            Removed: {formatBalance(eventData.amount0 || '0', 4)}{' '}
                            {position.token0.symbol} +{' '}
                            {formatBalance(eventData.amount1 || '0', 4)}{' '}
                            {position.token1.symbol}
                          </div>
                          {eventData.amountUSD &&
                            parseFloat(eventData.amountUSD) > 0 && (
                              <div className="text-xs">
                                Value: {formatCurrency(parseFloat(eventData.amountUSD))}
                              </div>
                            )}
                        </>
                      )}
                      {isCollect && (
                        <>
                          <div>
                            Collected: {formatBalance(eventData.amount0 || '0', 4)}{' '}
                            {position.token0.symbol} +{' '}
                            {formatBalance(eventData.amount1 || '0', 4)}{' '}
                            {position.token1.symbol}
                          </div>
                          {eventData.amountUSD &&
                            parseFloat(eventData.amountUSD) > 0 && (
                              <div className="text-xs">
                                Value: {formatCurrency(parseFloat(eventData.amountUSD))}
                              </div>
                            )}
                        </>
                      )}
                      <div className="text-xs mt-1">
                        <a
                          href={`https://scope.klaytn.com/tx/${eventData.transaction.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:opacity-80 hover:underline flex items-center gap-1"
                        >
                          View Transaction <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
        <h2 className="text-xl font-bold mb-4 text-text-primary">Actions</h2>
        <div className="space-y-4">
          <button
            onClick={handleCollectFees}
            disabled={position.uncollectedFees === 0}
            className="w-full py-3 bg-primary text-bg rounded-lg font-semibold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Collect Fees {position.uncollectedFees > 0 && `(${formatCurrency(position.uncollectedFees)})`}
          </button>

          <div>
            <label className="block text-sm font-medium mb-2 text-text-primary">
              Remove Liquidity (%)
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={removeAmount}
                onChange={(e) => setRemoveAmount(e.target.value)}
                placeholder="0"
                min="0"
                max="100"
                className="flex-1 px-4 py-2 bg-gray-50 dark:bg-input-bg rounded-lg border border-border outline-none focus:border-primary text-text-primary"
              />
              <button
                onClick={() => setRemoveAmount('100')}
                className="px-4 py-2 bg-gray-100 dark:bg-bg rounded-lg hover:bg-gray-200 dark:hover:bg-card text-text-primary"
              >
                Max
              </button>
            </div>
            <button
              onClick={() => {
                if (!position || !address || !removeAmount) return;
                const percentage = parseFloat(removeAmount);
                if (percentage <= 0 || percentage > 100) return;
                // TODO: Implement remove liquidity functionality
                console.log('Remove liquidity:', percentage);
              }}
              disabled={!removeAmount || parseFloat(removeAmount) <= 0}
              className="w-full mt-2 py-3 bg-error text-bg rounded-lg font-semibold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove Liquidity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

