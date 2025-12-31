import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { Position } from "@/types/position";
import { CONTRACTS } from "@/config/contracts";
import { PositionManager_ABI } from "@/abis/PositionManager";
import { query } from "@/lib/graphql";
import { GET_POSITION_EVENTS_QUERY } from "@/lib/graphql-queries";
import {
  SubgraphPositionEventsResponse,
  SubgraphMint,
  SubgraphBurn,
  SubgraphCollect,
} from "@/types/subgraph";
import { aggregatePositionEvents } from "@/lib/subgraph-utils";

export interface PositionWithEvents extends Position {
  mintCount: number;
  burnCount: number;
  collectCount: number;
  mints: SubgraphMint[];
  burns: SubgraphBurn[];
  collects: SubgraphCollect[];
}

export function usePositions() {
  const { address } = useAccount();
  const [positions, setPositions] = useState<PositionWithEvents[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<SubgraphPositionEventsResponse | null>(
    null
  );

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
      setEvents(null);
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

          console.log("Positions response:", response);
          setEvents(response);

          if (response.mints || response.burns || response.collects) {
            // Aggregate events into positions
            const positionsData = aggregatePositionEvents(
              response.mints || [],
              response.burns || [],
              response.collects || []
            );

            // Enhance positions with event counts and event arrays
            const positionsWithEvents: PositionWithEvents[] = positionsData.map(
              (position) => {
                // Group events by position key
                const positionKey = position.tokenId;
                const positionMints = (response.mints || []).filter((mint) => {
                  const key = `${mint.owner.toLowerCase()}-${mint.pool.id.toLowerCase()}-${
                    mint.tickLower
                  }-${mint.tickUpper}`;
                  return key === positionKey;
                });
                const positionBurns = (response.burns || []).filter((burn) => {
                  if (!burn.owner) return false;
                  const key = `${burn.owner.toLowerCase()}-${burn.pool.id.toLowerCase()}-${
                    burn.tickLower
                  }-${burn.tickUpper}`;
                  return key === positionKey;
                });
                const positionCollects = (response.collects || []).filter(
                  (collect) => {
                    if (!collect.owner) return false;
                    const key = `${collect.owner.toLowerCase()}-${collect.pool.id.toLowerCase()}-${
                      collect.tickLower
                    }-${collect.tickUpper}`;
                    return key === positionKey;
                  }
                );

                return {
                  ...position,
                  mintCount: positionMints.length,
                  burnCount: positionBurns.length,
                  collectCount: positionCollects.length,
                  mints: positionMints,
                  burns: positionBurns,
                  collects: positionCollects,
                };
              }
            );

            if (positionsWithEvents.length > 0) {
              setPositions(positionsWithEvents);
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

  return { positions, isLoading, events };
}
