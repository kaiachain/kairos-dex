/**
 * QuoterV2 Service
 * Fast quote fetching using QuoterV2 contract directly
 */

import { Token } from "@/shared/types/token";
import { RPC_URL } from "@/config/env";
import { CONTRACTS } from "@/config/contracts";
import { QuoterV2_ABI } from "@/abis/QuoterV2";
import { getPoolAddress, getPoolInfo } from "@/lib/sdk-utils";
import { FeeAmount } from "@uniswap/v3-sdk";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { parseUnits, formatUnits } from "@/lib/utils";

export interface QuoterV2Result {
  amountOut: string;
  fee: number;
  gasEstimate: string;
  poolAddress: string;
}

/**
 * Fast quote using QuoterV2 contract directly (standard Uniswap v3 practice)
 * This is much faster (<1s) than the full router for simple swaps
 * Uses callStatic pattern as recommended by Uniswap docs
 */
export async function getFastQuoteFromQuoter(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  publicClient: any
): Promise<QuoterV2Result | null> {
  try {
    // Try common fee tiers in order of likelihood
    const feeTiers = [100, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH, 500, 3000, 10000];
    
    const amountInWei = parseUnits(amountIn, tokenIn.decimals || 18);
    
    // Create ethers provider for callStatic (standard Uniswap practice)
    const ethersProvider = new JsonRpcProvider(RPC_URL);
    const quoterContract = new Contract(CONTRACTS.QuoterV2, QuoterV2_ABI, ethersProvider);
    
    // Try each fee tier - stop on first success
    for (const fee of feeTiers) {
      try {
        const poolAddress = await getPoolAddress(tokenIn as any, tokenOut as any, fee);
        if (!poolAddress) continue;
        
        console.log(`Trying QuoterV2 for pool ${poolAddress} with fee ${fee}...`);
        
        // Get quote from QuoterV2 using callStatic (standard practice)
        try {
          const result = await quoterContract.callStatic.quoteExactInputSingle({
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn: amountInWei.toString(),
            fee: fee,
            sqrtPriceLimitX96: 0, // No price limit
          });
          
          if (result && Array.isArray(result) && result.length >= 4) {
            // Handle BigInt conversion properly
            let amountOut: bigint;
            let gasEstimate: bigint;
            
            if (typeof result[0] === 'bigint') {
              amountOut = result[0];
            } else if (typeof result[0] === 'string') {
              amountOut = BigInt(result[0]);
            } else {
              amountOut = BigInt(result[0].toString());
            }
            
            if (result[3] !== undefined && result[3] !== null) {
              if (typeof result[3] === 'bigint') {
                gasEstimate = result[3];
              } else if (typeof result[3] === 'string') {
                gasEstimate = BigInt(result[3]);
              } else {
                gasEstimate = BigInt(result[3].toString());
              }
            } else {
              gasEstimate = BigInt(0);
            }
            
            console.log(`✅ QuoterV2 quote successful for fee ${fee}`);
            return {
              amountOut: formatUnits(amountOut, tokenOut.decimals || 18),
              fee: Number(fee),
              gasEstimate: gasEstimate.toString(),
              poolAddress,
            };
          }
        } catch (quoterError: any) {
          // QuoterV2 failed - try pool state-based estimate as fallback
          const errorMsg = quoterError?.message || String(quoterError);
          console.log(`⚠️ QuoterV2 failed for fee ${fee}, trying pool state estimate. Error: ${errorMsg.substring(0, 150)}`);
          
          // Fallback: Calculate optimistic quote from pool state
          try {
            const poolInfo = await getPoolInfo(poolAddress);
            
            if (poolInfo && poolInfo.sqrtPriceX96 && poolInfo.liquidity > BigInt(0)) {
              // Calculate price from sqrtPriceX96
              const Q96 = BigInt(2) ** BigInt(96);
              const sqrtPrice = Number(poolInfo.sqrtPriceX96) / Number(Q96);
              const price = sqrtPrice * sqrtPrice;
              
              // Determine token order
              const tokenInLower = tokenIn.address.toLowerCase();
              const token0Lower = poolInfo.token0.toLowerCase();
              const isToken0 = tokenInLower === token0Lower;
              
              // Adjust for decimals
              const token0Decimals = isToken0 ? tokenIn.decimals || 18 : tokenOut.decimals || 18;
              const token1Decimals = isToken0 ? tokenOut.decimals || 18 : tokenIn.decimals || 18;
              const decimalsAdjustment = 10 ** (token0Decimals - token1Decimals);
              
              // Calculate spot price
              const spotPrice = isToken0 ? price * decimalsAdjustment : (1 / price) * (1 / decimalsAdjustment);
              
              // Estimate output (simplified - applies fee but doesn't account for price impact)
              const amountInNum = parseFloat(amountIn);
              const feeMultiplier = 1 - (Number(fee) / 1_000_000);
              const estimatedOut = amountInNum * spotPrice * feeMultiplier;
              
              if (estimatedOut > 0) {
                console.log(`✅ Using pool state estimate for fee ${fee} (instant quote)`);
                return {
                  amountOut: estimatedOut.toFixed(6),
                  fee: Number(fee),
                  gasEstimate: '150000', // Estimate
                  poolAddress,
                };
              }
            }
          } catch (poolError: any) {
            console.log(`Pool state estimate failed:`, poolError?.message || poolError);
          }
        }
      } catch (error: any) {
        console.log(`Error processing fee tier ${fee}:`, error?.message || error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Fast quote from QuoterV2 failed, will try router:', error);
    return null;
  }
}
