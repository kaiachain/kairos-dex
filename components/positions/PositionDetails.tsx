'use client';

import { useState } from 'react';
import { usePositionDetails } from '@/hooks/usePositionDetails';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useWriteContract, useAccount } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { PositionManager_ABI } from '@/abis/PositionManager';

interface PositionDetailsProps {
  tokenId: string;
}

export function PositionDetails({ tokenId }: PositionDetailsProps) {
  const { address } = useAccount();
  const { position, isLoading } = usePositionDetails(tokenId);
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

  const isInRange =
    position.currentPrice >= position.priceMin &&
    position.currentPrice <= position.priceMax;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Position #{tokenId}</h1>
        <div
          className={`inline-block px-3 py-1 rounded text-sm font-medium ${
            isInRange
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
          }`}
        >
          {isInRange ? 'In Range' : 'Out of Range'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Position Value</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Value</span>
              <span className="font-semibold">{formatCurrency(position.value)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Uncollected Fees</span>
              <span className="font-semibold text-green-600">
                {formatCurrency(position.uncollectedFees)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Fees Earned</span>
              <span className="font-semibold">{formatCurrency(position.feesEarned)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Price Range</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Min Price</span>
              <span className="font-semibold">
                {formatNumber(position.priceMin, 6)} {position.token1.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Max Price</span>
              <span className="font-semibold">
                {formatNumber(position.priceMax, 6)} {position.token1.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Current Price</span>
              <span className="font-semibold">
                {formatNumber(position.currentPrice, 6)} {position.token1.symbol}
              </span>
            </div>
          </div>
        </div>
      </div>

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

