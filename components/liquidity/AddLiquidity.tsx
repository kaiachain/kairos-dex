"use client";

import { useState, useMemo, useEffect } from "react";
import { TokenSelector } from "@/components/swap/TokenSelector";
import { Token } from "@/types/token";
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
  formatNumber,
  formatBalance,
  priceToSqrtPriceX96,
} from "@/lib/utils";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { erc20Abi } from "viem";

interface AddLiquidityProps {
  initialToken0?: Token | null;
  initialToken1?: Token | null;
  initialFee?: number; // Fee tier as percentage (e.g., 0.3 for 0.3%)
  disableTokenSelection?: boolean; // Disable token selection when adding liquidity to a specific pool
}

export function AddLiquidity({
  initialToken0 = null,
  initialToken1 = null,
  initialFee,
  disableTokenSelection = false,
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

  const { address } = useAccount();
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

  // Determine if pool exists and is initialized
  const poolExists =
    poolAddress && poolAddress !== "0x0000000000000000000000000000000000000000";
  const isPoolInitialized = slot0 ? (slot0 as any)[0] !== BigInt(0) : false;
  const poolNeedsInitialization =
    poolExists && !isPoolInitialized && !isLoadingSlot0;

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
    if (!token0 || !token1 || !amount0 || !amount1) return;

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
    const [t0, t1] =
      token0.address < token1.address ? [token0, token1] : [token1, token0];
    const [amt0, amt1] =
      token0.address < token1.address ? [amount0, amount1] : [amount1, amount0];

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
    } else {
      // For custom range, we need proper tick calculation
      // For now, default to a range around current price
      // This is a simplified approach - in production, use Uniswap V3 SDK
      const tickSpacing =
        fee === 100 ? 1 : fee === 500 ? 10 : fee === 3000 ? 60 : 200;
      const currentTick = 0; // Would need to fetch from pool
      tickLower = Math.floor((currentTick - 1000) / tickSpacing) * tickSpacing;
      tickUpper = Math.ceil((currentTick + 1000) / tickSpacing) * tickSpacing;

      // Ensure tickLower < tickUpper
      if (tickLower >= tickUpper) {
        tickLower = tickUpper - tickSpacing;
      }
    }

    if (!address) return;

    try {
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
            amount0Desired: parseUnits(amt0, t0.decimals),
            amount1Desired: parseUnits(amt1, t1.decimals),
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Add Liquidity</h2>

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Token 0</label>
            {token0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isLoadingBalance0
                  ? "Loading..."
                  : balance0
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
                className={`w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg outline-none ${
                  errors.amount0 ? "border-2 border-red-500" : "border-none"
                }`}
              />
              {errors.amount0 && (
                <p className="text-red-500 text-xs mt-1">{errors.amount0}</p>
              )}
            </div>
            <TokenSelector
              selectedToken={token0}
              onTokenSelect={setToken0}
              excludeToken={token1}
              disabled={disableTokenSelection}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Token 1</label>
            {token1 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isLoadingBalance1
                  ? "Loading..."
                  : balance1
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
                className={`w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg outline-none ${
                  errors.amount1 ? "border-2 border-red-500" : "border-none"
                }`}
              />
              {errors.amount1 && (
                <p className="text-red-500 text-xs mt-1">{errors.amount1}</p>
              )}
            </div>
            <TokenSelector
              selectedToken={token1}
              onTokenSelect={setToken1}
              excludeToken={token0}
              disabled={disableTokenSelection}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Fee Tier</label>
          <select
            value={fee}
            onChange={(e) => setFee(parseInt(e.target.value))}
            disabled={disableTokenSelection}
            className={`w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none ${
              disableTokenSelection ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <option value={100}>0.01%</option>
            <option value={500}>0.05%</option>
            <option value={3000}>0.3%</option>
            <option value={10000}>1%</option>
          </select>
        </div>

        <PriceRangeSelector
          token0={token0}
          token1={token1}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          fullRange={fullRange}
          onFullRangeChange={setFullRange}
        />

        {/* Error Display */}
        {showTxError && (mintError || isTxError) && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400 text-sm">
              {mintError?.message ||
                "Transaction failed. Please check your inputs and try again."}
            </p>
          </div>
        )}

        {/* Warning for custom price range */}
        {!fullRange && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-600 dark:text-yellow-400 text-sm">
              Custom price ranges require proper tick calculations. For best
              results, use Full Range.
            </p>
          </div>
        )}

        {/* Pool Initialization Prompt */}
        {showInitPrompt && poolNeedsInitialization && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <p className="text-orange-800 dark:text-orange-200 font-semibold mb-1">
                  ⚠️ Pool Not Initialized
                </p>
                <p className="text-orange-700 dark:text-orange-300 text-sm mb-3">
                  This pool exists but hasn&apos;t been initialized with a
                  starting price. You must initialize it before adding
                  liquidity.
                </p>
                {poolAddress && (
                  <p className="text-orange-600 dark:text-orange-400 text-xs mb-3 break-all">
                    Pool: {poolAddress}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                  Initial Price ({token1?.symbol} per {token0?.symbol})
                </label>
                <input
                  type="text"
                  value={initialPrice}
                  onChange={(e) => setInitialPrice(e.target.value)}
                  placeholder="1.0"
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-orange-300 dark:border-orange-700 rounded-lg outline-none text-sm"
                />
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  Set the initial price for this pool (e.g., 1.5 means 1{" "}
                  {token1?.symbol} = 1.5 {token0?.symbol})
                </p>
              </div>

              {(initWriteError || initTxError) && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 text-xs">
                    {initWriteError?.message ||
                      initTxError?.message ||
                      "Failed to initialize pool"}
                  </p>
                </div>
              )}

              {isInitSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-green-600 dark:text-green-400 text-xs font-semibold">
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
                  className="flex-1 py-2 px-4 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isInitLoading ? "Initializing..." : "Initialize Pool"}
                </button>
                <button
                  onClick={() => setShowInitPrompt(false)}
                  className="py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
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
          className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
}
