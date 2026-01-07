/**
 * Swap Quote Hook
 * 
 * This hook follows the workflow from debug-quoter.js:
 * 1. Check pool existence and get pool address
 * 2. Verify pool state (token0, token1, fee, liquidity, slot0)
 * 3. Verify pool has liquidity
 * 4. Call QuoterV2 with proper revert handling (QuoterV2 intentionally reverts with quote data)
 */

import { useState, useEffect } from "react";
import { Token } from "@/types/token";
import { SwapQuote } from "@/types/swap";
import { FeeAmount } from "@uniswap/v3-sdk";
import { formatUnits, parseUnits } from "@/lib/utils";
import { CONTRACTS } from "@/config/contracts";
import { QuoterV2_ABI } from "@/abis/QuoterV2";
import { Pool_ABI } from "@/abis/Pool";
import { Factory_ABI } from "@/abis/Factory";
import { createPublicClient, http, getAddress } from "viem";
import { kairosTestnet } from "@/config/wagmi";
import { RPC_URL } from "@/config/env";

// Create a public client for read operations
const publicClient = createPublicClient({
  chain: kairosTestnet,
  transport: http(RPC_URL),
});

/**
 * Step 1: Get pool address from Factory contract
 * Following debug-quoter.js Step 1
 */
async function getPoolAddress(
  tokenA: string,
  tokenB: string,
  fee: FeeAmount
): Promise<string | null> {
  try {
    const tokenAAddress = getAddress(tokenA) as `0x${string}`;
    const tokenBAddress = getAddress(tokenB) as `0x${string}`;

    const poolAddress = await publicClient.readContract({
      address: CONTRACTS.V3CoreFactory as `0x${string}`,
      abi: Factory_ABI,
      functionName: "getPool",
      args: [tokenAAddress, tokenBAddress, fee],
    });

    // Check if pool exists (non-zero address)
    if (
      !poolAddress ||
      poolAddress === "0x0000000000000000000000000000000000000000"
    ) {
      return null;
    }

    return getAddress(poolAddress);
  } catch (error) {
    console.error("Error getting pool address:", error);
    return null;
  }
}

/**
 * Step 2: Check pool state
 * Following debug-quoter.js Step 2
 * Returns: token0, token1, fee, tickSpacing, liquidity, slot0
 */
async function getPoolState(poolAddress: string): Promise<{
  token0: string;
  token1: string;
  fee: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
  tick: number;
  unlocked: boolean;
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

    // Handle slot0 as array (tuple) or object
    let sqrtPriceX96: bigint;
    let tick: number;
    let unlocked: boolean;

    if (Array.isArray(slot0)) {
      sqrtPriceX96 = slot0[0] as bigint;
      tick = Number(slot0[1]);
      unlocked = slot0[6] as boolean;
    } else if (slot0 && typeof slot0 === "object") {
      sqrtPriceX96 = (slot0 as any).sqrtPriceX96 as bigint;
      tick = Number((slot0 as any).tick);
      unlocked = (slot0 as any).unlocked as boolean;
    } else {
      throw new Error("Unexpected slot0 return format");
    }

    return {
      token0: getAddress(token0 as string),
      token1: getAddress(token1 as string),
      fee: Number(fee),
      liquidity: liquidity as bigint,
      sqrtPriceX96,
      tick,
      unlocked,
    };
  } catch (error) {
    console.error("Error fetching pool state:", error);
    return null;
  }
}

/**
 * Step 4: Get quote from QuoterV2
 * Following debug-quoter.js Step 4
 * IMPORTANT: QuoterV2 intentionally reverts with the quote data
 * We need to catch the revert and decode it
 * 
 * This matches the debug-quoter.js approach:
 * - Use callStatic (in ethers) / call (in viem) which simulates execution
 * - QuoterV2 will revert with encoded return data
 * - Decode the revert data to get the quote result
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
    // Validate inputs
    if (!amountIn || parseFloat(amountIn) <= 0) {
      console.error("Invalid amountIn:", amountIn);
      return null;
    }

    if (!tokenIn?.address || !tokenOut?.address) {
      console.error("Missing token addresses");
      return null;
    }

    // Ensure token has correct decimals
    let tokenInWithDecimals = tokenIn;
    if (!tokenIn.decimals || tokenIn.decimals === 18) {
      // Try to fetch decimals from contract if missing or default
      try {
        const { fetchTokenInfo } = await import('@/hooks/useTokenInfo');
        const tokenInfo = await fetchTokenInfo(tokenIn.address);
        if (tokenInfo && tokenInfo.decimals) {
          tokenInWithDecimals = { ...tokenIn, decimals: tokenInfo.decimals };
          console.log(`Fetched decimals for tokenIn ${tokenIn.address}: ${tokenInfo.decimals}`);
        }
      } catch (error) {
        console.warn(`Could not fetch decimals for tokenIn ${tokenIn.address}, using provided value: ${tokenIn.decimals}`);
      }
    }

    console.log("Parsing amount with token decimals:", {
      amountIn,
      tokenDecimals: tokenInWithDecimals.decimals,
      tokenSymbol: tokenInWithDecimals.symbol,
      tokenAddress: tokenInWithDecimals.address,
    });

    // Convert amountIn to wei (smallest unit) using token decimals
    let amountInWei: bigint;
    try {
      amountInWei = parseUnits(amountIn, tokenInWithDecimals.decimals);
      console.log("Parsed amountIn to wei:", {
        original: amountIn,
        decimals: tokenInWithDecimals.decimals,
        wei: amountInWei.toString(),
      });
      if (amountInWei === BigInt(0)) {
        console.error("Amount in is zero after parsing");
        return null;
      }
    } catch (parseError) {
      console.error("Error parsing amountIn:", parseError);
      console.error("Parse error details:", {
        amountIn,
        decimals: tokenInWithDecimals.decimals,
        error: parseError,
      });
      return null;
    }

    const sqrtPriceLimitX96 = BigInt(0); // No price limit

    const tokenInAddress = getAddress(tokenIn.address) as `0x${string}`;
    const tokenOutAddress = getAddress(tokenOut.address) as `0x${string}`;

    console.log("Getting quote from QuoterV2:", {
      tokenIn: tokenInAddress,
      tokenOut: tokenOutAddress,
      amountIn: amountInWei.toString(),
      fee,
    });

    // Following debug-quoter.js: Use callStatic (ethers) / simulateContract (viem)
    // QuoterV2 intentionally reverts with the quote data
    // In viem, simulateContract is the equivalent of ethers' callStatic
    try {
      // Try simulateContract first - this is viem's equivalent of callStatic
      // Updated ABI: quoteExactInputSingle now takes a single struct parameter
      // that includes both tokenIn and tokenOut
      const result = await publicClient.simulateContract({
        address: CONTRACTS.QuoterV2 as `0x${string}`,
        abi: QuoterV2_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: tokenInAddress,
            tokenOut: tokenOutAddress,
            amountIn: amountInWei,
            fee: fee,
            sqrtPriceLimitX96: sqrtPriceLimitX96,
          },
        ],
      });

      // If simulateContract succeeds (unexpected), decode the result
      if (result && result.result) {
        console.log("QuoterV2 simulateContract succeeded (unexpected), decoding result");
        const decoded = result.result;

        if (Array.isArray(decoded) && decoded.length >= 4) {
          console.log("Quote decoded successfully from simulateContract result");
          return {
            amountOut: decoded[0] as bigint,
            sqrtPriceX96After: decoded[1] as bigint,
            initializedTicksCrossed: Number(decoded[2]),
            gasEstimate: decoded[3] as bigint,
          };
        }

        if (decoded && typeof decoded === "object") {
          console.log("Quote decoded successfully from simulateContract result (object)");
          return {
            amountOut: (decoded as any).amountOut as bigint,
            sqrtPriceX96After: (decoded as any).sqrtPriceX96After as bigint,
            initializedTicksCrossed: Number(
              (decoded as any).initializedTicksCrossed
            ),
            gasEstimate: (decoded as any).gasEstimate as bigint,
          };
        }
      }
    } catch (simulateError: any) {
      // QuoterV2 reverts with encoded data containing the quote
      // Following debug-quoter.js: decode the revert reason
      
      console.log("QuoterV2 simulateContract reverted (expected), extracting revert data");
      
      // Try to extract revert data from various error locations
      let revertData: `0x${string}` | undefined;

      // Check different error structures in viem
      if (simulateError?.data) {
        revertData = simulateError.data as `0x${string}`;
      } else if (simulateError?.cause?.data) {
        revertData = simulateError.cause.data as `0x${string}`;
      } else if (simulateError?.cause?.cause?.data) {
        revertData = simulateError.cause.cause.data as `0x${string}`;
      } else if (simulateError?.error?.data) {
        revertData = simulateError.error.data as `0x${string}`;
      }

      // Also try to extract from error message if it contains hex data
      if (!revertData) {
        const errorMessage = simulateError?.message || String(simulateError);
        const hexMatch = errorMessage.match(/0x[a-fA-F0-9]{64,}/);
        if (hexMatch && hexMatch[0].length > 10) {
          revertData = hexMatch[0] as `0x${string}`;
        }
      }

      // If simulateContract doesn't give us the data, try using raw call
      if (!revertData) {
        console.log("No revert data from simulateContract, trying raw call...");
        try {
          const { encodeFunctionData, decodeFunctionResult } = await import("viem");
          
          const data = encodeFunctionData({
            abi: QuoterV2_ABI,
            functionName: "quoteExactInputSingle",
            args: [
              {
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress,
                amountIn: amountInWei,
                fee: fee,
                sqrtPriceLimitX96: sqrtPriceLimitX96,
              },
            ],
          });

          const callResult = await publicClient.call({
            to: CONTRACTS.QuoterV2 as `0x${string}`,
            data: data as `0x${string}`,
          });

          if (callResult.data && callResult.data !== "0x") {
            revertData = callResult.data;
          }
        } catch (callError: any) {
          // Extract from call error
          if (callError?.data) {
            revertData = callError.data as `0x${string}`;
          } else if (callError?.cause?.data) {
            revertData = callError.cause.data as `0x${string}`;
          }
        }
      }

      console.log("Revert data extracted:", revertData ? `${revertData.substring(0, 100)}...` : "none");
      console.log("Revert data length:", revertData?.length);

      // If we have revert data, try to decode it (this is the successful quote case)
      if (revertData && revertData !== "0x" && revertData.length > 2) {
        try {
          const { decodeAbiParameters } = await import("viem");
          
          // The revert data from QuoterV2 contains:
          // 1. Error selector (4 bytes = 10 hex chars including 0x)
          // 2. Function parameters (encoded input to quoteExactInputSingle)
          //    - Updated ABI: Single struct with tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96
          //    - Struct: tokenIn (32 bytes) + tokenOut (32 bytes) + amountIn (32 bytes) + fee (32 bytes) + sqrtPriceLimitX96 (32 bytes)
          //    - Total parameters = 160 bytes = 320 hex chars
          // 3. Return values at the END (encoded output from quoteExactInputSingle)
          //
          // Return values structure (176 hex chars total):
          // - uint256 amountOut (32 bytes = 64 hex chars)
          // - uint160 sqrtPriceX96After (20 bytes = 40 hex chars)
          // - uint32 initializedTicksCrossed (4 bytes = 8 hex chars)
          // - uint256 gasEstimate (32 bytes = 64 hex chars)
          //
          // We need to extract the last 176 hex chars from the revert data (after error selector)
          
          // Strip error selector (first 10 chars: 0x + 8 hex)
          const dataWithoutErrorSelector = revertData.length > 10 
            ? revertData.substring(10) // Get hex data without "0x" prefix
            : revertData.substring(2); // If no error selector, just skip "0x"
          
          // Return values are at the end: last 176 hex chars
          // 176 hex chars = 88 bytes
          const returnDataLength = 176; // hex chars
          
          if (dataWithoutErrorSelector.length < returnDataLength) {
            throw new Error(`Revert data too short: ${dataWithoutErrorSelector.length} hex chars, need at least ${returnDataLength}`);
          }
          
          // Extract the last 176 hex chars as return values
          const startPos = dataWithoutErrorSelector.length - returnDataLength;
          const returnDataHex = dataWithoutErrorSelector.substring(startPos);
          const returnData = `0x${returnDataHex}`;
          
          console.log("Extracting return values from end of revert data:", {
            revertDataLength: revertData.length,
            dataWithoutSelectorLength: dataWithoutErrorSelector.length,
            returnDataStart,
            returnDataLength,
            returnData: returnData.substring(0, 100) + "...",
          });
          
          // Decode the return values
          const decoded = decodeAbiParameters(
            [
              { type: "uint256", name: "amountOut" },
              { type: "uint160", name: "sqrtPriceX96After" },
              { type: "uint32", name: "initializedTicksCrossed" },
              { type: "uint256", name: "gasEstimate" },
            ],
            returnData
          );
          
          console.log("✅ Decoded return values from end of revert data");

          // Log the decoded values for debugging
          console.log("Decoded quote values:", {
            decoded,
            isArray: Array.isArray(decoded),
            isObject: typeof decoded === "object",
            keys: decoded && typeof decoded === "object" ? Object.keys(decoded) : null,
          });
          
          // If it's an array, log each element
          if (Array.isArray(decoded)) {
            console.log("Decoded array elements:", decoded.map((v: any, i: number) => ({
              index: i,
              value: v?.toString(),
              type: typeof v,
            })));
          }
          
          // If it's an object, log each property
          if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
            console.log("Decoded object properties:", Object.entries(decoded).map(([key, value]: [string, any]) => ({
              key,
              value: value?.toString(),
              type: typeof value,
            })));
          }

          if (Array.isArray(decoded)) {
            console.log("Quote decoded successfully from revert data (array)");
            console.log("Decoded values:", {
              amountOut: decoded[0]?.toString(),
              sqrtPriceX96After: decoded[1]?.toString(),
              initializedTicksCrossed: decoded[2],
              gasEstimate: decoded[3]?.toString(),
            });
            
            // Validate the values make sense
            const amountOut = decoded[0] as bigint;
            const sqrtPriceX96After = decoded[1] as bigint;
            const initializedTicksCrossed = Number(decoded[2]);
            const gasEstimate = decoded[3] as bigint;
            
            // Check if amountOut seems reasonable (not astronomically large)
            // For a swap, amountOut should be in a reasonable range
            // If it's > 10^30, something is wrong
            const MAX_REASONABLE_AMOUNT = BigInt(10) ** BigInt(30);
            if (amountOut > MAX_REASONABLE_AMOUNT) {
              console.error("AmountOut seems too large, possible decoding error:", amountOut.toString());
              console.error("Revert data length:", revertData.length);
              console.error("Revert data (first 100 chars):", revertData.substring(0, 100));
              return null;
            }
            
            return {
              amountOut,
              sqrtPriceX96After,
              initializedTicksCrossed,
              gasEstimate,
            };
          }

          if (decoded && typeof decoded === "object") {
            console.log("Quote decoded successfully from revert data (object)");
            console.log("Decoded values:", {
              amountOut: (decoded as any).amountOut?.toString(),
              sqrtPriceX96After: (decoded as any).sqrtPriceX96After?.toString(),
              initializedTicksCrossed: (decoded as any).initializedTicksCrossed,
              gasEstimate: (decoded as any).gasEstimate?.toString(),
            });
            
            const amountOut = (decoded as any).amountOut as bigint;
            const sqrtPriceX96After = (decoded as any).sqrtPriceX96After as bigint;
            const initializedTicksCrossed = Number(
              (decoded as any).initializedTicksCrossed
            );
            const gasEstimate = (decoded as any).gasEstimate as bigint;
            
            // Validate the values make sense
            const MAX_REASONABLE_AMOUNT = BigInt(10) ** BigInt(30);
            if (amountOut > MAX_REASONABLE_AMOUNT) {
              console.error("AmountOut seems too large, possible decoding error:", amountOut.toString());
              return null;
            }
            
            return {
              amountOut,
              sqrtPriceX96After,
              initializedTicksCrossed,
              gasEstimate,
            };
          }
        } catch (decodeError) {
          // If decoding fails, it's likely a real revert (not return data)
          console.error("Failed to decode QuoterV2 revert data:", decodeError);
          console.error("Revert data was:", revertData);
          
          // Check for common error codes (following debug-quoter.js)
          const errorMessage = simulateError?.message || String(simulateError);
          if (errorMessage.includes("STF")) {
            console.error("STF (Swap Too Far) - Not enough liquidity in price range");
          } else if (errorMessage.includes("SPL")) {
            console.error("SPL (Sqrt Price Limit) - Price limit exceeded");
          } else if (errorMessage.includes("LOK")) {
            console.error("LOK (Locked) - Pool is locked");
          }
        }
      } else {
        // No revert data - this is a legitimate revert (e.g., insufficient liquidity)
        // Following debug-quoter.js: check for common errors
        const errorMessage = simulateError?.message || String(simulateError);
        console.log("No revert data found, error message:", errorMessage);
        
        if (errorMessage.includes("STF")) {
          console.error("STF (Swap Too Far) - Not enough liquidity in price range");
        } else if (errorMessage.includes("SPL")) {
          console.error("SPL (Sqrt Price Limit) - Price limit exceeded");
        } else if (errorMessage.includes("LOK")) {
          console.error("LOK (Locked) - Pool is locked");
        } else if (
          !errorMessage.includes("revert") &&
          !errorMessage.includes("Execution reverted")
        ) {
          console.error("QuoterV2 call failed:", errorMessage);
          console.error("Full error object:", simulateError);
        }
      }
    }
  } catch (error) {
    // Only log unexpected errors, not expected reverts
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error getting quote from QuoterV2:", error);
    console.error("Error details:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return null;
}

/**
 * Find the best pool and get quote for a token pair
 * Follows the complete workflow from debug-quoter.js
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
  console.log("getBestQuote called:", {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    amountIn,
  });

  // Normalize token addresses
  const tokenInAddress = getAddress(tokenIn.address);
  const tokenOutAddress = getAddress(tokenOut.address);

  console.log("Normalized addresses:", {
    tokenIn: tokenInAddress,
    tokenOut: tokenOutAddress,
  });

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

  // Try each fee tier
  for (const fee of feeTiers) {
    try {
      console.log(`Checking fee tier ${fee}...`);

      // Step 1: Get pool address
      const poolAddress = await getPoolAddress(
        tokenInAddress,
        tokenOutAddress,
        fee
      );

      if (!poolAddress) {
        console.log(`No pool found for fee tier ${fee}`);
        continue; // Pool doesn't exist for this fee tier
      }

      console.log(`Found pool at ${poolAddress} for fee ${fee}`);

      // Step 2: Check pool state
      const poolState = await getPoolState(poolAddress);
      if (!poolState) {
        console.log(`Failed to get pool state for ${poolAddress}`);
        continue; // Failed to get pool state
      }

      console.log("Pool state:", {
        token0: poolState.token0,
        token1: poolState.token1,
        fee: poolState.fee,
        liquidity: poolState.liquidity.toString(),
        tick: poolState.tick,
        unlocked: poolState.unlocked,
      });

      // Step 3: Verify pool has liquidity
      if (poolState.liquidity === BigInt(0)) {
        console.log(`Pool ${poolAddress} has zero liquidity`);
        continue; // Pool has zero liquidity
      }

      // Check if pool is locked
      if (!poolState.unlocked) {
        console.warn(`Pool ${poolAddress} is locked (swap in progress)`);
        // Continue anyway, but note the warning
      }

      // Verify token order matches
      // Pool stores tokens in sorted order (token0 < token1)
      const isTokenInFirst =
        tokenInAddress.toLowerCase() === poolState.token0.toLowerCase();
      const isTokenOutFirst =
        tokenOutAddress.toLowerCase() === poolState.token0.toLowerCase();

      if (!isTokenInFirst && !isTokenOutFirst) {
        // Neither token matches token0 - this shouldn't happen
        console.error("Token order mismatch in pool:", {
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          poolToken0: poolState.token0,
          poolToken1: poolState.token1,
        });
        continue;
      }

      console.log("Token order verified, getting quote from QuoterV2...");

      // Step 4: Get quote from QuoterV2
      const quote = await getQuoteFromQuoterV2(
        tokenIn,
        tokenOut,
        amountIn,
        fee
      );

      if (!quote) {
        console.log(`Quote failed for fee tier ${fee}`);
        continue; // Quote failed (e.g., insufficient liquidity)
      }

      console.log("Quote received:", {
        amountOut: quote.amountOut.toString(),
        fee,
        gasEstimate: quote.gasEstimate.toString(),
      });

      // Keep track of the best quote (highest amountOut)
      if (!bestQuote || quote.amountOut > bestQuote.amountOut) {
        bestQuote = {
          amountOut: quote.amountOut,
          fee: fee,
          gasEstimate: quote.gasEstimate,
          poolAddress: poolAddress,
        };
        console.log("New best quote:", {
          amountOut: bestQuote.amountOut.toString(),
          fee: bestQuote.fee,
        });
      }
    } catch (error) {
      // Continue to next fee tier
      console.error(`Error checking fee tier ${fee}:`, error);
      continue;
    }
  }

  if (!bestQuote) {
    console.log("No valid quote found for any fee tier");
    return null;
  }

  // Ensure tokenOut has correct decimals for formatting
  let tokenOutWithDecimals = tokenOut;
  if (!tokenOut.decimals || tokenOut.decimals === 18) {
    // Try to fetch decimals from contract if missing or default
    try {
      const { fetchTokenInfo } = await import('@/hooks/useTokenInfo');
      const tokenInfo = await fetchTokenInfo(tokenOut.address);
      if (tokenInfo && tokenInfo.decimals) {
        tokenOutWithDecimals = { ...tokenOut, decimals: tokenInfo.decimals };
        console.log(`Fetched decimals for tokenOut ${tokenOut.address}: ${tokenInfo.decimals}`);
      }
    } catch (error) {
      console.warn(`Could not fetch decimals for tokenOut ${tokenOut.address}, using provided value: ${tokenOut.decimals}`);
    }
  }

  const formattedAmountOut = formatUnits(bestQuote.amountOut, tokenOutWithDecimals.decimals);
  
  console.log("Best quote selected:", {
    amountOutRaw: bestQuote.amountOut.toString(),
    amountOutFormatted: formattedAmountOut,
    tokenOutDecimals: tokenOutWithDecimals.decimals,
    fee: bestQuote.fee,
    poolAddress: bestQuote.poolAddress,
  });

  return {
    amountOut: formattedAmountOut,
    fee: bestQuote.fee,
    gasEstimate: bestQuote.gasEstimate.toString(),
    poolAddress: bestQuote.poolAddress,
  };
}

/**
 * React hook for getting swap quotes
 */
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
          poolAddress: quoteResult.poolAddress,
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

/**
 * Export getQuoteFromQuoterV2 for use in other components (e.g., SwapButton)
 */
export { getQuoteFromQuoterV2 };
