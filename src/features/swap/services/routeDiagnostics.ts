/**
 * Route Diagnostics Service
 * Analyzes why a route might not be found and provides user-friendly explanations
 */

import { Token } from "@/shared/types/token";
import { query } from "@/lib/graphql";
import { SubgraphPoolsResponse, SubgraphPool } from "@/shared/types/subgraph";

export interface RouteDiagnostic {
  hasDirectPool: boolean;
  poolsWithTokenIn: number;
  poolsWithTokenOut: number;
  poolsWithTokenInNoLiquidity: number; // Pools that exist but have no liquidity
  poolsWithTokenOutNoLiquidity: number;
  intermediateTokens: string[];
  possiblePaths: string[][];
  reason: string;
  suggestions: string[];
}

/**
 * Check if a direct pool exists between two tokens
 */
async function checkDirectPool(tokenIn: Token, tokenOut: Token): Promise<boolean> {
  try {
    const tokenInLower = tokenIn.address.toLowerCase();
    const tokenOutLower = tokenOut.address.toLowerCase();

    const DIRECT_POOL_QUERY = `
      query CheckDirectPool($token0: Bytes!, $token1: Bytes!) {
        pools(
          where: {
            or: [
              { token0: $token0, token1: $token1 }
              { token0: $token1, token1: $token0 }
            ]
          }
          first: 1
        ) {
          id
          liquidity
        }
      }
    `;

    const response = await query<SubgraphPoolsResponse>(DIRECT_POOL_QUERY, {
      token0: tokenInLower,
      token1: tokenOutLower,
    });

    const pools = response.pools || [];
    return pools.some(pool => pool.liquidity && BigInt(pool.liquidity) > BigInt(0));
  } catch (error) {
    console.error('Error checking direct pool:', error);
    return false;
  }
}

/**
 * Get pools containing a specific token
 */
async function getPoolsWithToken(token: Token): Promise<SubgraphPool[]> {
  try {
    const tokenLower = token.address.toLowerCase();

    const POOLS_WITH_TOKEN_QUERY = `
      query GetPoolsWithToken($token: Bytes!) {
        pools(
          where: {
            or: [
              { token0: $token }
              { token1: $token }
            ]
          }
          first: 200
          orderBy: totalValueLockedUSD
          orderDirection: desc
        ) {
          id
          token0 { 
            id
            symbol
            name
          }
          token1 { 
            id
            symbol
            name
          }
          feeTier
          liquidity
          totalValueLockedUSD
        }
      }
    `;

    const response = await query<SubgraphPoolsResponse>(POOLS_WITH_TOKEN_QUERY, {
      token: tokenLower,
    });

    const allPools = response.pools || [];
    console.log(`[Diagnostics] Fetched ${allPools.length} pools for ${token.symbol} (${tokenLower})`);
    
    const poolsWithLiquidity = allPools.filter(
      pool => pool.liquidity && BigInt(pool.liquidity) > BigInt(0)
    );
    
    const poolsWithoutLiquidity = allPools.filter(
      pool => !pool.liquidity || BigInt(pool.liquidity) === BigInt(0)
    );
    
    console.log(`[Diagnostics] ${poolsWithLiquidity.length} pools with liquidity for ${token.symbol}`);
    poolsWithLiquidity.forEach((pool, idx) => {
      const token0Lower = pool.token0.id.toLowerCase();
      const token1Lower = pool.token1.id.toLowerCase();
      const isToken0 = token0Lower === tokenLower;
      const otherToken = isToken0 ? pool.token1 : pool.token0;
      console.log(`  Pool ${idx + 1}: ${pool.token0.symbol || pool.token0.id} / ${pool.token1.symbol || pool.token1.id} (Other: ${otherToken.symbol || otherToken.id})`);
    });
    
    if (poolsWithoutLiquidity.length > 0) {
      console.log(`[Diagnostics] ${poolsWithoutLiquidity.length} pools WITHOUT liquidity for ${token.symbol}:`);
      poolsWithoutLiquidity.forEach((pool, idx) => {
        const token0Lower = pool.token0.id.toLowerCase();
        const token1Lower = pool.token1.id.toLowerCase();
        const isToken0 = token0Lower === tokenLower;
        const otherToken = isToken0 ? pool.token1 : pool.token0;
        console.log(`  Pool ${idx + 1} (NO LIQUIDITY): ${pool.token0.symbol || pool.token0.id} / ${pool.token1.symbol || pool.token1.id} (Other: ${otherToken.symbol || otherToken.id})`);
      });
    }
    
    // Return pools with liquidity for route finding, but we'll track no-liquidity pools separately
    return poolsWithLiquidity;
  } catch (error) {
    console.error('Error fetching pools with token:', error);
    return [];
  }
}

/**
 * Find intermediate tokens that could connect tokenIn to tokenOut
 */
function findIntermediateTokens(
  poolsWithTokenIn: SubgraphPool[],
  poolsWithTokenOut: SubgraphPool[],
  tokenIn: Token,
  tokenOut: Token
): { token: string; symbol: string; name: string }[] {
  const tokenInLower = tokenIn.address.toLowerCase();
  const tokenOutLower = tokenOut.address.toLowerCase();

  console.log(`[Diagnostics] Finding intermediate tokens:`);
  console.log(`  TokenIn: ${tokenIn.symbol} (${tokenInLower})`);
  console.log(`  TokenOut: ${tokenOut.symbol} (${tokenOutLower})`);
  console.log(`  Pools with TokenIn: ${poolsWithTokenIn.length}`);
  console.log(`  Pools with TokenOut: ${poolsWithTokenOut.length}`);

  // Get all tokens that tokenIn can reach
  const tokensFromIn = new Set<string>();
  const tokensFromInWithInfo = new Map<string, { symbol: string; name: string }>();
  
  for (const pool of poolsWithTokenIn) {
    const token0Lower = pool.token0.id.toLowerCase();
    const token1Lower = pool.token1.id.toLowerCase();
    
    let otherToken;
    if (token0Lower === tokenInLower) {
      otherToken = pool.token1;
    } else if (token1Lower === tokenInLower) {
      otherToken = pool.token0;
    } else {
      // Pool doesn't contain tokenIn - skip
      console.warn(`[Diagnostics] Pool ${pool.id} doesn't contain ${tokenIn.symbol}`);
      continue;
    }
    
    const otherTokenLower = otherToken.id.toLowerCase();
    if (otherTokenLower !== tokenOutLower) {
      tokensFromIn.add(otherTokenLower);
      tokensFromInWithInfo.set(otherTokenLower, {
        symbol: otherToken.symbol || 'Unknown',
        name: otherToken.name || 'Unknown Token',
      });
      console.log(`  [TokenIn] Can reach: ${otherToken.symbol || otherTokenLower} (${otherTokenLower})`);
    }
  }

  // Get all tokens that can reach tokenOut
  const tokensToOut = new Set<string>();
  const tokensToOutWithInfo = new Map<string, { symbol: string; name: string }>();
  
  for (const pool of poolsWithTokenOut) {
    const token0Lower = pool.token0.id.toLowerCase();
    const token1Lower = pool.token1.id.toLowerCase();
    
    let otherToken;
    if (token0Lower === tokenOutLower) {
      otherToken = pool.token1;
    } else if (token1Lower === tokenOutLower) {
      otherToken = pool.token0;
    } else {
      // Pool doesn't contain tokenOut - skip
      console.warn(`[Diagnostics] Pool ${pool.id} doesn't contain ${tokenOut.symbol}`);
      continue;
    }
    
    const otherTokenLower = otherToken.id.toLowerCase();
    if (otherTokenLower !== tokenInLower) {
      tokensToOut.add(otherTokenLower);
      tokensToOutWithInfo.set(otherTokenLower, {
        symbol: otherToken.symbol || 'Unknown',
        name: otherToken.name || 'Unknown Token',
      });
      console.log(`  [TokenOut] Can be reached from: ${otherToken.symbol || otherTokenLower} (${otherTokenLower})`);
    }
  }

  console.log(`  Tokens from TokenIn: ${Array.from(tokensFromIn).join(', ')}`);
  console.log(`  Tokens to TokenOut: ${Array.from(tokensToOut).join(', ')}`);

  // Find intersection (tokens that connect tokenIn to tokenOut)
  const intermediateAddresses = Array.from(tokensFromIn).filter(addr => tokensToOut.has(addr));
  console.log(`  Intermediate addresses (intersection): ${intermediateAddresses.join(', ')}`);

  // Get token info for intermediate tokens - prefer info from poolsWithTokenOut if available
  const intermediateTokens: { token: string; symbol: string; name: string }[] = [];
  for (const addr of intermediateAddresses) {
    const info = tokensToOutWithInfo.get(addr) || tokensFromInWithInfo.get(addr) || {
      symbol: 'Unknown',
      name: 'Unknown Token',
    };
    
    if (!intermediateTokens.find(t => t.token === addr)) {
      intermediateTokens.push({
        token: addr,
        symbol: info.symbol,
        name: info.name,
      });
      console.log(`  ✅ Found intermediate token: ${info.symbol} (${addr})`);
    }
  }

  console.log(`  Total intermediate tokens: ${intermediateTokens.length}`);
  return intermediateTokens;
}

/**
 * Generate possible paths through intermediate tokens
 */
function generatePossiblePaths(
  intermediateTokens: { token: string; symbol: string; name: string }[],
  tokenIn: Token,
  tokenOut: Token
): string[][] {
  const paths: string[][] = [];
  
  for (const intermediate of intermediateTokens.slice(0, 5)) { // Limit to top 5
    paths.push([
      tokenIn.symbol || tokenIn.address.slice(0, 6) + '...',
      intermediate.symbol,
      tokenOut.symbol || tokenOut.address.slice(0, 6) + '...',
    ]);
  }

  return paths;
}

/**
 * Generate user-friendly reason and suggestions
 */
function generateReasonAndSuggestions(
  diagnostic: Omit<RouteDiagnostic, 'reason' | 'suggestions'>
): { reason: string; suggestions: string[] } {
  const { hasDirectPool, poolsWithTokenIn, poolsWithTokenOut, poolsWithTokenInNoLiquidity, poolsWithTokenOutNoLiquidity, intermediateTokens } = diagnostic;

  if (hasDirectPool) {
    return {
      reason: 'A direct pool exists but may have insufficient liquidity for this swap amount.',
      suggestions: [
        'Try reducing the swap amount',
        'Wait for more liquidity to be added to the pool',
        'Check if the pool is active and has sufficient reserves',
      ],
    };
  }

  if (poolsWithTokenIn === 0 && poolsWithTokenOut === 0) {
    return {
      reason: `Neither ${diagnostic.poolsWithTokenIn === 0 ? 'tokenIn' : 'tokenOut'} has any active pools in the DEX.`,
      suggestions: [
        'These tokens may not be listed on this DEX yet',
        'Check if you have the correct token addresses',
        'Consider creating a pool for these tokens if you have liquidity',
      ],
    };
  }

  if (poolsWithTokenIn === 0) {
    return {
      reason: `${diagnostic.poolsWithTokenIn === 0 ? 'Token In' : 'Token Out'} has no active pools.`,
      suggestions: [
        'This token may not be listed on the DEX',
        'Consider creating a pool for this token',
        'Try swapping through a different token pair',
      ],
    };
  }

  if (poolsWithTokenOut === 0) {
    return {
      reason: `${diagnostic.poolsWithTokenOut === 0 ? 'Token Out' : 'Token In'} has no active pools.`,
      suggestions: [
        'This token may not be listed on the DEX',
        'Consider creating a pool for this token',
        'Try swapping through a different token pair',
      ],
    };
  }

  if (intermediateTokens.length === 0) {
    // Check if there are pools without liquidity that could connect them
    if (poolsWithTokenInNoLiquidity > 0 || poolsWithTokenOutNoLiquidity > 0) {
      return {
        reason: `No route found. Pools exist but have no liquidity. Found ${poolsWithTokenInNoLiquidity + poolsWithTokenOutNoLiquidity} pool(s) without liquidity that could potentially connect these tokens.`,
        suggestions: [
          'The pools exist but need liquidity to enable swaps',
          'Consider adding liquidity to the connecting pools (e.g., WKLAY/MTK or MTK/YTK)',
          'Wait for liquidity providers to add funds to these pools',
          'Try swapping through a different token pair that has active liquidity',
        ],
      };
    }
    
    return {
      reason: 'No intermediate tokens found that connect these two tokens.',
      suggestions: [
        'These tokens may not share any common trading pairs',
        'Try swapping through a more liquid token (like WKLAY or USDT)',
        'Consider creating a pool that connects these tokens',
      ],
    };
  }

  return {
    reason: 'Multi-hop route exists but router could not find a valid path. This may be due to insufficient liquidity or routing constraints.',
    suggestions: [
      'Try reducing the swap amount',
      'Try swapping through a more liquid intermediate token',
      'Check if all pools in the path have sufficient liquidity',
      'Wait a moment and try again - pools may be updating',
    ],
  };
}

/**
 * Diagnose why a route was not found
 */
export async function diagnoseRouteFailure(
  tokenIn: Token,
  tokenOut: Token
): Promise<RouteDiagnostic> {
  try {
    console.log(`🔍 Diagnosing route failure: ${tokenIn.symbol} -> ${tokenOut.symbol}`);
    console.log(`  TokenIn address: ${tokenIn.address}`);
    console.log(`  TokenOut address: ${tokenOut.address}`);

    // Check for direct pool
    const hasDirectPool = await checkDirectPool(tokenIn, tokenOut);
    console.log(`Direct pool exists: ${hasDirectPool}`);

    // Get pools for each token (with liquidity) - this function already logs pools without liquidity
    const [poolsWithTokenIn, poolsWithTokenOut] = await Promise.all([
      getPoolsWithToken(tokenIn),
      getPoolsWithToken(tokenOut),
    ]);
    
    // Also get all pools (including no liquidity) to count them
    const tokenInLower = tokenIn.address.toLowerCase();
    const tokenOutLower = tokenOut.address.toLowerCase();
    
    const ALL_POOLS_WITH_TOKEN_QUERY = `
      query GetAllPoolsWithToken($token: Bytes!) {
        pools(
          where: {
            or: [
              { token0: $token }
              { token1: $token }
            ]
          }
          first: 200
          orderBy: totalValueLockedUSD
          orderDirection: desc
        ) {
          id
          token0 { 
            id
            symbol
            name
          }
          token1 { 
            id
            symbol
            name
          }
          feeTier
          liquidity
          totalValueLockedUSD
        }
      }
    `;
    
    const [allPoolsWithTokenIn, allPoolsWithTokenOut] = await Promise.all([
      query<SubgraphPoolsResponse>(ALL_POOLS_WITH_TOKEN_QUERY, { token: tokenInLower }),
      query<SubgraphPoolsResponse>(ALL_POOLS_WITH_TOKEN_QUERY, { token: tokenOutLower }),
    ]);
    
    const poolsWithTokenInNoLiquidity = (allPoolsWithTokenIn.pools || []).filter(
      pool => !pool.liquidity || BigInt(pool.liquidity) === BigInt(0)
    ).length;
    
    const poolsWithTokenOutNoLiquidity = (allPoolsWithTokenOut.pools || []).filter(
      pool => !pool.liquidity || BigInt(pool.liquidity) === BigInt(0)
    ).length;
    
    console.log(`[Diagnostics] Pools without liquidity - TokenIn: ${poolsWithTokenInNoLiquidity}, TokenOut: ${poolsWithTokenOutNoLiquidity}`);
    
    // Check if there are pools without liquidity that could connect the tokens
    const allPoolsIn = allPoolsWithTokenIn.pools || [];
    const allPoolsOut = allPoolsWithTokenOut.pools || [];
    
    // Find potential intermediate tokens from ALL pools (including no liquidity)
    const potentialIntermediatesFromAllPools: string[] = [];
    for (const pool of allPoolsIn) {
      const token0Lower = pool.token0.id.toLowerCase();
      const token1Lower = pool.token1.id.toLowerCase();
      const otherToken = token0Lower === tokenInLower ? pool.token1 : pool.token0;
      if (otherToken.id.toLowerCase() !== tokenOutLower) {
        potentialIntermediatesFromAllPools.push(otherToken.id.toLowerCase());
      }
    }
    
    const potentialIntermediatesToAllPools: string[] = [];
    for (const pool of allPoolsOut) {
      const token0Lower = pool.token0.id.toLowerCase();
      const token1Lower = pool.token1.id.toLowerCase();
      const otherToken = token0Lower === tokenOutLower ? pool.token1 : pool.token0;
      if (otherToken.id.toLowerCase() !== tokenInLower) {
        potentialIntermediatesToAllPools.push(otherToken.id.toLowerCase());
      }
    }
    
    const missingIntermediates = Array.from(new Set(potentialIntermediatesFromAllPools))
      .filter(addr => potentialIntermediatesToAllPools.includes(addr))
      .filter(addr => !poolsWithTokenIn.some(p => {
        const t0 = p.token0.id.toLowerCase();
        const t1 = p.token1.id.toLowerCase();
        return (t0 === tokenInLower && t1 === addr) || (t1 === tokenInLower && t0 === addr);
      }));
    
    if (missingIntermediates.length > 0) {
      console.log(`[Diagnostics] ⚠️ Found ${missingIntermediates.length} potential intermediate token(s) that exist in pools but have NO LIQUIDITY`);
      missingIntermediates.forEach(addr => {
        // Try to get token info from pools
        for (const pool of allPoolsIn) {
          const t0 = pool.token0.id.toLowerCase();
          const t1 = pool.token1.id.toLowerCase();
          if (t0 === addr || t1 === addr) {
            const token = t0 === addr ? pool.token0 : pool.token1;
            console.log(`  - ${token.symbol || addr} (${addr}) - pool exists but has no liquidity`);
            break;
          }
        }
      });
    }

    console.log(`Pools with ${tokenIn.symbol}: ${poolsWithTokenIn.length}`);
    poolsWithTokenIn.forEach((pool, idx) => {
      const token0Lower = pool.token0.id.toLowerCase();
      const token1Lower = pool.token1.id.toLowerCase();
      const tokenInLower = tokenIn.address.toLowerCase();
      const otherToken = token0Lower === tokenInLower ? pool.token1 : pool.token0;
      console.log(`  Pool ${idx + 1}: ${pool.token0.symbol || pool.token0.id.slice(0, 10)}... / ${pool.token1.symbol || pool.token1.id.slice(0, 10)}...`);
      console.log(`    Other token: ${otherToken.symbol || otherToken.id} (${otherToken.id.toLowerCase()})`);
    });
    
    console.log(`Pools with ${tokenOut.symbol}: ${poolsWithTokenOut.length}`);
    poolsWithTokenOut.forEach((pool, idx) => {
      const token0Lower = pool.token0.id.toLowerCase();
      const token1Lower = pool.token1.id.toLowerCase();
      const tokenOutLower = tokenOut.address.toLowerCase();
      const otherToken = token0Lower === tokenOutLower ? pool.token1 : pool.token0;
      console.log(`  Pool ${idx + 1}: ${pool.token0.symbol || pool.token0.id.slice(0, 10)}... / ${pool.token1.symbol || pool.token1.id.slice(0, 10)}...`);
      console.log(`    Other token: ${otherToken.symbol || otherToken.id} (${otherToken.id.toLowerCase()})`);
    });

    // Find intermediate tokens
    const intermediateTokens = findIntermediateTokens(
      poolsWithTokenIn,
      poolsWithTokenOut,
      tokenIn,
      tokenOut
    );

    console.log(`Intermediate tokens found: ${intermediateTokens.length}`);
    if (intermediateTokens.length > 0) {
      intermediateTokens.forEach((token, idx) => {
        console.log(`  ${idx + 1}. ${token.symbol} (${token.token})`);
      });
    }

    // Generate possible paths
    const possiblePaths = generatePossiblePaths(intermediateTokens, tokenIn, tokenOut);

    // Build diagnostic object
    const diagnostic: Omit<RouteDiagnostic, 'reason' | 'suggestions'> = {
      hasDirectPool,
      poolsWithTokenIn: poolsWithTokenIn.length,
      poolsWithTokenOut: poolsWithTokenOut.length,
      poolsWithTokenInNoLiquidity,
      poolsWithTokenOutNoLiquidity,
      intermediateTokens: intermediateTokens.map(t => t.symbol),
      possiblePaths,
    };

    // Generate reason and suggestions
    const { reason, suggestions } = generateReasonAndSuggestions(diagnostic);

    return {
      ...diagnostic,
      reason,
      suggestions,
    };
  } catch (error) {
    console.error('Error diagnosing route failure:', error);
    return {
      hasDirectPool: false,
      poolsWithTokenIn: 0,
      poolsWithTokenOut: 0,
      intermediateTokens: [],
      possiblePaths: [],
      reason: 'Unable to diagnose route failure. Please check your connection and try again.',
      suggestions: [
        'Check your internet connection',
        'Verify the token addresses are correct',
        'Try again in a few moments',
      ],
    };
  }
}
