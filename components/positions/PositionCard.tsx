"use client";

import Link from "next/link";
import { Position } from "@/types/position";
import { formatCurrency, formatNumber, formatBalance } from "@/lib/utils";
import { TrendingUp, TrendingDown, Plus, Minus, Coins } from "lucide-react";

interface PositionCardProps {
  position: Position;
  mintCount?: number;
  burnCount?: number;
  collectCount?: number;
}

export function PositionCard({
  position,
  mintCount = 0,
  burnCount = 0,
  collectCount = 0,
}: PositionCardProps) {
  // Check if position is full range (covers all prices)
  // Full range positions have priceMin = 0 and priceMax >= 1e50
  const FULL_RANGE_THRESHOLD = 1e40;
  const isFullRange =
    position.priceMin === 0 && position.priceMax >= FULL_RANGE_THRESHOLD;

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

  return (
    <Link href={`/positions/${position.tokenId}`}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {position.token0.symbol[0]}
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm -ml-3 border-2 border-white dark:border-gray-800">
              {position.token1.symbol[0]}
            </div>
            <div>
              <div className="font-semibold text-lg">
                {position.token0.symbol} / {position.token1.symbol}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {position.feeTier}% fee
              </div>
            </div>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isInRange
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            }`}
          >
            {isInRange ? "In Range" : "Out of Range"}
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">
              Position Value
            </span>
            <span className="font-semibold text-lg">
              {formatCurrency(position.value)}
            </span>
          </div>

          {position.token0Amount !== undefined &&
            position.token1Amount !== undefined && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Token Amounts
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {position.token0.symbol}:
                    </span>
                    <span className="font-medium">
                      {formatBalance(position.token0Amount, 4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {position.token1.symbol}:
                    </span>
                    <span className="font-medium">
                      {formatBalance(position.token1Amount, 4)}
                    </span>
                  </div>
                </div>
              </div>
            )}

          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">
              Price Range
            </span>
            <span className="font-semibold text-xs">
              {isFullRange ? (
                <span className="text-gray-500">Full Range</span>
              ) : (
                <>
                  {position.priceMin === 0
                    ? "0"
                    : formatNumber(position.priceMin, 4)}{" "}
                  -{" "}
                  {position.priceMax >= FULL_RANGE_THRESHOLD
                    ? "∞"
                    : formatNumber(position.priceMax, 4)}
                </>
              )}
            </span>
          </div>

          {(mintCount > 0 || burnCount > 0 || collectCount > 0) && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                {mintCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    <span>
                      {mintCount} mint{mintCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {burnCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Minus className="w-3 h-3" />
                    <span>
                      {burnCount} burn{burnCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {collectCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    <span>
                      {collectCount} collect{collectCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {position.uncollectedFees > 0 && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">
                  Uncollected Fees
                </span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(position.uncollectedFees)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
