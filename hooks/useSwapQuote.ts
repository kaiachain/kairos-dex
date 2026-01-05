import { useState, useEffect } from "react";
import { Token } from "@/types/token";
import { SwapQuote } from "@/types/swap";
import { FeeAmount } from "@uniswap/v3-sdk";
import { Token as SDKToken } from "@uniswap/sdk-core";
import { formatUnits, parseUnits } from "@/lib/utils";
import { CONTRACTS } from "@/config/contracts";
import { QuoterV2_ABI } from "@/abis/QuoterV2";
import { Pool_ABI } from "@/abis/Pool";
import { Factory_ABI } from "@/abis/Factory";
import { createPublicClient, http } from "viem";
import { kairosTestnet } from "@/config/wagmi";
import { RPC_URL } from "@/config/env";
import { CHAIN_ID } from "@/config/env";

// Create a public client for read operations
const publicClient = createPublicClient({
  chain: kairosTestnet,
  transport: http(RPC_URL),
});

/**
 * Convert app Token to SDK Token
 */
function tokenToSDKToken(token: Token): SDKToken {
  return new SDKToken(
    CHAIN_ID,
    token.address as `0x${string}`,
    token.decimals,
    token.symbol,
    token.name
  );
}

/**
 * Check if pool exists by querying the Factory contract
 * Following the Uniswap V3 SDK docs pattern
 */
async function checkPoolExists(
  tokenA: SDKToken,
  tokenB: SDKToken,
  fee: FeeAmount
): Promise<string | null> {
  try {
    const poolAddress = await publicClient.readContract({
      address: CONTRACTS.V3CoreFactory as `0x${string}`,
      abi: Factory_ABI,
      functionName: "getPool",
      args: [
        tokenA.address as `0x${string}`,
        tokenB.address as `0x${string}`,
        fee,
      ],
    });

    // Check if pool exists (non-zero address)
    if (
      !poolAddress ||
      poolAddress === "0x0000000000000000000000000000000000000000"
    ) {
      return null;
    }

    return poolAddress as string;
  } catch (error) {
    console.error("Error checking if pool exists:", error);
    return null;
  }
}

/**
 * Get pool metadata (token0, token1, fee, liquidity, slot0)
 * Following the Uniswap V3 SDK docs pattern
 */
async function getPoolConstants(poolAddress: string): Promise<{
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
        functionName: "token0",
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: "token1",
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: "fee",
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: "liquidity",
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: Pool_ABI,
        functionName: "slot0",
      }),
    ]);

    // Handle slot0 as array (tuple)
    const sqrtPriceX96 = Array.isArray(slot0)
      ? (slot0[0] as bigint)
      : (slot0 as any).sqrtPriceX96;
    const tick = Array.isArray(slot0)
      ? Number(slot0[1])
      : Number((slot0 as any).tick);

    return {
      token0: token0 as string,
      token1: token1 as string,
      fee: Number(fee),
      liquidity: liquidity as bigint,
      sqrtPriceX96,
      tick,
    };
  } catch (error) {
    console.error("Error fetching pool constants:", error);
    return null;
  }
}

/**
 * Get quote using QuoterV2 contract
 * Following the Uniswap V3 SDK docs pattern
 * Note: QuoterV2 functions are non-view and designed to revert to return data
 * We use a raw call to simulate the execution (equivalent to callStatic in ethers.js)
 */
async function getQuoteFromQuoterV2(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  fee: FeeAmount
): Promise<{
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  initializedTicksCrossed: number;
  gasEstimate: bigint;
} | null> {
  try {
    const amountInWei = parseUnits(amountIn, tokenIn.decimals);

    // Encode the function call
    const { encodeFunctionData, decodeFunctionResult } = await import("viem");
    const data = encodeFunctionData({
      abi: QuoterV2_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          token: tokenIn.address as `0x${string}`,
          amountIn: amountInWei,
          fee: fee,
          sqrtPriceLimitX96: BigInt(0), // 0 means no price limit
        },
        tokenOut.address as `0x${string}`,
      ],
    });

    // Use call to simulate the execution
    // QuoterV2 functions revert with the return data, so we need to handle that
    try {
      const result = await publicClient.call({
        to: CONTRACTS.QuoterV2 as `0x${string}`,
        data: data as `0x${string}`,
      });

      if (!result.data || result.data === "0x") {
        return null;
      }

      // Decode the return data
      const decoded = decodeFunctionResult({
        abi: QuoterV2_ABI,
        functionName: "quoteExactInputSingle",
        data: result.data,
      });

      // Handle the return value - it's a tuple
      if (Array.isArray(decoded)) {
        return {
          amountOut: decoded[0] as bigint,
          sqrtPriceX96After: decoded[1] as bigint,
          initializedTicksCrossed: Number(decoded[2]),
          gasEstimate: decoded[3] as bigint,
        };
      }

      // If decoded is an object (named tuple)
      if (decoded && typeof decoded === "object") {
        return {
          amountOut: (decoded as any).amountOut as bigint,
          sqrtPriceX96After: (decoded as any).sqrtPriceX96After as bigint,
          initializedTicksCrossed: Number(
            (decoded as any).initializedTicksCrossed
          ),
          gasEstimate: (decoded as any).gasEstimate as bigint,
        };
      }
    } catch (callError: any) {
      // QuoterV2 can revert in two ways:
      // 1. Revert with return data (successful quote) - data is in the error
      // 2. Revert without data (failed quote) - this is expected and we return null

      // Try to extract return data from the revert
      // In viem, revert data might be in different places depending on error type
      let revertData: `0x${string}` | undefined;

      if (callError?.data) {
        revertData = callError.data as `0x${string}`;
      } else if (callError?.cause?.data) {
        revertData = callError.cause.data as `0x${string}`;
      } else if (callError?.cause?.cause?.data) {
        revertData = callError.cause.cause.data as `0x${string}`;
      }

      // If we have revert data, try to decode it
      if (revertData && revertData !== "0x" && revertData.length > 2) {
        try {
          // Check if the data looks like it contains function return data
          // QuoterV2 return data should start with the function selector or be the raw return
          const decoded = decodeFunctionResult({
            abi: QuoterV2_ABI,
            functionName: "quoteExactInputSingle",
            data: revertData,
          });

          if (Array.isArray(decoded)) {
            return {
              amountOut: decoded[0] as bigint,
              sqrtPriceX96After: decoded[1] as bigint,
              initializedTicksCrossed: Number(decoded[2]),
              gasEstimate: decoded[3] as bigint,
            };
          }

          if (decoded && typeof decoded === "object") {
            return {
              amountOut: (decoded as any).amountOut as bigint,
              sqrtPriceX96After: (decoded as any).sqrtPriceX96After as bigint,
              initializedTicksCrossed: Number(
                (decoded as any).initializedTicksCrossed
              ),
              gasEstimate: (decoded as any).gasEstimate as bigint,
            };
          }
        } catch (decodeError) {
          // If decoding fails, it's likely a real revert (not return data)
          // This is expected for pools without sufficient liquidity
        }
      }

      // If no return data or decode failed, it's a legitimate revert
      // This means the swap would fail (e.g., insufficient liquidity)
      // Return null silently - this is expected behavior
      return null;
    }

    return null;
  } catch (error) {
    // Only log unexpected errors, not expected reverts
    // Expected reverts (no liquidity, etc.) are handled above
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      !errorMessage.includes("revert") &&
      !errorMessage.includes("Execution reverted")
    ) {
      console.error("Unexpected error getting quote from QuoterV2:", error);
    }
    return null;
  }
}

/**
 * Find the best pool and get quote for a token pair
 * Checks multiple fee tiers and returns the best quote
 * Falls back to SDK-based quotes if QuoterV2 fails
 */
async function getBestQuote(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string
): Promise<{
  amountOut: string;
  fee: FeeAmount;
  gasEstimate: string;
  poolAddress: string;
} | null> {
  const sdkTokenIn = tokenToSDKToken(tokenIn);
  const sdkTokenOut = tokenToSDKToken(tokenOut);

  // Try all fee tiers to find the best route
  const feeTiers = [
    100,
    FeeAmount.LOW,
    FeeAmount.MEDIUM,
    FeeAmount.HIGH,
  ] as FeeAmount[];

  let bestQuote: {
    amountOut: bigint;
    fee: FeeAmount;
    gasEstimate: bigint;
    poolAddress: string;
  } | null = null;

  // First try QuoterV2 for each fee tier
  for (const fee of feeTiers) {
    try {
      // First check if pool exists by querying the Factory contract
      const poolAddress = await checkPoolExists(sdkTokenIn, sdkTokenOut, fee);
      if (!poolAddress) {
        continue;
      }

      // Verify pool has liquidity by fetching its constants
      const poolConstants = await getPoolConstants(poolAddress);
      if (!poolConstants || poolConstants.liquidity === BigInt(0)) {
        continue;
      }

      // Get quote from QuoterV2
      const quote = await getQuoteFromQuoterV2(
        tokenIn,
        tokenOut,
        amountIn,
        fee
      );
      if (!quote) {
        continue;
      }

      // Keep track of the best quote (highest amountOut)
      if (!bestQuote || quote.amountOut > bestQuote.amountOut) {
        bestQuote = {
          amountOut: quote.amountOut,
          fee: fee,
          gasEstimate: quote.gasEstimate,
          poolAddress: poolAddress,
        };
      }
    } catch (error) {
      // Continue to next fee tier
      continue;
    }
  }

  // If QuoterV2 didn't work, fall back to SDK-based quotes
  if (!bestQuote) {
    console.log("QuoterV2 failed, falling back to SDK-based quotes");
    try {
      const { createTrade } = await import("@/lib/sdk-utils");
      const tradeResult = await createTrade(
        tokenIn,
        tokenOut,
        amountIn,
        feeTiers
      );

      if (tradeResult && tradeResult.trade && tradeResult.trade.outputAmount) {
        // Convert SDK trade output to bigint for consistency
        const amountOutWei = BigInt(
          tradeResult.trade.outputAmount.quotient.toString()
        );
        const gasEstimate = BigInt(150000); // Estimated gas for SDK-based quotes

        console.log("SDK-based quote successful:", {
          amountOut: tradeResult.trade.outputAmount.toExact(),
          fee: tradeResult.fee,
          poolAddress: tradeResult.poolAddress,
        });

        bestQuote = {
          amountOut: amountOutWei,
          fee: tradeResult.fee,
          gasEstimate: gasEstimate,
          poolAddress: tradeResult.poolAddress,
        };
      } else {
        console.log("SDK-based quote also failed - no valid trade found");
      }
    } catch (error) {
      console.error("Error getting SDK-based quote:", error);
    }
  } else {
    console.log("QuoterV2 quote successful:", {
      amountOut: formatUnits(bestQuote.amountOut, tokenOut.decimals),
      fee: bestQuote.fee,
    });
  }

  if (!bestQuote) {
    return null;
  }

  return {
    amountOut: formatUnits(bestQuote.amountOut, tokenOut.decimals),
    fee: bestQuote.fee,
    gasEstimate: bestQuote.gasEstimate.toString(),
    poolAddress: bestQuote.poolAddress,
  };
}

export function useSwapQuote(
  tokenIn: Token | null,
  tokenOut: Token | null,
  amountIn: string
) {
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
      setQuote(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchQuote = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const quoteResult = await getBestQuote(tokenIn, tokenOut, amountIn);

        if (cancelled) return;

        if (!quoteResult) {
          setQuote(null);
          setIsLoading(false);
          return;
        }

        // Calculate price as amountOut / amountIn for display
        const price = parseFloat(quoteResult.amountOut) / parseFloat(amountIn);

        // For price impact, we'd need to compare with spot price
        // For now, we'll set it to 0 and calculate it properly when we have trade data
        const priceImpact = 0;

        setQuote({
          amountOut: quoteResult.amountOut,
          price,
          priceImpact,
          fee: quoteResult.fee,
          gasEstimate: quoteResult.gasEstimate,
          route: [tokenIn.address, tokenOut.address],
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching swap quote:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch quote")
        );
        setQuote(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchQuote();

    return () => {
      cancelled = true;
    };
  }, [tokenIn, tokenOut, amountIn]);

  return { data: quote, isLoading, error };
}
