import { useState } from "react";
import { usePositions } from "@/features/positions/hooks/usePositions";
import { PositionCard } from "./PositionCard";
import { Plus } from "lucide-react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { showToast } from "@/lib/showToast";
import { isPositionInRange } from "../utils/positionUtils";

export function PositionList() {
  const { positions, isLoading } = usePositions();
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const [showOutOfRange, setShowOutOfRange] = useState(false);

  const handleCreatePositionClick = () => {
    if (!isConnected) {
      showToast({
        type: 'warning',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first to create a position',
      });
    } else {
      navigate('/add-liquidity');
    }
  };

  // Filter positions based on range status
  const filteredPositions = showOutOfRange
    ? positions
    : positions.filter((position) => isPositionInRange(position));

  const inRangeCount = positions.filter((p) => isPositionInRange(p)).length;
  const outOfRangeCount = positions.length - inRangeCount;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-text-secondary">
            {filteredPositions.length} position{filteredPositions.length !== 1 ? "s" : ""} found
            {!showOutOfRange && outOfRangeCount > 0 && (
              <span className="ml-2 text-xs">
                ({outOfRangeCount} out of range hidden)
              </span>
            )}
          </p>
          {filteredPositions.length > 0 && (
            <p className="mt-1 text-sm text-text-secondary">
              Total value:{" "}
              {filteredPositions
                .reduce((sum, p) => sum + p.value, 0)
                .toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {positions.length > 0 && outOfRangeCount > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOutOfRange}
                onChange={(e) => setShowOutOfRange(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-2"
              />
              <span className="text-sm text-text-secondary">
                Show out of range
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={handleCreatePositionClick}
            className="flex gap-2 items-center px-4 py-2 font-medium rounded-lg border-2 transition-all border-border text-text-primary hover:bg-gray-50 dark:hover:bg-input-bg hover:border-[color:var(--border-hover)]"
          >
            <Plus className="w-4 h-4" />
            <span>Create Position</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-text-secondary">
          Loading positions...
        </div>
      ) : !isConnected ? (
        <div className="py-12 text-center">
          <p className="text-text-secondary">Connect wallet to see your positions</p>
        </div>
      ) : filteredPositions.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-text-secondary">
            {showOutOfRange
              ? "No positions found"
              : "No in-range positions found"}
          </p>
          {!showOutOfRange && outOfRangeCount > 0 && (
            <p className="mt-2 text-sm text-text-secondary">
              You have {outOfRangeCount} out of range position{outOfRangeCount !== 1 ? "s" : ""}. 
              Enable "Show out of range" to view them.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPositions.map((position) => (
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
