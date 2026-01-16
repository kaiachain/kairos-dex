
import { usePositions } from "@/hooks/usePositions";
import { PositionCard } from "./PositionCard";
import { Plus } from "lucide-react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { showToast } from "@/lib/showToast";

export function PositionList() {
  const { positions, isLoading } = usePositions();
  const { isConnected } = useAccount();
  const navigate = useNavigate();

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-text-secondary">
            {positions.length} position{positions.length !== 1 ? "s" : ""} found
          </p>
          {positions.length > 0 && (
            <p className="mt-1 text-sm text-text-secondary">
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
          type="button"
          onClick={handleCreatePositionClick}
          className="flex gap-2 items-center px-4 py-2 font-medium rounded-lg border-2 transition-all border-border text-text-primary hover:bg-gray-50 dark:hover:bg-input-bg hover:border-[color:var(--border-hover)]"
        >
          <Plus className="w-4 h-4" />
          <span>Create Position</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-text-secondary">
          Loading positions...
        </div>
      ) : !isConnected ? (
        <div className="py-12 text-center">
          <p className="text-text-secondary">Connect wallet to see your positions</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-text-secondary">No positions found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
