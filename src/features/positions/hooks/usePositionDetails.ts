import { useState, useEffect, useCallback } from "react";
import { Position } from "@/features/positions/types/position";
import { query } from "@/lib/graphql";
import { GET_POSITION_BY_TICKS_QUERY } from "@/lib/graphql-queries";
import { SubgraphPositionByTicksResponse, SubgraphMint, SubgraphBurn, SubgraphCollect } from "@/shared/types/subgraph";
import { aggregatePositionEvents } from "@/lib/subgraph-utils";

/**
 * Parse position tokenId to extract owner, pool, tickLower, tickUpper
 * Format: owner-pool-tickLower-tickUpper
 * Note: Both tickLower and tickUpper can be negative, which creates double dashes
 * Examples:
 *   - owner-pool-tickLower-tickUpper (both positive)
 *   - owner-pool--tickLower-tickUpper (tickLower negative)
 *   - owner-pool-tickLower--tickUpper (tickUpper negative)
 *   - owner-pool--tickLower--tickUpper (both negative)
 */
function parsePositionId(tokenId: string): {
  owner: string;
  pool: string;
  tickLower: string;
  tickUpper: string;
} | null {
  const parts = tokenId.split("-");
  
  // Need at least 4 parts: owner, pool, tickLower, tickUpper
  // Can have more if ticks are negative (double dashes create empty strings)
  if (parts.length < 4) {
    return null;
  }
  
  // Owner and pool are always the first two parts (Ethereum addresses)
  const owner = parts[0].toLowerCase();
  const pool = parts[1].toLowerCase();
  
  // Validate that owner and pool are addresses (start with 0x and are 42 chars)
  if (!owner.startsWith("0x") || owner.length !== 42) {
    return null;
  }
  if (!pool.startsWith("0x") || pool.length !== 42) {
    return null;
  }
  
  // Parse the remaining parts to extract tickLower and tickUpper
  // The pattern can be:
  // - parts[2], parts[3] (both positive: "tickLower", "tickUpper")
  // - "", parts[3], parts[4] (tickLower negative: "", "tickLower", "tickUpper")
  // - parts[2], "", parts[4] (tickUpper negative: "tickLower", "", "tickUpper")
  // - "", parts[3], "", parts[5] (both negative: "", "tickLower", "", "tickUpper")
  
  let tickLower: string;
  let tickUpper: string;
  let remainingParts = parts.slice(2);
  
  // Check if first remaining part is empty (tickLower is negative)
  if (remainingParts[0] === "") {
    // tickLower is negative
    if (remainingParts.length < 2) {
      return null;
    }
    tickLower = "-" + remainingParts[1];
    remainingParts = remainingParts.slice(2);
  } else {
    // tickLower is positive
    tickLower = remainingParts[0];
    remainingParts = remainingParts.slice(1);
  }
  
  // Now parse tickUpper
  if (remainingParts.length === 0) {
    return null;
  }
  
  // Check if first remaining part is empty (tickUpper is negative)
  if (remainingParts[0] === "") {
    // tickUpper is negative
    if (remainingParts.length < 2) {
      return null;
    }
    tickUpper = "-" + remainingParts[1];
  } else {
    // tickUpper is positive
    tickUpper = remainingParts[0];
  }
  
  // Validate that ticks are numeric
  if (!/^-?\d+$/.test(tickLower) || !/^-?\d+$/.test(tickUpper)) {
    return null;
  }
  
  return {
    owner,
    pool,
    tickLower,
    tickUpper,
  };
}

export interface PositionWithEvents extends Position {
  mints: SubgraphMint[];
  burns: SubgraphBurn[];
  collects: SubgraphCollect[];
}

export function usePositionDetails(tokenId: string) {
  const [position, setPosition] = useState<PositionWithEvents | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<SubgraphPositionByTicksResponse | null>(null);

  const fetchPosition = useCallback(async () => {
    if (!tokenId) {
      setPosition(null);
      setEvents(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Parse position ID to get components
      const positionParts = parsePositionId(tokenId);
      if (!positionParts) {
        console.warn("Invalid position ID format:", tokenId);
        setPosition(null);
        setEvents(null);
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

        setEvents(response);

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
            // Enhance position with event arrays
            const positionWithEvents: PositionWithEvents = {
              ...positionData,
              mints: response.mints || [],
              burns: response.burns || [],
              collects: response.collects || [],
            };
            setPosition(positionWithEvents);
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
  }, [tokenId]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  const refetch = useCallback(() => {
    fetchPosition();
  }, [fetchPosition]);

  return { position, isLoading, events, refetch };
}
