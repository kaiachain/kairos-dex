import { useState, useEffect } from "react";
import { Position } from "@/types/position";
import { query } from "@/lib/graphql";
import { GET_POSITION_BY_TICKS_QUERY } from "@/lib/graphql-queries";
import { SubgraphPositionByTicksResponse } from "@/types/subgraph";
import { aggregatePositionEvents } from "@/lib/subgraph-utils";

/**
 * Parse position tokenId to extract owner, pool, tickLower, tickUpper
 * Format: owner-pool-tickLower-tickUpper
 */
function parsePositionId(tokenId: string): {
  owner: string;
  pool: string;
  tickLower: string;
  tickUpper: string;
} | null {
  const parts = tokenId.split("-");
  if (parts.length !== 4) {
    return null;
  }
  return {
    owner: parts[0],
    pool: parts[1],
    tickLower: parts[2],
    tickUpper: parts[3],
  };
}

export function usePositionDetails(tokenId: string) {
  const [position, setPosition] = useState<Position | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenId) {
      setPosition(null);
      setIsLoading(false);
      return;
    }

    const fetchPosition = async () => {
      try {
        setIsLoading(true);

        // Parse position ID to get components
        const positionParts = parsePositionId(tokenId);
        if (!positionParts) {
          console.warn("Invalid position ID format:", tokenId);
          setPosition(null);
          setIsLoading(false);
          return;
        }

        // Try to fetch from subgraph using Mint, Burn, and Collect events
        try {
          const response = await query<SubgraphPositionByTicksResponse>(
            GET_POSITION_BY_TICKS_QUERY,
            {
              owner: positionParts.owner as `0x${string}`,
              pool: positionParts.pool as `0x${string}`,
              tickLower: positionParts.tickLower,
              tickUpper: positionParts.tickUpper,
            }
          );

          if (response.mints || response.burns || response.collects) {
            // Aggregate events into positions
            const positions = aggregatePositionEvents(
              response.mints || [],
              response.burns || [],
              response.collects || []
            );

            // Find the matching position
            const positionData = positions.find((p) => p.tokenId === tokenId);
            if (positionData) {
              setPosition(positionData);
              setIsLoading(false);
              return;
            }
          }
        } catch (subgraphError) {
          console.warn(
            "Failed to fetch position from subgraph:",
            subgraphError
          );
        }

        // If not found in subgraph, return null
        setPosition(null);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching position details:", error);
        setPosition(null);
        setIsLoading(false);
      }
    };

    fetchPosition();
  }, [tokenId]);

  return { position, isLoading };
}
