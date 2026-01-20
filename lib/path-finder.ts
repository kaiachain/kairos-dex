/**
 * Path Finder for Multi-Hop Routes
 * Uses subgraph to find the shortest path between tokens, then only queries relevant pools
 */

import { Token } from '@/types/token';
import { query } from './graphql';
import { GET_POOLS_QUERY } from './graphql-queries';
import { SubgraphPoolsResponse, SubgraphPool } from '@/types/subgraph';
import { getAddress } from '@ethersproject/address';
import { CONTRACTS } from '@/config/contracts';
import { QuoterV2_ABI } from '@/abis/QuoterV2';
import { SwapRouter02_ABI } from '@/abis/SwapRouter02';
import { parseUnits, formatUnits } from '@/lib/utils';
import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider } from '@ethersproject/providers';
import { RPC_URL } from '@/config/env';

interface PoolConnection {
  poolAddress: string;
  token0: string;
  token1: string;
  token0Decimals: number;
  token1Decimals: number;
  fee: number;
  liquidity: string;
}

interface TokenGraph {
  [tokenAddress: string]: {
    connections: Array<{
      token: string;
      pool: PoolConnection;
    }>;
  };
}

/**
 * Fetch all pools from subgraph (or pools containing the tokens we care about)
 */
async function fetchPoolsFromSubgraph(tokenIn?: Token, tokenOut?: Token): Promise<PoolConnection[]> {
  try {
    // If we have specific tokens, we can optimize by fetching pools that contain them
    // Otherwise, fetch all pools (may be slow if there are many)
    let pools: SubgraphPool[] = [];
    
    if (tokenIn && tokenOut) {
      // Fetch pools that contain either tokenIn or tokenOut
      // This is more efficient than fetching all pools
      const tokenInLower = tokenIn.address.toLowerCase();
      const tokenOutLower = tokenOut.address.toLowerCase();
      
      // Query for pools containing tokenIn (include token decimals to avoid extra calls)
      const POOLS_WITH_TOKEN_QUERY = `
        query GetPoolsWithToken($token: Bytes!) {
          pools(
            where: {
              or: [
                { token0: $token }
                { token1: $token }
              ]
            }
            first: 1000
            orderBy: totalValueLockedUSD
            orderDirection: desc
          ) {
            id
            token0 { 
              id
              decimals
            }
            token1 { 
              id
              decimals
            }
            feeTier
            liquidity
          }
        }
      `;
      
      const poolsWithTokenIn = await query<SubgraphPoolsResponse>(POOLS_WITH_TOKEN_QUERY, { token: tokenInLower });
      const poolsWithTokenOut = await query<SubgraphPoolsResponse>(POOLS_WITH_TOKEN_QUERY, { token: tokenOutLower });
      
      // Combine and deduplicate
      const allPools = [...(poolsWithTokenIn.pools || []), ...(poolsWithTokenOut.pools || [])];
      const uniquePools = new Map<string, SubgraphPool>();
      for (const pool of allPools) {
        uniquePools.set(pool.id.toLowerCase(), pool);
      }
      pools = Array.from(uniquePools.values());
    } else {
      // Fallback: fetch all pools (limit to reasonable number)
      const response = await query<SubgraphPoolsResponse>(GET_POOLS_QUERY, {
        first: 1000,
        skip: 0,
        orderBy: 'totalValueLockedUSD',
        orderDirection: 'desc',
      });
      pools = response.pools || [];
    }
    
    // Convert to PoolConnection format
    return pools
      .filter(pool => pool.liquidity && BigInt(pool.liquidity) > BigInt(0)) // Only pools with liquidity
      .map(pool => ({
        poolAddress: pool.id.toLowerCase(),
        token0: pool.token0.id.toLowerCase(),
        token1: pool.token1.id.toLowerCase(),
        token0Decimals: parseInt(pool.token0.decimals || '18', 10),
        token1Decimals: parseInt(pool.token1.decimals || '18', 10),
        fee: parseInt(pool.feeTier, 10),
        liquidity: pool.liquidity,
      }));
  } catch (error) {
    console.error('Error fetching pools from subgraph:', error);
    return [];
  }
}

/**
 * Build a graph of token connections from pools
 */
function buildTokenGraph(pools: PoolConnection[]): TokenGraph {
  const graph: TokenGraph = {};
  
  for (const pool of pools) {
    // Add connection from token0 to token1
    if (!graph[pool.token0]) {
      graph[pool.token0] = { connections: [] };
    }
    graph[pool.token0].connections.push({
      token: pool.token1,
      pool,
    });
    
    // Add connection from token1 to token0 (bidirectional)
    if (!graph[pool.token1]) {
      graph[pool.token1] = { connections: [] };
    }
    graph[pool.token1].connections.push({
      token: pool.token0,
      pool,
    });
  }
  
  return graph;
}

/**
 * Find shortest path between two tokens using BFS
 */
function findShortestPath(
  graph: TokenGraph,
  tokenIn: string,
  tokenOut: string,
  maxHops: number = 3
): PoolConnection[] | null {
  const tokenInLower = tokenIn.toLowerCase();
  const tokenOutLower = tokenOut.toLowerCase();
  
  // If same token, no path needed
  if (tokenInLower === tokenOutLower) {
    return [];
  }
  
  // BFS to find shortest path
  const queue: Array<{ token: string; path: PoolConnection[]; visited: Set<string> }> = [
    { token: tokenInLower, path: [], visited: new Set([tokenInLower]) }
  ];
  
  while (queue.length > 0) {
    const { token, path, visited } = queue.shift()!;
    
    // Check if we've reached the destination
    if (token === tokenOutLower) {
      return path;
    }
    
    // Limit hops
    if (path.length >= maxHops) {
      continue;
    }
    
    // Explore neighbors
    const neighbors = graph[token]?.connections || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.token)) {
        const newVisited = new Set(visited);
        newVisited.add(neighbor.token);
        queue.push({
          token: neighbor.token,
          path: [...path, neighbor.pool],
          visited: newVisited,
        });
      }
    }
  }
  
  return null; // No path found
}

/**
 * Find multi-hop route using subgraph
 * Returns array of pools that form the path: [WKLAY->MTK pool, MTK->YTK pool]
 */
export async function findMultiHopPath(
  tokenIn: Token,
  tokenOut: Token,
  maxHops: number = 3
): Promise<PoolConnection[] | null> {
  try {
    console.log(`Finding multi-hop path: ${tokenIn.symbol} -> ${tokenOut.symbol}`);
    
    // Fetch relevant pools from subgraph
    const pools = await fetchPoolsFromSubgraph(tokenIn, tokenOut);
    console.log(`Fetched ${pools.length} pools from subgraph`);
    
    if (pools.length === 0) {
      console.log('No pools found in subgraph');
      return null;
    }
    
    // Build token graph
    const graph = buildTokenGraph(pools);
    
    // Find shortest path
    const path = findShortestPath(
      graph,
      tokenIn.address,
      tokenOut.address,
      maxHops
    );
    
    if (path) {
      console.log(`✅ Found ${path.length}-hop path:`, path.map(p => `${p.token0}/${p.token1}`));
      return path;
    } else {
      console.log(`❌ No path found between ${tokenIn.symbol} and ${tokenOut.symbol}`);
      return null;
    }
  } catch (error) {
    console.error('Error finding multi-hop path:', error);
    return null;
  }
}

/**
 * Calculate quote for a multi-hop route by calculating each hop sequentially
 * Uses QuoterV2 for each hop in the path
 */
export async function calculateMultiHopQuote(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  path: PoolConnection[],
  publicClient: any
): Promise<{
  amountOut: string;
  fee: number;
  gasEstimate: string;
  poolAddress: string;
  routePath: string[];
  path: PoolConnection[]; // Store path for execution
} | null> {
  try {
    const ethersProvider = new JsonRpcProvider(RPC_URL);
    const quoterContract = new Contract(CONTRACTS.QuoterV2, QuoterV2_ABI, ethersProvider);
    
    let currentAmount = parseUnits(amountIn, tokenIn.decimals || 18);
    let currentToken = tokenIn;
    const routePath: string[] = [tokenIn.address.toLowerCase()];
    let totalGasEstimate = BigInt(0);
    
    // Calculate quote for each hop
    for (let i = 0; i < path.length; i++) {
      const pool = path[i];
      const currentTokenLower = currentToken.address.toLowerCase();
      
      // Determine next token address and decimals
      const isToken0 = pool.token0.toLowerCase() === currentTokenLower;
      const nextTokenAddress = isToken0 ? pool.token1 : pool.token0;
      const nextTokenDecimals = isToken0 ? pool.token1Decimals : pool.token0Decimals;
      
      try {
        // Get quote for this hop using QuoterV2
        const result = await quoterContract.callStatic.quoteExactInputSingle({
          tokenIn: currentToken.address,
          tokenOut: nextTokenAddress,
          amountIn: currentAmount.toString(),
          fee: pool.fee,
          sqrtPriceLimitX96: 0,
        });
        
        if (result && Array.isArray(result) && result.length >= 4) {
          // Handle BigInt conversion
          let amountOut: bigint;
          let gasEstimate: bigint;
          
          if (typeof result[0] === 'bigint') {
            amountOut = result[0];
          } else {
            amountOut = BigInt(result[0].toString());
          }
          
          if (result[3] !== undefined && result[3] !== null) {
            if (typeof result[3] === 'bigint') {
              gasEstimate = result[3];
            } else {
              gasEstimate = BigInt(result[3].toString());
            }
          } else {
            gasEstimate = BigInt(0);
          }
          
          totalGasEstimate += gasEstimate;
          currentAmount = amountOut;
          
          // Update current token for next iteration
          currentToken = {
            address: nextTokenAddress,
            symbol: '', // Not needed for calculation
            name: '',
            decimals: nextTokenDecimals,
          };
          
          routePath.push(nextTokenAddress);
          console.log(`Hop ${i + 1}/${path.length}: ${formatUnits(amountOut, nextTokenDecimals)} tokens`);
        } else {
          console.error(`Failed to get quote for hop ${i + 1}`);
          return null;
        }
      } catch (error: any) {
        console.error(`Error calculating quote for hop ${i + 1} (${pool.token0}/${pool.token1}):`, error?.message || error);
        return null;
      }
    }
    
    // Final amount out
    const amountOut = formatUnits(currentAmount, tokenOut.decimals || 18);
    
    // Only add tokenOut if it's not already the last token in the path
    const tokenOutLower = tokenOut.address.toLowerCase();
    if (routePath[routePath.length - 1] !== tokenOutLower) {
      routePath.push(tokenOutLower);
    }
    
    console.log(`✅ Multi-hop quote: ${amountIn} ${tokenIn.symbol} -> ${amountOut} ${tokenOut.symbol} via ${path.length} hop(s)`);
    
    return {
      amountOut,
      fee: path[0].fee, // Use fee from first pool
      gasEstimate: totalGasEstimate.toString(),
      poolAddress: path[0].poolAddress, // First pool address
      routePath,
      path, // Store the path for execution
    };
  } catch (error) {
    console.error('Error calculating multi-hop quote:', error);
    return null;
  }
}

/**
 * Build swap transaction calldata for multi-hop route
 * Encodes the path and calls SwapRouter02.exactInput
 */
export async function buildMultiHopSwapCalldata(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  amountOutMinimum: string,
  path: PoolConnection[],
  recipient: string,
  deadline: number
): Promise<{
  calldata: string;
  value: string;
} | null> {
  try {
    const ethersProvider = new JsonRpcProvider(RPC_URL);
    const routerContract = new Contract(CONTRACTS.SwapRouter02, SwapRouter02_ABI, ethersProvider);
    
    // Encode path: token0 (20 bytes) + fee (3 bytes) + token1 (20 bytes) + fee (3 bytes) + ...
    // For multi-hop: tokenIn -> fee -> token1 -> fee -> token2 -> ... -> tokenOut
    let pathBytes = '0x';
    
    // Start with tokenIn
    pathBytes += getAddress(tokenIn.address).slice(2); // Remove 0x, add address (20 bytes = 40 hex chars)
    
    // Track current token as we go through each hop
    let currentTokenAddress = tokenIn.address.toLowerCase();
    
    // Add each hop: fee (3 bytes = 6 hex chars) + next token (20 bytes = 40 hex chars)
    for (let i = 0; i < path.length; i++) {
      const pool = path[i];
      
      // Add fee (24 bits = 3 bytes = 6 hex chars, padded)
      const feeHex = pool.fee.toString(16).padStart(6, '0');
      pathBytes += feeHex;
      
      // Determine next token: the one that's not the current token
      const isToken0 = pool.token0.toLowerCase() === currentTokenAddress;
      const nextTokenAddress = isToken0 ? pool.token1 : pool.token0;
      
      // Add next token address
      pathBytes += getAddress(nextTokenAddress).slice(2);
      
      // Update current token for next iteration
      currentTokenAddress = nextTokenAddress.toLowerCase();
    }
    
    const amountInWei = parseUnits(amountIn, tokenIn.decimals || 18);
    const amountOutMinimumWei = parseUnits(amountOutMinimum, tokenOut.decimals || 18);
    const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;
    
    // Encode exactInput function call
    const exactInputCalldata = routerContract.interface.encodeFunctionData('exactInput', [{
      path: pathBytes,
      recipient: getAddress(recipient),
      deadline: deadlineTimestamp,
      amountIn: amountInWei.toString(),
      amountOutMinimum: amountOutMinimumWei.toString(),
    }]);
    
    // Wrap in multicall - this is the recommended Uniswap V3 pattern
    const multicallCalldata = routerContract.interface.encodeFunctionData('multicall', [[exactInputCalldata]]);
    
    console.log(`✅ Built multicall swap calldata for ${path.length}-hop path: ${tokenIn.symbol} -> ${tokenOut.symbol}`);
    
    return {
      calldata: multicallCalldata,
      value: '0', // No ETH value needed for token swaps
    };
  } catch (error) {
    console.error('Error building multi-hop swap calldata:', error);
    return null;
  }
}
