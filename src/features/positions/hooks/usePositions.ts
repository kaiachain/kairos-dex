import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { Position } from "@/features/positions/types/position";
import { CONTRACTS } from "@/config/contracts";
import { PositionManager_ABI } from "@/abis/PositionManager";
import { Factory_ABI } from "@/abis/Factory";
import { query } from "@/lib/graphql";
import { GET_POSITION_EVENTS_QUERY } from "@/lib/graphql-queries";
import {
  SubgraphPositionEventsResponse,
  SubgraphMint,
  SubgraphBurn,
  SubgraphCollect,
} from "@/shared/types/subgraph";
import { aggregatePositionEvents } from "@/lib/subgraph-utils";
import { queryKeys } from "@/src/providers";
import { formatUnits, getAddress } from "viem";

export interface PositionWithEvents extends Position {
  mintCount: number;
  burnCount: number;
  collectCount: number;
  mints: SubgraphMint[];
  burns: SubgraphBurn[];
  collects: SubgraphCollect[];
}

async function fetchPositions(
  address: string,
  publicClient: any
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
      let positionsWithEvents: PositionWithEvents[] = positionsData.map(
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

      // Check uncollected fees for positions with 0 liquidity
      // These positions may have uncollected fees that need to be collected
      const positionsWithZeroLiquidity = positionsWithEvents.filter(
        (pos) => BigInt(pos.liquidity) === 0n
      );

      if (positionsWithZeroLiquidity.length > 0 && publicClient) {
        try {
          // Get all NFT tokenIds owned by the user
          const balance = await publicClient.readContract({
            address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
            abi: PositionManager_ABI,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          });

          const balanceNum = Number(balance);
          if (balanceNum === 0) {
            // No NFTs, skip checking
          } else {
            // Fetch all NFT tokenIds in parallel
            const tokenIdPromises = Array.from({ length: balanceNum }, (_, i) =>
              publicClient.readContract({
                address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
                abi: PositionManager_ABI,
                functionName: "tokenOfOwnerByIndex",
                args: [address as `0x${string}`, BigInt(i)],
              })
            );

            const nftTokenIds = await Promise.all(tokenIdPromises);

            // Fetch all position data in parallel using Promise.all
            // (multicall not available on this chain, but Promise.all still provides parallelism)
            const positionDataPromises = nftTokenIds.map((tokenId) =>
              publicClient.readContract({
                address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
                abi: PositionManager_ABI,
                functionName: "positions",
                args: [tokenId],
              }).catch((err) => {
                console.warn(`Error fetching position data for tokenId ${tokenId}:`, err);
                return null;
              })
            );

            const positionDataResults = await Promise.all(positionDataPromises);

            // Create a map to store NFT tokenId -> position data
            const nftPositionMap = new Map<
              bigint,
              {
                token0: string;
                token1: string;
                fee: number;
                tickLower: number;
                tickUpper: number;
                tokensOwed0: bigint;
                tokensOwed1: bigint;
                poolAddress: string | null;
              }
            >();

            // Process results and collect NFTs with uncollected fees
            const nftsWithFees: Array<{
              nftTokenId: bigint;
              token0: string;
              token1: string;
              fee: number;
              tickLower: number;
              tickUpper: number;
              tokensOwed0: bigint;
              tokensOwed1: bigint;
              sortedToken0: `0x${string}`;
              sortedToken1: `0x${string}`;
            }> = [];

            for (let i = 0; i < nftTokenIds.length; i++) {
              const posData = positionDataResults[i];
              if (!posData) continue;

              // Extract position data
              const token0 = (posData[2] as string).toLowerCase();
              const token1 = (posData[3] as string).toLowerCase();
              const fee = Number(posData[4] as bigint);
              const tickLower = Number(posData[5] as bigint);
              const tickUpper = Number(posData[6] as bigint);
              const tokensOwed0 = posData[10] as bigint;
              const tokensOwed1 = posData[11] as bigint;

              // Only process NFTs that have uncollected fees
              if (tokensOwed0 > 0n || tokensOwed1 > 0n) {
                const nftTokenId = nftTokenIds[i];

                // Get pool address from Factory contract (only for NFTs with fees)
                // Tokens must be in correct order (token0 < token1)
                const token0Addr = getAddress(token0);
                const token1Addr = getAddress(token1);
                const [sortedToken0, sortedToken1] =
                  token0Addr.toLowerCase() < token1Addr.toLowerCase()
                    ? [token0Addr, token1Addr]
                    : [token1Addr, token0Addr];

                nftsWithFees.push({
                  nftTokenId,
                  token0,
                  token1,
                  fee,
                  tickLower,
                  tickUpper,
                  tokensOwed0,
                  tokensOwed1,
                  sortedToken0,
                  sortedToken1,
                });
              }
            }

            // Batch fetch pool addresses in parallel using Promise.all
            // (multicall not available on this chain, but Promise.all still provides parallelism)
            if (nftsWithFees.length > 0) {
              const poolAddressPromises = nftsWithFees.map((nft) =>
                publicClient
                  .readContract({
                    address: CONTRACTS.V3CoreFactory as `0x${string}`,
                    abi: Factory_ABI,
                    functionName: "getPool",
                    args: [nft.sortedToken0, nft.sortedToken1, nft.fee],
                  })
                  .then((poolAddr) => {
                    return poolAddr && poolAddr !== "0x0000000000000000000000000000000000000000"
                      ? getAddress(poolAddr).toLowerCase()
                      : null;
                  })
                  .catch((err) => {
                    console.warn("Error getting pool address:", err);
                    return null;
                  })
              );

              const poolAddresses = await Promise.all(poolAddressPromises);

              // Build the map with pool addresses
              for (let i = 0; i < nftsWithFees.length; i++) {
                const nft = nftsWithFees[i];
                const poolAddress = poolAddresses[i];

                nftPositionMap.set(nft.nftTokenId, {
                  token0: nft.token0,
                  token1: nft.token1,
                  fee: nft.fee,
                  tickLower: nft.tickLower,
                  tickUpper: nft.tickUpper,
                  tokensOwed0: nft.tokensOwed0,
                  tokensOwed1: nft.tokensOwed1,
                  poolAddress,
                });
              }
            }

            // Match positions with 0 liquidity to NFTs and update uncollected fees
            for (const position of positionsWithZeroLiquidity) {
              // Parse position key: owner-pool-tickLower-tickUpper
              const parts = position.tokenId.split("-");
              if (parts.length < 4) continue;

              const poolAddress = parts[1]?.toLowerCase();
              const tickLower = parseInt(parts[2] || "0", 10);
              const tickUpper = parseInt(parts[3] || "0", 10);

              // Find matching NFT - try to match by pool address first, then by ticks
              for (const [nftTokenId, nftData] of nftPositionMap.entries()) {
                // Match by tickLower and tickUpper (required)
                const ticksMatch =
                  nftData.tickLower === tickLower && nftData.tickUpper === tickUpper;

                if (!ticksMatch) continue;

                // If pool address is available, use it for matching (more accurate)
                // Otherwise, we rely on ticks match which should be sufficient
                const poolMatches =
                  nftData.poolAddress === null ||
                  nftData.poolAddress === poolAddress;

                if (poolMatches) {
                  // Check if there are uncollected fees
                  if (nftData.tokensOwed0 > 0n || nftData.tokensOwed1 > 0n) {
                    // Calculate uncollected fees in USD
                    const uncollectedFees0 = parseFloat(
                      formatUnits(nftData.tokensOwed0, position.token0.decimals)
                    );
                    const uncollectedFees1 = parseFloat(
                      formatUnits(nftData.tokensOwed1, position.token1.decimals)
                    );
                    const uncollectedFeesUSD =
                      uncollectedFees0 * position.currentPrice + uncollectedFees1;

                    // Update position with uncollected fees
                    position.uncollectedFees = uncollectedFeesUSD;
                    break; // Found match, move to next position
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn("Error checking uncollected fees for zero-liquidity positions:", error);
          // Continue even if we can't check fees - positions will still be shown if they have liquidity
        }
      }

      // Filter positions: show only those with liquidity > 0 OR uncollected fees > 0
      positionsWithEvents = positionsWithEvents.filter(
        (pos) => BigInt(pos.liquidity) > 0n || pos.uncollectedFees > 0
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
  const publicClient = usePublicClient();

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
    queryFn: () => address && publicClient 
      ? fetchPositions(address, publicClient) 
      : Promise.resolve({ positions: [], events: null }),
    enabled: !!address && !!publicClient,
    staleTime: 2 * 60 * 1000, // 2 minutes - positions change more frequently
  });

  return {
    positions: data?.positions || [],
    isLoading,
    events: data?.events || null,
    error,
  };
}
