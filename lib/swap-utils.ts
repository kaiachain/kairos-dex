import { parseUnits, formatUnits } from './utils';
import { Token } from '@/types/token';
import { getPoolInfo } from './sdk-utils';

/**
 * Calculate price impact for a swap
 * Price impact = (expectedOutput - actualOutput) / expectedOutput * 100
 * 
 * @param amountIn - Input amount in token units (string)
 * @param amountOut - Output amount from quote in token units (string)
 * @param tokenIn - Input token
 * @param tokenOut - Output token
 * @param poolAddress - Pool address
 * @param fee - Fee tier
 * @returns Price impact percentage (0-100)
 */
export async function calculatePriceImpact(
  amountIn: string,
  amountOut: string,
  tokenIn: Token,
  tokenOut: Token,
  poolAddress: string,
  fee: number
): Promise<number> {
  if (!amountIn || !amountOut || parseFloat(amountIn) <= 0 || parseFloat(amountOut) <= 0) {
    return 0;
  }

  try {
    // Get pool info to calculate spot price
    const poolInfo = await getPoolInfo(poolAddress);
    if (!poolInfo) {
      return 0;
    }

    // Calculate spot price from sqrtPriceX96
    // Price = (sqrtPriceX96 / 2^96)^2
    const Q96 = BigInt(2) ** BigInt(96);
    const sqrtPrice = Number(poolInfo.sqrtPriceX96) / Number(Q96);
    const price = sqrtPrice * sqrtPrice;

    // Adjust for token decimals
    const decimalsAdjustment = 10 ** (tokenIn.decimals - tokenOut.decimals);
    const spotPrice = price * decimalsAdjustment;

    // Calculate expected output at spot price
    const amountInNum = parseFloat(amountIn);
    const expectedOut = amountInNum * spotPrice;

    // Actual output from quote
    const actualOut = parseFloat(amountOut);

    // Calculate price impact
    if (expectedOut <= 0) {
      return 0;
    }

    const impact = ((expectedOut - actualOut) / expectedOut) * 100;
    return Math.max(0, impact);
  } catch (error) {
    console.error('Error calculating price impact:', error);
    return 0;
  }
}

/**
 * Calculate optimal swap size based on pool liquidity
 * Uses a conservative approach: max swap should not exceed 10% of available liquidity
 * 
 * @param poolAddress - Pool address
 * @param tokenIn - Input token
 * @param tokenOut - Output token
 * @param fee - Fee tier
 * @returns Optimal swap size in token units (string) or null if cannot determine
 */
export async function calculateOptimalSwapSize(
  poolAddress: string,
  tokenIn: Token,
  tokenOut: Token,
  fee: number
): Promise<string | null> {
  try {
    const poolInfo = await getPoolInfo(poolAddress);
    if (!poolInfo || poolInfo.liquidity === BigInt(0)) {
      return null;
    }

    // Get current price
    const Q96 = BigInt(2) ** BigInt(96);
    const sqrtPrice = Number(poolInfo.sqrtPriceX96) / Number(Q96);
    const price = sqrtPrice * sqrtPrice;
    const decimalsAdjustment = 10 ** (tokenIn.decimals - tokenOut.decimals);
    const spotPrice = price * decimalsAdjustment;

    // Estimate available liquidity in token0 terms
    // For simplicity, we'll use a conservative estimate
    // In reality, liquidity is distributed across ticks, but this gives a rough estimate
    const liquidity = poolInfo.liquidity;
    
    // Convert liquidity to a rough estimate of token amounts
    // This is a simplified calculation - in reality, we'd need to check tick ranges
    // For now, we'll use a conservative 5% of liquidity as max swap size
    const maxSwapPercentage = 0.05; // 5% of liquidity
    
    // Rough estimate: liquidity represents sqrt(x * y), so we can estimate available amounts
    // This is a simplified approach - for production, you'd want to check actual tick ranges
    const estimatedLiquidityValue = Number(liquidity) / 1e18; // Rough conversion
    
    // Calculate max swap in tokenIn terms
    // We'll be conservative and use a smaller percentage
    const maxSwapInTokenIn = estimatedLiquidityValue * maxSwapPercentage;
    
    // Ensure it's reasonable (not too small, not too large)
    const minSwap = 0.001; // Minimum 0.001 tokens
    const maxSwap = 1000; // Maximum 1000 tokens
    
    const optimalSize = Math.max(minSwap, Math.min(maxSwap, maxSwapInTokenIn));
    
    return optimalSize.toFixed(6);
  } catch (error) {
    console.error('Error calculating optimal swap size:', error);
    return null;
  }
}

/**
 * Check if pool has sufficient liquidity for a swap
 * 
 * @param amountIn - Input amount in token units (string)
 * @param tokenIn - Input token
 * @param tokenOut - Output token
 * @param poolAddress - Pool address
 * @param fee - Fee tier
 * @returns Object with sufficient flag and message
 */
export async function checkPoolLiquidity(
  amountIn: string,
  tokenIn: Token,
  tokenOut: Token,
  poolAddress: string,
  fee: number
): Promise<{
  sufficient: boolean;
  message?: string;
  availableLiquidity?: string;
}> {
  if (!amountIn || parseFloat(amountIn) <= 0) {
    return { sufficient: false, message: 'Invalid input amount' };
  }

  try {
    const poolInfo = await getPoolInfo(poolAddress);
    if (!poolInfo) {
      return { sufficient: false, message: 'Could not fetch pool information' };
    }

    if (poolInfo.liquidity === BigInt(0)) {
      return { sufficient: false, message: 'Pool has no liquidity' };
    }

    // Check if pool has reasonable liquidity
    // For now, we'll just check that liquidity exists
    // A more sophisticated check would require getting a quote, but that's handled by the router
    const liquidityThreshold = BigInt(1000); // Minimum liquidity threshold
    if (poolInfo.liquidity < liquidityThreshold) {
      return {
        sufficient: false,
        message: 'Pool has very low liquidity',
        availableLiquidity: formatUnits(poolInfo.liquidity, 18),
      };
    }

    return {
      sufficient: true,
      availableLiquidity: formatUnits(poolInfo.liquidity, 18),
    };
  } catch (error) {
    console.error('Error checking pool liquidity:', error);
    return {
      sufficient: false,
      message: 'Error checking pool liquidity',
    };
  }
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param initialDelay - Initial delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error | unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate exponential backoff delay
      delay = Math.min(delay * 2, maxDelay);
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      const finalDelay = delay + jitter;

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${finalDelay.toFixed(0)}ms`);
      
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }

  throw lastError;
}

/**
 * Get fresh quote immediately before transaction execution
 * Note: This function is deprecated - use the router's getRouterRoute instead
 * Kept for backward compatibility but will return null
 * 
 * @deprecated Use getRouterRoute from useSwapQuote hook instead
 */
export async function getFreshQuote(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  fee: number,
  poolAddress: string,
  maxRetries: number = 3
): Promise<{
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  initializedTicksCrossed: number;
  gasEstimate: bigint;
} | null> {
  // This function is deprecated - quotes should be obtained from the router
  console.warn('getFreshQuote is deprecated - use getRouterRoute from useSwapQuote hook instead');
  return null;
}

/**
 * Calculate suggested slippage based on price impact
 * 
 * @param priceImpact - Price impact percentage
 * @returns Suggested slippage percentage
 */
export function calculateSuggestedSlippage(priceImpact: number): number {
  // Base slippage
  let suggested = 0.5;
  
  // Add buffer based on price impact
  if (priceImpact > 10) {
    suggested = Math.max(suggested, priceImpact * 1.5); // 1.5x price impact
  } else if (priceImpact > 5) {
    suggested = Math.max(suggested, priceImpact * 1.3); // 1.3x price impact
  } else if (priceImpact > 2) {
    suggested = Math.max(suggested, priceImpact * 1.2); // 1.2x price impact
  } else {
    suggested = Math.max(suggested, priceImpact * 1.1); // 1.1x price impact
  }
  
  // Add safety buffer
  suggested += 0.5;
  
  // Cap at reasonable maximum (20%)
  return Math.min(suggested, 20);
}

