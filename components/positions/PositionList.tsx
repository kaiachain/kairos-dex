"use client";

import { usePositions } from "@/hooks/usePositions";
import { PositionCard } from "./PositionCard";
import { AddLiquidity } from "@/components/liquidity/AddLiquidity";
import { useState } from "react";

export function PositionList() {
  const { positions, isLoading } = usePositions();
  const [showAddLiquidity, setShowAddLiquidity] = useState(false);

  if (showAddLiquidity) {
    return (
      <div>
        <button
          onClick={() => setShowAddLiquidity(false)}
          className="mb-4 text-primary-600 dark:text-primary-400 hover:underline"
        >
          ← Back to Positions
        </button>
        <AddLiquidity fromPositionsPage={true} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 dark:text-gray-400">
            {positions.length} position{positions.length !== 1 ? "s" : ""} found
          </p>
          {positions.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Total value:{" "}
              {positions
                .reduce((sum, p) => sum + p.value, 0)
                .toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAddLiquidity(true)}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Create Position
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">
          Loading positions...
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No positions found</p>
          <button
            onClick={() => setShowAddLiquidity(true)}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Your First Position
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {positions.map((position) => (
            <PositionCard
              key={position.tokenId}
              position={position}
              mintCount={position.mintCount}
              burnCount={position.burnCount}
              collectCount={position.collectCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
