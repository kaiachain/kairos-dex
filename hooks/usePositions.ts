import { useQuery } from "@tanstack/react-query";
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
import { queryKeys } from "@/app/providers";

export interface PositionWithEvents extends Position {
  mintCount: number;
  burnCount: number;
  collectCount: number;
  mints: SubgraphMint[];
  burns: SubgraphBurn[];
  collects: SubgraphCollect[];
}

async function fetchPositions(
  address: string
): Promise<{ positions: PositionWithEvents[]; events: SubgraphPositionEventsResponse | null }> {
  try {
    // Try to fetch from subgraph using Mint, Burn, and Collect events
    const response = await query<SubgraphPositionEventsResponse>(
      GET_POSITION_EVENTS_QUERY,
      {
        owner: address.toLowerCase() as `0x${string}`,
        first: 1000, // Get more events to aggregate properly
        skip: 0,
      }
    );

    console.log("Positions response:", response);

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

      return { positions: positionsWithEvents, events: response };
    }

    return { positions: [], events: response };
  } catch (subgraphError) {
    console.warn("Failed to fetch positions from subgraph:", subgraphError);
    return { positions: [], events: null };
  }
}

export function usePositions() {
  const { address } = useAccount();

  // Get balance of NFTs (positions) - this can trigger refetch when balance changes
  const { data: balance } = useReadContract({
    address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
    abi: PositionManager_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.positions.list(address || ''),
    queryFn: () => address ? fetchPositions(address) : Promise.resolve({ positions: [], events: null }),
    enabled: !!address,
    staleTime: 2 * 60 * 1000, // 2 minutes - positions change more frequently
  });

  return {
    positions: data?.positions || [],
    isLoading,
    events: data?.events || null,
    error,
  };
}
