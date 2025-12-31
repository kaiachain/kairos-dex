'use client';

import { useState } from 'react';
import { usePositionDetails } from '@/hooks/usePositionDetails';
import { formatCurrency, formatNumber, formatBalance, formatAddress } from '@/lib/utils';
import { useWriteContract, useAccount } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { PositionManager_ABI } from '@/abis/PositionManager';
import { Plus, Minus, Coins, ExternalLink, Calendar } from 'lucide-react';
import Link from 'next/link';

interface PositionDetailsProps {
  tokenId: string;
}

export function PositionDetails({ tokenId }: PositionDetailsProps) {
  const { address } = useAccount();
  const { position, isLoading, events } = usePositionDetails(tokenId);
  const [removeAmount, setRemoveAmount] = useState('');
  const { writeContract: collectFees } = useWriteContract();
  const { writeContract: removeLiquidity } = useWriteContract();

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
    return <div className="text-center py-12 text-gray-500">Loading position...</div>;
  }

  if (!position) {
    return <div className="text-center py-12 text-gray-500">Position not found</div>;
  }

  // Check if position is full range (covers all prices)
  // Full range positions have priceMin = 0 and priceMax >= 1e50
  const FULL_RANGE_THRESHOLD = 1e40;
  const isFullRange = position.priceMin === 0 && position.priceMax >= FULL_RANGE_THRESHOLD;
  
  // For full range positions, always consider them in range
  // For regular positions, use tick-based comparison if available (more accurate),
  // otherwise fall back to price-based comparison
  let isInRange: boolean;
  if (isFullRange) {
    isInRange = true;
  } else if (
    position.tickLower !== undefined &&
    position.tickUpper !== undefined &&
    position.currentTick !== undefined
  ) {
    // Use tick-based comparison (more accurate, especially for extreme prices)
    // In Uniswap V3, a position is in range if: tickLower <= currentTick <= tickUpper
    isInRange =
      position.currentTick >= position.tickLower &&
      position.currentTick <= position.tickUpper;
  } else {
    // Fall back to price-based comparison
    isInRange =
      position.currentPrice >= position.priceMin &&
      position.currentPrice <= position.priceMax;
  }

  // Get all events sorted by timestamp
  const allEvents = [
    ...(position.mints || []).map((mint) => ({ type: 'mint' as const, data: mint, timestamp: parseInt(mint.timestamp, 10) })),
    ...(position.burns || []).map((burn) => ({ type: 'burn' as const, data: burn, timestamp: parseInt(burn.timestamp, 10) })),
    ...(position.collects || []).map((collect) => ({ type: 'collect' as const, data: collect, timestamp: parseInt(collect.timestamp, 10) })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {position.token0.symbol} / {position.token1.symbol}
          </h1>
          <div className="flex items-center gap-3">
            <div
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                isInRange
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {isInRange ? 'In Range' : 'Out of Range'}
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {position.feeTier}% fee tier
            </span>
          </div>
        </div>
        <Link
          href={`/pools/${position.token0.address}-${position.token1.address}`}
          className="text-primary-600 dark:text-primary-400 hover:underline text-sm flex items-center gap-1"
        >
          View Pool <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Position Value</h3>
          <div className="text-2xl font-bold">{formatCurrency(position.value)}</div>
          {position.token0Amount !== undefined && position.token1Amount !== undefined && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
              <div>
                {formatBalance(position.token0Amount, 4)} {position.token0.symbol} + {formatBalance(position.token1Amount, 4)} {position.token1.symbol}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Uncollected Fees</h3>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(position.uncollectedFees)}
          </div>
          {position.feesEarned > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Total earned: {formatCurrency(position.feesEarned)}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Current Price</h3>
          <div className="text-2xl font-bold">
            {formatNumber(position.currentPrice, 6)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {position.token1.symbol} per {position.token0.symbol}
          </div>
        </div>
      </div>

      {/* Price Range */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Price Range</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Min Price</span>
            <span className="font-semibold">
              {position.priceMin === 0 ? (
                <span className="text-gray-500">0 (Full Range)</span>
              ) : (
                `${formatNumber(position.priceMin, 6)} ${position.token1.symbol}`
              )}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Max Price</span>
            <span className="font-semibold">
              {position.priceMax >= FULL_RANGE_THRESHOLD ? (
                <span className="text-gray-500">∞ (Full Range)</span>
              ) : (
                `${formatNumber(position.priceMax, 6)} ${position.token1.symbol}`
              )}
            </span>
          </div>
          {isFullRange ? (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                This is a full-range position covering all possible prices (like Uniswap V2)
              </p>
            </div>
          ) : (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-4 relative">
              <div
                className={`absolute h-2 rounded-full ${
                  isInRange ? 'bg-green-500' : 'bg-gray-400'
                }`}
                style={{
                  left: '0%',
                  right: '0%',
                }}
              />
              {isFinite(position.priceMax) && position.priceMax > position.priceMin && (
                <div
                  className="absolute top-0 h-2 w-1 bg-blue-600 dark:bg-blue-400 rounded-full"
                  style={{
                    left: `${Math.min(100, Math.max(0, ((position.currentPrice - position.priceMin) / (position.priceMax - position.priceMin)) * 100))}%`,
                    transform: 'translateX(-50%)',
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event History */}
      {allEvents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Event History</h2>
          <div className="space-y-3">
            {allEvents.map((event, index) => {
              const isMint = event.type === 'mint';
              const isBurn = event.type === 'burn';
              const isCollect = event.type === 'collect';
              const eventData = event.data;

              return (
                <div
                  key={`${event.type}-${eventData.id}-${index}`}
                  className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isMint
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : isBurn
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
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
                      <span className="font-semibold capitalize">{event.type}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {isMint && (
                        <>
                          <div>
                            Added: {formatBalance(eventData.amount0 || '0', 4)} {position.token0.symbol} + {formatBalance(eventData.amount1 || '0', 4)} {position.token1.symbol}
                          </div>
                          {eventData.amountUSD && parseFloat(eventData.amountUSD) > 0 && (
                            <div className="text-xs">
                              Value: {formatCurrency(parseFloat(eventData.amountUSD))}
                            </div>
                          )}
                        </>
                      )}
                      {isBurn && (
                        <>
                          <div>
                            Removed: {formatBalance(eventData.amount0 || '0', 4)} {position.token0.symbol} + {formatBalance(eventData.amount1 || '0', 4)} {position.token1.symbol}
                          </div>
                          {eventData.amountUSD && parseFloat(eventData.amountUSD) > 0 && (
                            <div className="text-xs">
                              Value: {formatCurrency(parseFloat(eventData.amountUSD))}
                            </div>
                          )}
                        </>
                      )}
                      {isCollect && (
                        <>
                          <div>
                            Collected: {formatBalance(eventData.amount0 || '0', 4)} {position.token0.symbol} + {formatBalance(eventData.amount1 || '0', 4)} {position.token1.symbol}
                          </div>
                          {eventData.amountUSD && parseFloat(eventData.amountUSD) > 0 && (
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
                          className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Actions</h2>
        <div className="space-y-4">
          <button
            onClick={handleCollectFees}
            disabled={position.uncollectedFees === 0}
            className="w-full py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Collect Fees ({formatCurrency(position.uncollectedFees)})
          </button>

          <div>
            <label className="block text-sm font-medium mb-2">
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
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none"
              />
              <button
                onClick={() => setRemoveAmount('100')}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                Max
              </button>
            </div>
            <button
              onClick={() => {
                // Implement remove liquidity
              }}
              disabled={!removeAmount || parseFloat(removeAmount) <= 0}
              className="w-full mt-2 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove Liquidity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

