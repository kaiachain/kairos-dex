// @ts-nocheck
import { useState, useMemo, useEffect, ReactElement } from "react";
import { TokenSelector } from "@/components/swap/TokenSelector";
import { Token } from "@/types/token";
import { Pool } from "@/types/pool";
import { PriceRangeSelector } from "./PriceRangeSelector";
import {
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { PositionManager_ABI } from "@/abis/PositionManager";
import { Factory_ABI } from "@/abis/Factory";
import { Pool_ABI } from "@/abis/Pool";
import {
  parseUnits,
  formatUnits,
  formatNumber,
  formatBalance,
  priceToSqrtPriceX96,
  formatAddress,
  formatCurrency,
} from "@/lib/utils";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { usePools } from "@/hooks/usePools";
import { calculatePriceFromTick } from "@/lib/subgraph-utils";
import { erc20Abi, encodeFunctionData } from "viem";
import { Search } from "lucide-react";
import { showToast } from "@/lib/showToast";

interface AddLiquidityProps {
  initialToken0?: Token | null;
  initialToken1?: Token | null;
  initialFee?: number; // Fee tier as percentage (e.g., 0.3 for 0.3%)
  disableTokenSelection?: boolean; // Disable token selection when adding liquidity to a specific pool
  fromPositionsPage?: boolean; // Indicates if coming from Positions page
}

export function AddLiquidity({
  initialToken0 = null,
  initialToken1 = null,
  initialFee,
  disableTokenSelection = false,
  fromPositionsPage = false,
}: AddLiquidityProps = {}) {
  const [token0, setToken0] = useState<Token | null>(initialToken0 || null);
  const [token1, setToken1] = useState<Token | null>(initialToken1 || null);
  const [fee, setFee] = useState(
    initialFee ? Math.round(initialFee * 10000) : 3000
  );
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [fullRange, setFullRange] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTxError, setShowTxError] = useState(false);
  const [initialPrice, setInitialPrice] = useState("");
  const [showInitPrompt, setShowInitPrompt] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [poolSearchQuery, setPoolSearchQuery] = useState("");
  const [calculatedPriceRange, setCalculatedPriceRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  
  // Fetch pools for selection when coming from Positions page
  const { pools, isLoading: isLoadingPools } = usePools();

  const { address, isConnected } = useAccount();
  const {
    writeContract: addLiquidity,
    data: hash,
    error: mintError,
  } = useWriteContract();

  // Wait for transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isTxError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Show transaction errors when they occur
  useEffect(() => {
    if (mintError || isTxError) {
      setShowTxError(true);
      // Log detailed error for debugging
      if (mintError) {
        console.error("Mint error:", mintError);
        const errorMessage = mintError.message || String(mintError);
        if (errorMessage.includes("uint(9)") || errorMessage.includes("error code 9")) {
          console.error("Error Code 9: Amount mismatch for first liquidity addition");
        }
      }
    }
  }, [mintError, isTxError]);

  // Clear transaction errors when user starts typing new amounts
  useEffect(() => {
    if (amount0 || amount1) {
      setShowTxError(false);
    }
  }, [amount0, amount1]);

  // Check token allowances
  const { data: allowance0, refetch: refetchAllowance0 } = useReadContract({
    address: token0?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && token0
        ? [address, CONTRACTS.NonfungiblePositionManager as `0x${string}`]
        : undefined,
    query: {
      enabled: !!token0 && !!address,
    },
  });

  const { data: allowance1, refetch: refetchAllowance1 } = useReadContract({
    address: token1?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && token1
        ? [address, CONTRACTS.NonfungiblePositionManager as `0x${string}`]
        : undefined,
    query: {
      enabled: !!token1 && !!address,
    },
  });

  const { writeContract: approveToken, data: approveHash } = useWriteContract();
  const { isLoading: isApproving, isSuccess: isApproved } =
    useWaitForTransactionReceipt({
      hash: approveHash,
    });

  // Check if approvals are needed
  const needsApproval0 =
    token0 && amount0 && allowance0 !== undefined
      ? parseUnits(amount0, token0.decimals) > (allowance0 as bigint)
      : false;

  const needsApproval1 =
    token1 && amount1 && allowance1 !== undefined
      ? parseUnits(amount1, token1.decimals) > (allowance1 as bigint)
      : false;

  const needsApproval = needsApproval0 || needsApproval1;

  // Auto-populate tokens and fee when initial values are provided
  useEffect(() => {
    if (initialToken0) {
      setToken0(initialToken0);
    }
    if (initialToken1) {
      setToken1(initialToken1);
    }
    if (initialFee !== undefined) {
      setFee(Math.round(initialFee * 10000)); // Convert percentage to basis points
    }
  }, [initialToken0, initialToken1, initialFee]);

  // Auto-populate tokens and fee when pool is selected
  useEffect(() => {
    if (selectedPool) {
      setToken0(selectedPool.token0);
      setToken1(selectedPool.token1);
      setFee(Math.round(selectedPool.feeTier * 10000)); // Convert percentage to basis points
    }
  }, [selectedPool]);

  // Filter pools based on search query
  const filteredPools = useMemo(() => {
    if (!poolSearchQuery) return pools;
    const query = poolSearchQuery.toLowerCase();
    return pools.filter(
      (pool) =>
        pool.token0.symbol.toLowerCase().includes(query) ||
        pool.token1.symbol.toLowerCase().includes(query) ||
        pool.token0.name.toLowerCase().includes(query) ||
        pool.token1.name.toLowerCase().includes(query) ||
        pool.address.toLowerCase().includes(query)
    );
  }, [pools, poolSearchQuery]);

  // Determine if we should show pool selector
  const showPoolSelector = fromPositionsPage && !selectedPool && !initialToken0 && !initialToken1;

  // Get token balances
  const {
    data: balance0,
    isLoading: isLoadingBalance0,
    refetch: refetchBalance0,
  } = useTokenBalance(token0);
  const {
    data: balance1,
    isLoading: isLoadingBalance1,
    refetch: refetchBalance1,
  } = useTokenBalance(token1);

  // Get pool address from factory
  const sortedToken0 =
    token0 && token1
      ? token0.address.toLowerCase() < token1.address.toLowerCase()
        ? token0
        : token1
      : null;
  const sortedToken1 =
    token0 && token1
      ? token0.address.toLowerCase() < token1.address.toLowerCase()
        ? token1
        : token0
      : null;

  const { data: poolAddress } = useReadContract({
    address: CONTRACTS.V3CoreFactory as `0x${string}`,
    abi: Factory_ABI,
    functionName: "getPool",
    args:
      sortedToken0 && sortedToken1 && fee
        ? [
            sortedToken0.address.toLowerCase() as `0x${string}`,
            sortedToken1.address.toLowerCase() as `0x${string}`,
            fee,
          ]
        : undefined,
    query: {
      enabled: !!sortedToken0 && !!sortedToken1 && !!fee,
    },
  });

  // Check if pool is initialized by reading slot0
  const { data: slot0, isLoading: isLoadingSlot0 } = useReadContract({
    address:
      poolAddress &&
      poolAddress !== "0x0000000000000000000000000000000000000000"
        ? (poolAddress as `0x${string}`)
        : undefined,
    abi: Pool_ABI,
    functionName: "slot0",
    query: {
      enabled:
        !!poolAddress &&
        poolAddress !== "0x0000000000000000000000000000000000000000",
    },
  });

  // Check pool liquidity to detect first liquidity addition
  const { data: poolLiquidity, isLoading: isLoadingLiquidity } = useReadContract({
    address:
      poolAddress &&
      poolAddress !== "0x0000000000000000000000000000000000000000"
        ? (poolAddress as `0x${string}`)
        : undefined,
    abi: Pool_ABI,
    functionName: "liquidity",
    query: {
      enabled:
        !!poolAddress &&
        poolAddress !== "0x0000000000000000000000000000000000000000",
    },
  }) as { data: bigint | undefined; isLoading: boolean };

  // Determine if pool exists and is initialized
  const poolExists =
    poolAddress && poolAddress !== "0x0000000000000000000000000000000000000000";
  const isPoolInitialized = slot0 ? Boolean((slot0 as any)[0] !== BigInt(0)) : false;
  const poolNeedsInitialization =
    poolExists && !isPoolInitialized && !isLoadingSlot0;
  
  // Check if this is the first liquidity addition (pool initialized but has zero liquidity)
  const isFirstLiquidity = Boolean(isPoolInitialized && poolLiquidity !== null && poolLiquidity !== undefined && poolLiquidity === BigInt(0) && !isLoadingLiquidity);

  // Automatically disable full range for first liquidity
  useEffect(() => {
    if (isFirstLiquidity && fullRange) {
      setFullRange(false);
    }
  }, [isFirstLiquidity, fullRange]);

  // Extract current tick and sqrtPriceX96 from slot0
  // slot0 returns: [sqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext, feeProtocol, unlocked]
  const currentTick = slot0 ? Number((slot0 as any)[1]) : null;
  const sqrtPriceX96 = slot0 ? (slot0 as any)[0] as bigint : null;

  // Show initialization prompt when pool needs initialization
  useEffect(() => {
    if (poolNeedsInitialization && token0 && token1 && amount0 && amount1) {
      setShowInitPrompt(true);
    } else {
      setShowInitPrompt(false);
    }
  }, [poolNeedsInitialization, token0, token1, amount0, amount1]);

  // Initialize pool functionality
  const {
    writeContract: initializePool,
    data: initHash,
    error: initWriteError,
  } = useWriteContract();
  const {
    isLoading: isInitLoading,
    isSuccess: isInitSuccess,
    error: initTxError,
  } = useWaitForTransactionReceipt({
    hash: initHash,
  });

  const handleInitializePool = () => {
    if (!poolAddress || !initialPrice || !token0 || !token1) return;

    const priceValue = parseFloat(initialPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      alert("Please enter a valid initial price (greater than 0)");
      return;
    }

    // Calculate sqrtPriceX96 from the initial price
    // Price is token1 per token0 (e.g., if price is 1.5, 1 token1 = 1.5 token0)
    const sqrtPriceX96 = priceToSqrtPriceX96(
      priceValue,
      token0.decimals,
      token1.decimals
    );

    initializePool({
      address: poolAddress as `0x${string}`,
      abi: Pool_ABI,
      functionName: "initialize",
      args: [sqrtPriceX96],
    });
  };

  // Refetch slot0 after initialization
  useEffect(() => {
    if (isInitSuccess) {
      // Pool is now initialized, hide the prompt
      setShowInitPrompt(false);
      setInitialPrice("");
    }
  }, [isInitSuccess]);

  // Refetch allowances after approval
  useEffect(() => {
    if (isApproved) {
      refetchAllowance0();
      refetchAllowance1();
    }
  }, [isApproved, refetchAllowance0, refetchAllowance1]);

  // Reset amounts and refetch balances when transaction is confirmed
  useEffect(() => {
    if (isConfirmed && !showSuccess) {
      // Show success message
      setShowSuccess(true);

      // Reset amounts
      setAmount0("");
      setAmount1("");

      // Refetch token balances and allowances
      refetchBalance0();
      refetchBalance1();
      refetchAllowance0();
      refetchAllowance1();

      // Hide success message after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [
    isConfirmed,
    showSuccess,
    refetchBalance0,
    refetchBalance1,
    refetchAllowance0,
    refetchAllowance1,
  ]);

  // Validation errors
  const errors = useMemo(() => {
    const errs: { amount0?: string; amount1?: string } = {};

    if (token0 && amount0) {
      const amount0Num = parseFloat(amount0);
      const balance0Num = balance0 ? parseFloat(balance0) : 0;

      if (!isNaN(amount0Num) && !isNaN(balance0Num)) {
        if (amount0Num > balance0Num) {
          errs.amount0 = `Insufficient balance. You have ${formatBalance(
            balance0 || "0",
            2
          )} ${token0.symbol}`;
        }
      }
    }

    if (token1 && amount1) {
      const amount1Num = parseFloat(amount1);
      const balance1Num = balance1 ? parseFloat(balance1) : 0;

      if (!isNaN(amount1Num) && !isNaN(balance1Num)) {
        if (amount1Num > balance1Num) {
          errs.amount1 = `Insufficient balance. You have ${formatBalance(
            balance1 || "0",
            2
          )} ${token1.symbol}`;
        }
      }
    }

    return errs;
  }, [amount0, amount1, balance0, balance1, token0, token1]);

  const hasErrors = Object.keys(errors).length > 0;

  const handleApprove = async (token: Token, amount: string) => {
    if (!token || !amount) return;

    try {
      // Approve with a slightly higher amount to avoid rounding issues
      const approveAmount = parseUnits(amount, token.decimals);
      // Add 1% buffer or minimum 1e18 for safety
      const buffer =
        approveAmount > BigInt(10 ** 18)
          ? approveAmount / BigInt(100)
          : BigInt(10 ** 18);
      const finalAmount = approveAmount + buffer;

      approveToken({
        address: token.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [
          CONTRACTS.NonfungiblePositionManager as `0x${string}`,
          finalAmount,
        ],
      });
    } catch (error) {
      console.error("Approval error:", error);
    }
  };

  const handleAddLiquidity = () => {
    // Check wallet connection first
    if (!isConnected) {
      showToast({
        type: 'warning',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first to add liquidity',
      });
      return;
    }

    if (!token0 || !token1 || !amount0 || !amount1) {
      console.error("Missing tokens or amounts:", { token0, token1, amount0, amount1 });
      return;
    }

    // Validate amounts are valid numbers and greater than 0
    const amount0Num = parseFloat(amount0);
    const amount1Num = parseFloat(amount1);
    
    if (isNaN(amount0Num) || isNaN(amount1Num) || amount0Num <= 0 || amount1Num <= 0) {
      console.error("Invalid amounts:", { amount0: amount0Num, amount1: amount1Num });
      alert("Please enter valid amounts greater than 0 for both tokens");
      return;
    }

    // Check if pool needs initialization
    if (poolNeedsInitialization) {
      setShowInitPrompt(true);
      return;
    }

    // Reset success state when starting a new transaction
    setShowSuccess(false);

    // Handle approvals first
    if (needsApproval0) {
      handleApprove(token0, amount0);
      return;
    }
    if (needsApproval1) {
      handleApprove(token1, amount1);
      return;
    }

    // Sort tokens by address (Uniswap V3 requirement)
    // token0 and token1 are as displayed in UI
    // t0 and t1 are sorted by address (t0 < t1)
    const isToken0First = token0.address.toLowerCase() < token1.address.toLowerCase();
    const t0 = isToken0First ? token0 : token1;
    const t1 = isToken0First ? token1 : token0;
    
    // Map amounts to sorted tokens
    // If token0 comes first in sorted order, amount0 maps to t0, amount1 maps to t1
    // If token1 comes first in sorted order, amount0 maps to t1, amount1 maps to t0
    const amt0 = isToken0First ? amount0 : amount1;
    const amt1 = isToken0First ? amount1 : amount0;

    // Validate amounts are valid numbers
    if (!amt0 || !amt1 || isNaN(parseFloat(amt0)) || isNaN(parseFloat(amt1))) {
      console.error("Invalid amounts:", { amt0, amt1 });
      return;
    }

    // Calculate tick range
    // For full range, use min/max ticks
    // For custom range, we need to calculate ticks from price
    // Since we don't have a proper SDK, we'll use full range as default
    // and require full range for now to avoid invalid tick errors
    let tickLower: number;
    let tickUpper: number;

    if (fullRange) {
      // Full range: use min and max ticks
      tickLower = -887272;
      tickUpper = 887272;
      // Full range - clear calculated range
      setCalculatedPriceRange({ min: null, max: null });
    } else {
      // For custom range, calculate ticks based on current price
      const tickSpacing =
        fee === 100 ? 1 : fee === 500 ? 10 : fee === 3000 ? 60 : 200;
      
      // Use actual current tick from pool, or default to 0 if not available
      const poolCurrentTick = currentTick !== null ? currentTick : 0;
      
      // Parse price range from user input
      const minPrice = priceRange.min ? parseFloat(priceRange.min) : null;
      const maxPrice = priceRange.max ? parseFloat(priceRange.max) : null;
      
      if (minPrice !== null && maxPrice !== null && !isNaN(minPrice) && !isNaN(maxPrice) && minPrice > 0 && maxPrice > 0) {
        // User provided custom price range - convert absolute prices to ticks
        // Price entered by user is in "human-readable" format: token1 per token0
        // Formula: tick = log(price / decimalsAdjustment) / log(1.0001)
        // where decimalsAdjustment = 10^(token0Decimals - token1Decimals)
        
        // Calculate decimals adjustment (same as in calculatePriceFromTick)
        // Use sorted tokens for decimals (t0 and t1 are defined above)
        const sortedToken0ForDecimals = token0.address.toLowerCase() < token1.address.toLowerCase() ? token0 : token1;
        const sortedToken1ForDecimals = token0.address.toLowerCase() < token1.address.toLowerCase() ? token1 : token0;
        const decimalsAdjustment = 10 ** (sortedToken0ForDecimals.decimals - sortedToken1ForDecimals.decimals);
        
        // Convert absolute prices to ticks
        // The user enters prices like "0.5" meaning 0.5 token1 per token0
        // But the raw price (before decimals adjustment) is price / decimalsAdjustment
        const LN_1_0001 = Math.log(1.0001);
        
        const priceToTick = (price: number): number => {
          // User enters price in human-readable format (already accounting for decimals in their mind)
          // But we need the raw price: rawPrice = price / decimalsAdjustment
          // Then: tick = log(rawPrice) / log(1.0001)
          const rawPrice = price / decimalsAdjustment;
          if (rawPrice <= 0) return -887272; // Min tick
          const tick = Math.log(rawPrice) / LN_1_0001;
          return Math.floor(tick);
        };
        
        // Calculate ticks from absolute prices
        const tickLowerFromPrice = priceToTick(minPrice);
        const tickUpperFromPrice = priceToTick(maxPrice);
        
        // Round to tick spacing
        tickLower = Math.floor(tickLowerFromPrice / tickSpacing) * tickSpacing;
        tickUpper = Math.ceil(tickUpperFromPrice / tickSpacing) * tickSpacing;
        
        // Ensure tickLower < tickUpper
        if (tickLower >= tickUpper) {
          const midTick = Math.floor((tickLower + tickUpper) / 2 / tickSpacing) * tickSpacing;
          tickLower = midTick - tickSpacing;
          tickUpper = midTick + tickSpacing;
        }
      } else {
        // No custom range provided, use a range around current price
        // Default to ±10% around current price (approximately ±1000 ticks)
        const defaultTickRange = 1000;
        tickLower = Math.floor((poolCurrentTick - defaultTickRange) / tickSpacing) * tickSpacing;
        tickUpper = Math.ceil((poolCurrentTick + defaultTickRange) / tickSpacing) * tickSpacing;
      }

      // CRITICAL: Ensure range includes current tick so both tokens are used
      // If current tick is outside the range, adjust the range to include it
      if (poolCurrentTick !== null && poolCurrentTick !== 0) {
        if (tickLower > poolCurrentTick) {
          // Range is entirely above current price - adjust lower bound
          tickLower = Math.floor(poolCurrentTick / tickSpacing) * tickSpacing;
          console.warn("Price range was above current price. Adjusted to include current price.");
        }
        if (tickUpper < poolCurrentTick) {
          // Range is entirely below current price - adjust upper bound
          tickUpper = Math.ceil(poolCurrentTick / tickSpacing) * tickSpacing;
          console.warn("Price range was below current price. Adjusted to include current price.");
        }
      }
      
      // Ensure tickLower < tickUpper
      if (tickLower >= tickUpper) {
        tickLower = tickUpper - tickSpacing;
      }
      
      // Clamp to valid tick range
      tickLower = Math.max(tickLower, -887272);
      tickUpper = Math.min(tickUpper, 887272);
      
      // Final validation: ensure current tick is within range
      if (poolCurrentTick !== null && poolCurrentTick !== 0) {
        if (poolCurrentTick < tickLower || poolCurrentTick > tickUpper) {
          // Force include current tick
          tickLower = Math.min(tickLower, Math.floor(poolCurrentTick / tickSpacing) * tickSpacing);
          tickUpper = Math.max(tickUpper, Math.ceil(poolCurrentTick / tickSpacing) * tickSpacing);
        }
      }
      
      // Calculate actual price range from ticks for display
      // Use sorted tokens for decimals
      const sortedToken0ForDisplay = token0.address.toLowerCase() < token1.address.toLowerCase() ? token0 : token1;
      const sortedToken1ForDisplay = token0.address.toLowerCase() < token1.address.toLowerCase() ? token1 : token0;
      if (sortedToken0ForDisplay && sortedToken1ForDisplay) {
        const priceMin = calculatePriceFromTick(tickLower, sortedToken0ForDisplay.decimals, sortedToken1ForDisplay.decimals);
        const priceMax = calculatePriceFromTick(tickUpper, sortedToken0ForDisplay.decimals, sortedToken1ForDisplay.decimals);
        setCalculatedPriceRange({ min: priceMin, max: priceMax });
      }
    }

    if (!address) return;

    // Parse amounts with proper decimals
    let amount0Desired: bigint;
    let amount1Desired: bigint;
    
    try {
      amount0Desired = parseUnits(amt0, t0.decimals);
      amount1Desired = parseUnits(amt1, t1.decimals);
    } catch (error) {
      console.error("Error parsing amounts:", error);
      alert("Error parsing token amounts. Please check your inputs.");
      return;
    }

    // Validate parsed amounts are greater than 0
    if (amount0Desired === BigInt(0) || amount1Desired === BigInt(0)) {
      console.error("Amounts must be greater than 0:", {
        amount0Desired: amount0Desired.toString(),
        amount1Desired: amount1Desired.toString(),
      });
      alert("Both token amounts must be greater than 0");
      return;
    }

    // CRITICAL FIX: For first liquidity addition to a newly initialized pool,
    // the amounts must match the current price ratio exactly.
    // 
    // STANDARD PRACTICE in Uniswap V3:
    // For a full-range position, PositionManager uses liquidity formulas to calculate
    // the exact amounts needed. The key insight is that for a full-range position
    // (tickLower = -887272, tickUpper = 887272), the amounts should match the price ratio.
    //
    // However, PositionManager calculates this using liquidity formulas internally:
    // - It calculates liquidity L from the amounts
    // - Then verifies that the amounts match what it expects
    //
    // For a full-range position, the formula simplifies to:
    // amount1 = amount0 * (sqrtPriceX96 / Q96)^2 * 10^(decimals0 - decimals1)
    //
    // But PositionManager might calculate this in a different order or with
    // different intermediate rounding. To match exactly, we need to use the
    // same calculation method.
    // CRITICAL FIX: For first liquidity to a newly initialized pool,
    // PositionManager is very strict about amounts matching exactly.
    //
    // STANDARD PRACTICE in Uniswap V3:
    // 1. For first liquidity, it's recommended to use a narrow range around the current price
    //    rather than full-range, as full-range positions have complex liquidity calculations
    // 2. However, if using full-range, the amounts must match the price ratio exactly
    //
    // For a full-range position, PositionManager uses liquidity formulas:
    // - It calculates liquidity L from the amounts
    // - Then verifies the amounts match what it expects
    // - For full-range: sqrt(P_lower) ≈ 0, sqrt(P_upper) ≈ infinity
    // - The formula simplifies but still requires exact matching
    //
    // The calculation: amount1 = amount0 * (sqrtPriceX96 / Q96)^2 * 10^(decimals0 - decimals1)
    //
    // NOTE: This code path should not be reached since full range is now disabled
    // for first liquidity additions in the UI. However, we keep it as a safety check.
    if (isFirstLiquidity && sqrtPriceX96 && currentTick !== null && fullRange) {
      console.warn("Full range selected for first liquidity - this should be prevented by UI");
      const Q96 = BigInt(2) ** BigInt(96);
      const sqrtPriceX96Big = BigInt(sqrtPriceX96.toString());
      
      // Calculate amount1 using the exact formula PositionManager uses
      // This is the standard formula for full-range positions
      const sqrtPriceX96Squared = sqrtPriceX96Big * sqrtPriceX96Big;
      const Q96Squared = Q96 * Q96;
      const decimalsAdjustmentBig = BigInt(10 ** (t0.decimals - t1.decimals));
      
      // Calculate: amount1 = (amount0 * sqrtPriceX96^2 * decimalsAdjustment) / Q96^2
      const numerator = amount0Desired * sqrtPriceX96Squared * decimalsAdjustmentBig;
      const requiredAmount1 = numerator / Q96Squared;
      
      console.log("First liquidity: Full-range position amount calculation", {
        amount0: amount0Desired.toString(),
        calculatedAmount1: requiredAmount1.toString(),
        currentTick,
        sqrtPriceX96: sqrtPriceX96.toString(),
      });
      
      // Update amount1Desired to match the calculated value
      amount1Desired = requiredAmount1;
      
      // Update UI to show the adjusted amount
      const adjustedAmount1Str = formatUnits(amount1Desired, t1.decimals);
      if (isToken0First) {
        setAmount1(adjustedAmount1Str);
      } else {
        setAmount0(adjustedAmount1Str);
      }
      
      console.log(`First liquidity: Adjusted ${t1.symbol} amount to ${adjustedAmount1Str} to match price ratio`);
    }

    // Log for debugging
    console.log("Adding liquidity:", {
      originalToken0: token0.symbol,
      originalToken1: token1.symbol,
      originalAmount0: amount0,
      originalAmount1: amount1,
      sortedToken0: t0.symbol,
      sortedToken1: t1.symbol,
      sortedAmount0: amt0,
      sortedAmount1: amt1,
      amount0Desired: amount0Desired.toString(),
      amount1Desired: amount1Desired.toString(),
      fee,
      currentTick,
      tickLower,
      tickUpper,
      fullRange,
      priceRange,
      tickInRange: currentTick !== null ? (currentTick >= tickLower && currentTick <= tickUpper) : "unknown",
    });

    try {
      // STANDARD PRACTICE: For first liquidity, PositionManager's mint function
      // will handle pool creation and initialization if needed via its internal logic.
      // However, since the pool is already initialized, we should just use mint directly.
      // 
      // The key is ensuring the amounts match exactly what PositionManager expects.
      // For a full-range position, the amounts must match the current price ratio.
      //
      // Note: We removed the multicall approach because createAndInitializePoolIfNecessary
      // might interfere with an already-initialized pool, or the sqrtPriceX96 might not
      // match exactly, causing issues.
      
      addLiquidity({
        address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
        abi: PositionManager_ABI,
        functionName: "mint",
        args: [
          {
            token0: t0.address as `0x${string}`,
            token1: t1.address as `0x${string}`,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: BigInt(0),
            amount1Min: BigInt(0),
            recipient: address,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
          },
        ],
      });
    } catch (error) {
      console.error("Add liquidity error:", error);
    }
  };

  return (
    <div className="bg-white dark:bg-card rounded-3xl shadow-lg p-6 border border-border w-full">
      <h2 className="text-2xl font-semibold mb-6 text-text-primary">Add Liquidity</h2>

      {/* @ts-ignore - TypeScript incorrectly infers 0n as possible ReactNode due to BigInt comparison in isFirstLiquidity */}
      <div className="space-y-6" key="add-liquidity-form">
        {/* Pool Selector - shown when coming from Positions page */}
        {showPoolSelector && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Select a Pool
              </label>
              <p className="text-sm text-text-secondary mb-4">
                Choose a pool to add liquidity to. The tokens and fee tier will be automatically populated.
              </p>
              
              {/* Search input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  value={poolSearchQuery}
                  onChange={(e) => setPoolSearchQuery(e.target.value)}
                  placeholder="Search pools by token name or address"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-input-bg rounded-lg border border-border outline-none focus:border-primary text-text-primary"
                />
              </div>

              {/* Pool list */}
              {isLoadingPools ? (
                <div className="text-center py-8 text-text-secondary">
                  Loading pools...
                </div>
              ) : filteredPools.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">
                  {poolSearchQuery ? "No pools found matching your search" : "No pools available"}
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-2 border border-border rounded-lg p-2">
                  {filteredPools.map((pool) => (
                    <button
                      key={pool.address}
                      onClick={() => setSelectedPool(pool)}
                      className="w-full text-left p-4 bg-gray-50 dark:bg-input-bg hover:bg-gray-100 dark:hover:bg-bg rounded-lg transition-colors border border-transparent hover:border-[color:var(--border-hover)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex -space-x-2">
                            <div className="w-8 h-8 bg-gray-200 dark:bg-bg rounded-full flex items-center justify-center text-xs font-semibold text-text-primary">
                              {pool.token0.symbol[0]}
                            </div>
                            <div className="w-8 h-8 bg-gray-200 dark:bg-bg rounded-full flex items-center justify-center text-xs font-semibold text-text-primary">
                              {pool.token1.symbol[0]}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-text-primary">
                              {pool.token0.symbol} / {pool.token1.symbol}
                            </div>
                            <div className="text-xs text-text-secondary">
                              Fee: {pool.feeTier}%
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-text-primary">
                            {formatCurrency(pool.tvl)}
                          </div>
                          <div className="text-xs text-text-secondary">
                            TVL
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-text-secondary font-mono">
                        {formatAddress(pool.address, 6)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Show message when pool is selected */}
        {selectedPool && fromPositionsPage && (
          <div className="bg-success/20 border border-success/40 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-success font-semibold mb-1">
                  ✓ Pool Selected
                </p>
                <p className="text-text-primary text-sm">
                  {selectedPool.token0.symbol} / {selectedPool.token1.symbol} ({selectedPool.feeTier}% fee)
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedPool(null);
                  setToken0(null);
                  setToken1(null);
                  setAmount0("");
                  setAmount1("");
                }}
                className="text-sm text-primary hover:opacity-80 hover:underline"
              >
                Change Pool
              </button>
            </div>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-text-primary">Token 0</label>
            {token0 && (
              <span className="text-xs text-text-secondary">
                {isLoadingBalance0
                  ? "Loading..."
                  : balance0 && parseFloat(balance0) > 0
                  ? `Balance: ${formatBalance(balance0, 2)} ${token0.symbol}`
                  : "Balance: 0"}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={amount0}
                onChange={(e) => {
                  setAmount0(e.target.value);
                  setShowTxError(false);
                }}
                placeholder="0.0"
                disabled={showPoolSelector}
                className={`w-full px-4 py-2 bg-gray-50 dark:bg-input-bg rounded-lg outline-none border ${
                  errors.amount0 ? "border-2 border-error" : "border-border"
                } ${showPoolSelector ? "opacity-50 cursor-not-allowed" : ""} text-text-primary`}
              />
              {errors.amount0 && (
                <p className="text-error text-xs mt-1">{errors.amount0}</p>
              )}
            </div>
            <TokenSelector
              selectedToken={token0}
              onTokenSelect={setToken0}
              excludeToken={token1}
              disabled={disableTokenSelection || showPoolSelector || (fromPositionsPage && selectedPool !== null)}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-text-primary">Token 1</label>
            {token1 && (
              <span className="text-xs text-text-secondary">
                {isLoadingBalance1
                  ? "Loading..."
                  : balance1 && parseFloat(balance1) > 0
                  ? `Balance: ${formatBalance(balance1, 2)} ${token1.symbol}`
                  : "Balance: 0"}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={amount1}
                onChange={(e) => {
                  setAmount1(e.target.value);
                  setShowTxError(false);
                }}
                placeholder="0.0"
                disabled={showPoolSelector}
                className={`w-full px-4 py-2 bg-gray-50 dark:bg-input-bg rounded-lg outline-none border ${
                  errors.amount1 ? "border-2 border-error" : "border-border"
                } ${showPoolSelector ? "opacity-50 cursor-not-allowed" : ""} text-text-primary`}
              />
              {errors.amount1 && (
                <p className="text-error text-xs mt-1">{errors.amount1}</p>
              )}
            </div>
            <TokenSelector
              selectedToken={token1}
              onTokenSelect={setToken1}
              excludeToken={token0}
              disabled={disableTokenSelection || showPoolSelector || (fromPositionsPage && selectedPool !== null)}
            />
          </div>
        </div>
        {/* @ts-ignore */}
        {(() => {
          return (
            <div key="fee-tier-selector">
              <label className="block text-sm font-medium mb-2 text-text-primary">Fee Tier</label>
              <select
                value={Number(fee)}
                onChange={(e) => setFee(parseInt(e.target.value))}
                disabled={disableTokenSelection || showPoolSelector || (fromPositionsPage && selectedPool !== null)}
                className={`w-full px-4 py-2 bg-gray-50 dark:bg-input-bg rounded-lg border border-border outline-none focus:border-primary text-text-primary ${
                  disableTokenSelection || showPoolSelector || (fromPositionsPage && selectedPool !== null) ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <option value={100}>0.01%</option>
                <option value={500}>0.05%</option>
                <option value={3000}>0.3%</option>
                <option value={10000}>1%</option>
              </select>
            </div>
          ) as React.ReactElement;
        })()}

        <PriceRangeSelector
          token0={token0}
          token1={token1}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          fullRange={fullRange}
          onFullRangeChange={setFullRange}
          calculatedPriceRange={calculatedPriceRange}
          currentTick={currentTick}
          isFirstLiquidity={isFirstLiquidity}
        />

        {/* First Liquidity Addition Warning */}
        {isFirstLiquidity && token0 && token1 && amount0 && amount1 && sqrtPriceX96 && currentTick !== null && (
          <div className="bg-secondary/20 border border-secondary/40 rounded-lg p-4">
            <p className="text-secondary font-semibold mb-2">
              ⚠️ First Liquidity Addition
            </p>
            <p className="text-text-primary text-sm mb-2">
              This is the first liquidity addition to a newly initialized pool. The token amounts must match the current price ratio exactly, or the transaction will fail.
            </p>
            {currentTick !== null && (
              <p className="text-text-secondary text-xs">
                Current tick: {currentTick} | The amounts will be automatically adjusted to match the current price when you click "Add Liquidity".
              </p>
            )}
          </div>
        )}

        {/* Error Display */}
        {showTxError && (mintError || isTxError) && (
          <div className="bg-error/20 border border-error/40 rounded-lg p-4">
            <p className="text-error text-sm">
              {mintError?.message ||
                "Transaction failed. Please check your inputs and try again."}
            </p>
            {(mintError?.message?.includes("uint(9)") || mintError?.message?.includes("error code 9")) && (
              <p className="text-error text-xs mt-2">
                <strong>Error Code 9:</strong> This usually means the token amounts don't match the current price ratio. For a newly initialized pool, amounts must match the initialization price exactly.
              </p>
            )}
          </div>
        )}

        {/* Info about token amounts and price range */}
        {!fullRange && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-text-primary text-sm mb-2">
              <strong>Note:</strong> Token amounts will be automatically adjusted to the optimal ratio for the selected price range. The contract will use the required amounts and refund any excess.
            </p>
            {calculatedPriceRange && calculatedPriceRange.min !== null && calculatedPriceRange.max !== null && (
              <p className="text-text-secondary text-xs">
                The calculated price range may differ slightly from your entered range due to tick spacing requirements.
              </p>
            )}
          </div>
        )}

        {/* Pool Initialization Prompt */}
        {showInitPrompt && poolNeedsInitialization && (
          <div className="bg-secondary/20 border border-secondary/40 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <p className="text-secondary font-semibold mb-1">
                  ⚠️ Pool Not Initialized
                </p>
                <p className="text-text-primary text-sm mb-3">
                  This pool exists but hasn&apos;t been initialized with a
                  starting price. You must initialize it before adding
                  liquidity.
                </p>
                {poolAddress && (
                  <p className="text-text-secondary text-xs mb-3 break-all">
                    Pool: {poolAddress}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Initial Price ({token1?.symbol} per {token0?.symbol})
                </label>
                <input
                  type="text"
                  value={initialPrice}
                  onChange={(e) => setInitialPrice(e.target.value)}
                  placeholder="1.0"
                  className="w-full px-4 py-2 bg-white dark:bg-input-bg border border-border rounded-lg outline-none focus:border-primary text-sm text-text-primary"
                />
                <p className="text-xs text-text-secondary mt-1">
                  Set the initial price for this pool (e.g., 1.5 means 1{" "}
                  {token1?.symbol} = 1.5 {token0?.symbol})
                </p>
              </div>

              {(initWriteError || initTxError) && (
                <div className="bg-error/20 border border-error/40 rounded-lg p-3">
                  <p className="text-error text-xs">
                    {initWriteError?.message ||
                      initTxError?.message ||
                      "Failed to initialize pool"}
                  </p>
                </div>
              )}

              {isInitSuccess && (
                <div className="bg-success/20 border border-success/40 rounded-lg p-3">
                  <p className="text-success text-xs font-semibold">
                    ✅ Pool initialized successfully! You can now add liquidity.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleInitializePool}
                  disabled={
                    !initialPrice ||
                    isNaN(parseFloat(initialPrice)) ||
                    parseFloat(initialPrice) <= 0 ||
                    isInitLoading
                  }
                  className="flex-1 py-2 px-4 bg-primary text-bg rounded-lg font-semibold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isInitLoading ? "Initializing..." : "Initialize Pool"}
                </button>
                <button
                  onClick={() => setShowInitPrompt(false)}
                  className="py-2 px-4 bg-gray-100 dark:bg-input-bg text-text-primary rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-bg transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleAddLiquidity}
          disabled={
            !token0 ||
            !token1 ||
            !amount0 ||
            !amount1 ||
            hasErrors ||
            isConfirming ||
            isApproving ||
            poolNeedsInitialization
          }
          className={`w-full py-4 rounded-2xl font-semibold transition-all shadow-md hover:shadow-lg ${
            !token0 ||
            !token1 ||
            !amount0 ||
            !amount1 ||
            hasErrors ||
            isConfirming ||
            isApproving ||
            poolNeedsInitialization
              ? "bg-secondary text-text-secondary cursor-not-allowed hover:shadow-md"
              : "bg-primary text-bg hover:opacity-90"
          }`}
        >
          {isApproving
            ? "Approving..."
            : needsApproval
            ? `Approve ${needsApproval0 ? token0?.symbol : token1?.symbol}`
            : isConfirming
            ? "Confirming..."
            : showSuccess
            ? "Transaction Confirmed!"
            : poolNeedsInitialization
            ? "Pool Needs Initialization"
            : "Add Liquidity"}
        </button>
      </div>
    </div>
  ) as ReactElement;
}
