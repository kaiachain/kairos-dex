import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { Position } from "@/types/position";
import { CONTRACTS } from "@/config/contracts";
import { PositionManager_ABI } from "@/abis/PositionManager";
import { query } from "@/lib/graphql";
import { GET_POSITION_EVENTS_QUERY } from "@/lib/graphql-queries";
import { SubgraphPositionEventsResponse } from "@/types/subgraph";
import { aggregatePositionEvents } from "@/lib/subgraph-utils";

export function usePositions() {
  const { address } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get balance of NFTs (positions)
  const { data: balance } = useReadContract({
    address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
    abi: PositionManager_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  useEffect(() => {
    if (!address) {
      setPositions([]);
      setIsLoading(false);
      return;
    }

    const fetchPositions = async () => {
      try {
        setIsLoading(true);

        // Try to fetch from subgraph using Mint, Burn, and Collect events
        try {
          const response = await query<SubgraphPositionEventsResponse>(
            GET_POSITION_EVENTS_QUERY,
            {
              owner: address.toLowerCase() as `0x${string}`,
              first: 1000, // Get more events to aggregate properly
              skip: 0,
            }
          );

          if (response.mints || response.burns || response.collects) {
            // Aggregate events into positions
            const positionsData = aggregatePositionEvents(
              response.mints || [],
              response.burns || [],
              response.collects || []
            );

            if (positionsData.length > 0) {
              setPositions(positionsData);
              setIsLoading(false);
              return;
            }
          }
        } catch (subgraphError) {
          console.warn(
            "Failed to fetch positions from subgraph:",
            subgraphError
          );
        }

        // If no positions found or subgraph failed, return empty array
        setPositions([]);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching positions:", error);
        setPositions([]);
        setIsLoading(false);
      }
    };

    fetchPositions();
  }, [address, balance]);

  return { positions, isLoading };
}
