import React from "react";
import { Link } from "react-router-dom";
import { Position } from "@/features/positions/types/position";
import { formatCurrency, formatNumber, formatBalance } from "@/lib/utils";
import { TrendingUp, TrendingDown, Plus, Minus, Coins } from "lucide-react";
import { isPositionInRange } from "../utils/positionUtils";

interface PositionCardProps {
  position: Position;
  mintCount?: number;
  burnCount?: number;
  collectCount?: number;
}

function PositionCardComponent({
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

  // Use utility function to determine if position is in range
  const isInRange = isPositionInRange(position);

  return (
    <Link to={`/positions/${position.tokenId}`}>
      <div className="bg-white dark:bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-sm">
              {position.token0.symbol[0]}
            </div>
            <div className="w-10 h-10 bg-primary/30 rounded-full flex items-center justify-center text-primary font-bold text-sm -ml-3 border-2 border-white dark:border-card">
              {position.token1.symbol[0]}
            </div>
            <div>
              <div className="font-semibold text-lg text-text-primary">
                {position.token0.symbol} / {position.token1.symbol}
              </div>
              <div className="text-xs text-text-secondary">
                {position.feeTier}% fee
              </div>
            </div>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isInRange
                ? "bg-success/20 text-success"
                : "bg-secondary/20 text-secondary"
            }`}
          >
            {isInRange ? "In Range" : "Out of Range"}
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">
              Position Value
            </span>
            <span className="font-semibold text-lg text-text-primary">
              {formatCurrency(position.value)}
            </span>
          </div>

          {position.token0Amount !== undefined &&
            position.token1Amount !== undefined && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-text-secondary mb-1">
                  Token Amounts
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">
                      {position.token0.symbol}:
                    </span>
                    <span className="font-medium text-text-primary">
                      {formatBalance(position.token0Amount, 4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">
                      {position.token1.symbol}:
                    </span>
                    <span className="font-medium text-text-primary">
                      {formatBalance(position.token1Amount, 4)}
                    </span>
                  </div>
                </div>
              </div>
            )}

          <div className="flex justify-between pt-2 border-t border-border">
            <span className="text-text-secondary">
              Price Range
            </span>
            <span className="font-semibold text-xs text-text-primary">
              {isFullRange ? (
                <span className="text-text-secondary">Full Range</span>
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
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-4 text-xs text-text-secondary">
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
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">
                  Uncollected Fees
                </span>
                <span className="font-semibold text-success">
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

// Memoize component to prevent unnecessary re-renders
export const PositionCard = React.memo(PositionCardComponent);
