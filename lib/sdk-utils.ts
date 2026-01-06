import { Token as AppToken } from '@/types/token';
import { Token, CurrencyAmount, TradeType } from '@uniswap/sdk-core';
import { Pool, FeeAmount, Route, Trade, TickDataProvider } from '@uniswap/v3-sdk';
import { CHAIN_ID, RPC_URL } from '@/config/env';
import { createPublicClient, http, getAddress } from 'viem';
import { Pool_ABI } from '@/abis/Pool';
import { Factory_ABI } from '@/abis/Factory';
import { CONTRACTS } from '@/config/contracts';
import { kairosTestnet } from '@/config/wagmi';

// Create a public client for read operations
const publicClient = createPublicClient({
  chain: kairosTestnet,
  transport: http(RPC_URL),
});

/**
 * Custom TickDataProvider that fetches tick data from the blockchain
 * Implements the TickDataProvider interface required by Uniswap v3 SDK
 */
class BlockchainTickDataProvider implements TickDataProvider {
  private poolAddress: string;
  private cache: Map<number, { liquidityNet: string } | null> = new Map();

  constructor(poolAddress: string) {
    this.poolAddress = poolAddress;
  }

  async getTick(tick: number): Promise<{ liquidityNet: string }> {
    // Check cache first
    if (this.cache.has(tick)) {
      const cached = this.cache.get(tick);
      if (cached) return cached;
      // Return zero liquidity if tick not initialized
      return { liquidityNet: '0' };
    }

    try {
      const tickData = await publicClient.readContract({
        address: this.poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: 'ticks',
        args: [tick],
      });

      // Handle tuple response
      let liquidityNet: bigint;
      let initialized: boolean;

      if (Array.isArray(tickData)) {
        liquidityNet = tickData[1] as bigint; // liquidityNet is at index 1
        initialized = tickData[7] as boolean; // initialized is at index 7
      } else if (tickData && typeof tickData === 'object') {
        liquidityNet = (tickData as any).liquidityNet as bigint;
        initialized = (tickData as any).initialized as boolean;
      } else {
        this.cache.set(tick, null);
        return { liquidityNet: '0' };
      }

      if (!initialized) {
        this.cache.set(tick, null);
        return { liquidityNet: '0' };
      }

      const result = { liquidityNet: liquidityNet.toString() };
      this.cache.set(tick, result);
      return result;
    } catch (error) {
      // Tick doesn't exist or error fetching
      this.cache.set(tick, null);
      return { liquidityNet: '0' };
    }
  }

  async nextInitializedTickWithinOneWord(
    tick: number,
    lte: boolean,
    tickSpacing: number
  ): Promise<[number, boolean]> {
    // Calculate the compressed tick (rounded down to nearest tick spacing)
    const compressed = Math.floor(tick / tickSpacing) * tickSpacing;
    
    // Search within one word (256 ticks)
    const wordSize = 256;
    const searchDirection = lte ? -tickSpacing : tickSpacing;
    const maxIterations = wordSize;

    for (let i = 0; i < maxIterations; i++) {
      const currentTick = compressed + searchDirection * i;
      
      // Check if tick is within valid range
      if (currentTick < -887272 || currentTick > 887272) {
        return [lte ? -887272 : 887272, false];
      }

      const tickData = await this.getTick(currentTick);
      if (tickData && tickData.liquidityNet !== '0') {
        return [currentTick, true];
      }
    }

    // If no initialized tick found, return the boundary
    return [lte ? -887272 : 887272, false];
  }
}

/**
 * Convert app Token to SDK Token
 * Normalizes address to checksummed format
 * If decimals are missing or incorrect, they should be fetched from contract first
 */
export function tokenToSDKToken(token: AppToken): Token {
  // Normalize address to checksummed format
  const normalizedAddress = getAddress(token.address);
  
  // Validate decimals - should be between 0 and 18
  const decimals = token.decimals && token.decimals > 0 && token.decimals <= 18
    ? token.decimals
    : 18; // Default to 18 if invalid
  
  return new Token(
    CHAIN_ID,
    normalizedAddress,
    decimals,
    token.symbol,
    token.name
  );
}

/**
 * Get pool state from blockchain (liquidity, sqrtPriceX96, tick)
 */
export async function getPoolState(poolAddress: string) {
  try {
    const [slot0, liquidity] = await Promise.all([
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: 'slot0',
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: 'liquidity',
      }),
    ]);

    // Handle slot0 as either array (tuple) or object
    // Viem returns tuples as arrays: [sqrtPriceX96, tick, observationIndex, ...]
    let sqrtPriceX96: bigint;
    let tick: number;
    
    if (Array.isArray(slot0)) {
      // Tuple returned as array
      sqrtPriceX96 = slot0[0] as bigint;
      tick = Number(slot0[1]);
    } else if (slot0 && typeof slot0 === 'object') {
      // Tuple returned as object (if ABI has named outputs)
      sqrtPriceX96 = (slot0 as any).sqrtPriceX96 as bigint;
      tick = Number((slot0 as any).tick);
    } else {
      throw new Error('Unexpected slot0 return format');
    }

    console.log('Pool state:', {
      sqrtPriceX96: sqrtPriceX96.toString(),
      tick,
      liquidity: liquidity.toString(),
    });

    return {
      sqrtPriceX96,
      tick,
      liquidity: liquidity as bigint,
    };
  } catch (error) {
    console.error('Error fetching pool state:', error);
    throw error;
  }
}

/**
 * Create SDK Pool from pool address and state
 */
export async function createSDKPool(
  token0: Token,
  token1: Token,
  fee: FeeAmount,
  poolAddress: string
): Promise<Pool | null> {
  try {
    const state = await getPoolState(poolAddress);
    
    if (state.liquidity === BigInt(0)) {
      return null;
    }

    // Create a BlockchainTickDataProvider that fetches tick data from the blockchain
    const tickDataProvider = new BlockchainTickDataProvider(poolAddress);

    return new Pool(
      token0,
      token1,
      fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick,
      tickDataProvider
    );
  } catch (error) {
    console.error('Error creating SDK pool:', error);
    return null;
  }
}

/**
 * Get pool address from Factory contract
 */
export async function getPoolAddress(
  tokenA: Token,
  tokenB: Token,
  fee: FeeAmount
): Promise<string | null> {
  try {
    // Ensure addresses are checksummed
    const tokenAAddress = getAddress(tokenA.address) as `0x${string}`;
    const tokenBAddress = getAddress(tokenB.address) as `0x${string}`;
    
    const poolAddress = await publicClient.readContract({
      address: CONTRACTS.V3CoreFactory as `0x${string}`,
      abi: Factory_ABI,
      functionName: 'getPool',
      args: [tokenAAddress, tokenBAddress, fee],
    });

    const normalizedPoolAddress = poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000'
      ? getAddress(poolAddress)
      : null;
    
    if (normalizedPoolAddress) {
      console.log(`Found pool at ${normalizedPoolAddress} for tokens ${tokenAAddress}/${tokenBAddress} with fee ${fee}`);
    }
    
    return normalizedPoolAddress;
  } catch (error) {
    console.error(`Error getting pool address for fee ${fee}:`, error);
    return null;
  }
}

/**
 * Find the best pool for a token pair
 * This will check multiple fee tiers and return the best one
 */
export async function findBestPool(
  tokenIn: Token,
  tokenOut: Token,
  feeTiers: FeeAmount[] = [100, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH] as FeeAmount[]
): Promise<{ pool: Pool; fee: FeeAmount; poolAddress: string } | null> {
  // Ensure tokens are in correct order (token0 < token1)
  // Use checksummed addresses for comparison
  const tokenInAddr = getAddress(tokenIn.address);
  const tokenOutAddr = getAddress(tokenOut.address);
  
  const [token0, token1] = tokenInAddr.toLowerCase() < tokenOutAddr.toLowerCase()
    ? [tokenIn, tokenOut]
    : [tokenOut, tokenIn];
  
  console.log(`Finding pool for tokens: ${token0.address} / ${token1.address}`);
  console.log(`Checking fee tiers:`, feeTiers);
  
  for (const fee of feeTiers) {
    try {
      const poolAddress = await getPoolAddress(token0, token1, fee);
      
      if (!poolAddress) {
        console.log(`No pool found for fee tier ${fee}`);
        continue;
      }

      console.log(`Found pool address ${poolAddress} for fee ${fee}, fetching state...`);
      const pool = await createSDKPool(token0, token1, fee, poolAddress);

      if (pool) {
        console.log(`Successfully created SDK pool with liquidity: ${pool.liquidity.toString()}`);
        // Return immediately when we find a valid pool - no need to check other fee tiers
        return { pool, fee, poolAddress };
      } else {
        console.log(`Pool exists but has zero liquidity or failed to create SDK pool`);
      }
    } catch (error) {
      console.error(`Error checking pool for fee ${fee}:`, error);
      // Pool doesn't exist for this fee tier, try next one
      continue;
    }
  }

  console.log(`No valid pool found for token pair`);
  return null;
}

/**
 * Ensure token has correct decimals by fetching from contract if needed
 */
async function ensureTokenDecimals(token: AppToken): Promise<AppToken> {
  // If decimals are missing or seem incorrect (default 18), fetch from contract
  if (!token.decimals || token.decimals === 18) {
    try {
      const { fetchTokenInfo } = await import('@/hooks/useTokenInfo');
      const tokenInfo = await fetchTokenInfo(token.address);
      if (tokenInfo) {
        return { ...token, decimals: tokenInfo.decimals };
      }
    } catch (error) {
      console.warn(`Could not fetch decimals for token ${token.address}, using provided value`);
    }
  }
  return token;
}

/**
 * Get pool information (token0, token1, fee, liquidity, sqrtPriceX96, tick)
 * Following the Uniswap V3 SDK docs: "Constructing a route from pool information"
 */
export async function getPoolInfo(poolAddress: string): Promise<{
  token0: string;
  token1: string;
  fee: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
  tick: number;
} | null> {
  try {
    const [token0, token1, fee, liquidity, slot0] = await Promise.all([
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: 'token0',
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: 'token1',
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: 'fee',
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: 'liquidity',
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: 'slot0',
      }),
    ]);

    // Handle slot0 as either array (tuple) or object
    let sqrtPriceX96: bigint;
    let tick: number;
    
    if (Array.isArray(slot0)) {
      sqrtPriceX96 = slot0[0] as bigint;
      tick = Number(slot0[1]);
    } else if (slot0 && typeof slot0 === 'object') {
      sqrtPriceX96 = (slot0 as any).sqrtPriceX96 as bigint;
      tick = Number((slot0 as any).tick);
    } else {
      throw new Error('Unexpected slot0 return format');
    }

    return {
      token0: token0 as string,
      token1: token1 as string,
      fee: Number(fee),
      liquidity: liquidity as bigint,
      sqrtPriceX96,
      tick,
    };
  } catch (error) {
    console.error('Error getting pool info:', error);
    return null;
  }
}

/**
 * Construct route and unchecked trade from quote
 * Following the Uniswap V3 SDK docs: "Executing a Trade"
 * This function implements steps 1-2 from the guide:
 * 1. Constructing a route from pool information
 * 2. Constructing an unchecked trade
 */
export async function createUncheckedTradeFromQuote(
  tokenIn: AppToken,
  tokenOut: AppToken,
  amountIn: string,
  amountOut: string,
  poolAddress: string,
  fee: FeeAmount
): Promise<{
  trade: Trade<Token, Token, TradeType.EXACT_INPUT>;
  route: Route<Token, Token>;
} | null> {
  if (!amountIn || parseFloat(amountIn) <= 0 || !amountOut || parseFloat(amountOut) <= 0) {
    return null;
  }

  // Ensure tokens have correct decimals
  const tokenInWithDecimals = await ensureTokenDecimals(tokenIn);
  const tokenOutWithDecimals = await ensureTokenDecimals(tokenOut);

  const sdkTokenIn = tokenToSDKToken(tokenInWithDecimals);
  const sdkTokenOut = tokenToSDKToken(tokenOutWithDecimals);

  // Step 1: Get pool information
  // Following the docs: "Constructing a route from pool information"
  const poolInfo = await getPoolInfo(poolAddress);
  if (!poolInfo) {
    console.error('Failed to get pool info');
    return null;
  }

  // Get token0 and token1 from pool to ensure correct ordering
  // The pool contract stores tokens in the correct order (token0 < token1)
  const poolToken0Address = getAddress(poolInfo.token0);
  const poolToken1Address = getAddress(poolInfo.token1);
  
  // Determine which token is token0 and which is token1
  const tokenInAddress = getAddress(sdkTokenIn.address);
  const tokenOutAddress = getAddress(sdkTokenOut.address);
  
  // Map our tokens to pool's token0/token1 order
  const token0 = tokenInAddress.toLowerCase() === poolToken0Address.toLowerCase() 
    ? sdkTokenIn 
    : tokenOutAddress.toLowerCase() === poolToken0Address.toLowerCase() 
    ? sdkTokenOut 
    : sdkTokenIn; // fallback (shouldn't happen if pool is correct)
    
  const token1 = tokenInAddress.toLowerCase() === poolToken1Address.toLowerCase() 
    ? sdkTokenIn 
    : tokenOutAddress.toLowerCase() === poolToken1Address.toLowerCase() 
    ? sdkTokenOut 
    : sdkTokenOut; // fallback

  // Construct Pool instance with tokens in correct order
  const tickDataProvider = new BlockchainTickDataProvider(poolAddress);
  const pool = new Pool(
    token0,
    token1,
    fee,
    poolInfo.sqrtPriceX96.toString(),
    poolInfo.liquidity.toString(),
    poolInfo.tick,
    tickDataProvider
  );

  // Create route from pool
  // Following the docs: "Creating a Route"
  // Route uses input/output tokens, not necessarily token0/token1
  // The Route constructor handles token ordering automatically
  const route = new Route([pool], sdkTokenIn, sdkTokenOut);
  
  // Verify route is valid
  if (route.pools.length === 0) {
    console.error('Failed to create route - no pools');
    return null;
  }
  
  console.log('Route created:', {
    input: route.input.address,
    output: route.output.address,
    pools: route.pools.length,
    midPrice: route.midPrice.toFixed(),
  });

  // Step 2: Construct unchecked trade
  // Following the docs: "Constructing an unchecked trade"
  // We use the quote's amountOut since we already have it from the Quoter
  const amountInWei = parseFloat(amountIn) * 10 ** tokenInWithDecimals.decimals;
  const amountOutWei = parseFloat(amountOut) * 10 ** tokenOutWithDecimals.decimals;

  // Use BigInt for precise calculations to avoid floating point errors
  const amountInWeiBigInt = BigInt(Math.floor(amountInWei));
  const amountOutWeiBigInt = BigInt(Math.floor(amountOutWei));

  const inputAmount = CurrencyAmount.fromRawAmount(
    sdkTokenIn,
    amountInWeiBigInt.toString()
  );

  const outputAmount = CurrencyAmount.fromRawAmount(
    sdkTokenOut,
    amountOutWeiBigInt.toString()
  );

  // Use Trade.createUncheckedTrade as shown in the guide
  const trade = Trade.createUncheckedTrade({
    route,
    inputAmount,
    outputAmount,
    tradeType: TradeType.EXACT_INPUT,
  });

  console.log('Unchecked trade created from quote:', {
    inputAmount: trade.inputAmount.toExact(),
    inputAmountRaw: trade.inputAmount.quotient.toString(),
    outputAmount: trade.outputAmount.toExact(),
    outputAmountRaw: trade.outputAmount.quotient.toString(),
    tokenInDecimals: tokenInWithDecimals.decimals,
    tokenOutDecimals: tokenOutWithDecimals.decimals,
    sdkTokenInDecimals: sdkTokenIn.decimals,
    sdkTokenOutDecimals: sdkTokenOut.decimals,
  });

  return {
    trade,
    route,
  };
}

/**
 * Create a trade using the SDK
 * Following the Uniswap V3 SDK docs pattern for constructing trades
 */
export async function createTrade(
  tokenIn: AppToken,
  tokenOut: AppToken,
  amountIn: string,
  feeTiers: FeeAmount[] = [100, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH] as FeeAmount[]
): Promise<{
  trade: Trade<Token, Token, TradeType.EXACT_INPUT>;
  route: Route<Token, Token>;
  fee: FeeAmount;
  poolAddress: string;
} | null> {
  if (!amountIn || parseFloat(amountIn) <= 0) {
    return null;
  }

  // Ensure tokens have correct decimals
  const tokenInWithDecimals = await ensureTokenDecimals(tokenIn);
  const tokenOutWithDecimals = await ensureTokenDecimals(tokenOut);

  const sdkTokenIn = tokenToSDKToken(tokenInWithDecimals);
  const sdkTokenOut = tokenToSDKToken(tokenOutWithDecimals);
  
  // Find best pool
  const bestPool = await findBestPool(sdkTokenIn, sdkTokenOut, feeTiers);
  
  if (!bestPool) {
    return null;
  }

  // Create route from pool information
  // Following the docs: "Constructing a route from pool information"
  const route = new Route([bestPool.pool], sdkTokenIn, sdkTokenOut);

  // Create trade
  // Parse amount with proper decimals (use the token with correct decimals)
  const amountInWei = parseFloat(amountIn) * 10 ** tokenInWithDecimals.decimals;
  const amountInCurrency = CurrencyAmount.fromRawAmount(
    sdkTokenIn,
    Math.floor(amountInWei).toString()
  );

  try {
    // Trade.exactIn is a static method that returns a Promise
    // It needs the pool's tick data provider to calculate the swap
    // Following the docs: "Constructing an unchecked trade"
    const trade = await Trade.exactIn(route, amountInCurrency);
    
    // Verify trade was created successfully
    if (!trade) {
      console.error('Trade creation returned null/undefined');
      return null;
    }

    // Check if outputAmount exists
    if (!trade.outputAmount) {
      console.error('Trade created but outputAmount is undefined');
      return null;
    }

    console.log('Trade created successfully:', {
      inputAmount: trade.inputAmount.toExact(),
      outputAmount: trade.outputAmount.toExact(),
      executionPrice: trade.executionPrice.toFixed(),
    });

    return {
      trade,
      route,
      fee: bestPool.fee,
      poolAddress: bestPool.poolAddress,
    };
  } catch (error) {
    console.error('Error creating trade:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return null;
  }
}
