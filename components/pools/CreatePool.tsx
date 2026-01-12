"use client";

import { useState, useEffect } from "react";
import { TokenSelector } from "@/components/swap/TokenSelector";
import { Token } from "@/types/token";
import { FEE_TIERS } from "@/config/contracts";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useReadContract,
} from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { Factory_ABI } from "@/abis/Factory";
import { Pool_ABI } from "@/abis/Pool";
import { parseUnits, priceToSqrtPriceX96 } from "@/lib/utils";

export function CreatePool() {
  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [fee, setFee] = useState(3000);
  const [initialPrice, setInitialPrice] = useState("");

  const { isConnected, address } = useAccount();
  const {
    writeContract: createPool,
    data: hash,
    error: writeError,
    isPending,
  } = useWriteContract();
  const {
    isLoading,
    isSuccess,
    error: txError,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  // Separate write contract for initializing the pool
  const {
    writeContract: initializePool,
    data: initHash,
    error: initWriteError,
    isPending: isInitPending,
  } = useWriteContract();
  const {
    isLoading: isInitLoading,
    isSuccess: isInitSuccess,
    error: initTxError,
  } = useWaitForTransactionReceipt({ hash: initHash });

  // State to track pool address after creation
  const [poolAddress, setPoolAddress] = useState<string | null>(null);

  const handleCreatePool = () => {
    // Validate wallet connection
    if (!isConnected) {
      alert("Please connect your wallet to create a pool.");
      return;
    }

    // Validate tokens are selected
    if (!token0 || !token1) {
      alert("Please select both tokens to create a pool.");
      return;
    }

    // Validate token addresses are not zero addresses
    // Note: Uniswap V3 requires wrapped tokens for native currency (use WKAIA, not zero address)
    if (
      !token0.address ||
      token0.address === "0x0000000000000000000000000000000000000000"
    ) {
      alert(
        "Token 0 address is invalid. For native KAIA, please use WKAIA (Wrapped KAIA) address instead of zero address."
      );
      return;
    }

    if (
      !token1.address ||
      token1.address === "0x0000000000000000000000000000000000000000"
    ) {
      alert(
        "Token 1 address is invalid. For native KAIA, please use WKAIA (Wrapped KAIA) address instead of zero address."
      );
      return;
    }

    // Validate tokens are different
    if (token0.address.toLowerCase() === token1.address.toLowerCase()) {
      alert("Please select two different tokens.");
      return;
    }

    // Validate initial price is a valid number
    if (!initialPrice) {
      alert("Please enter an initial price for the pool.");
      return;
    }

    const priceValue = parseFloat(initialPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      alert("Please enter a valid initial price (greater than 0)");
      return;
    }

    // Ensure token0 < token1 (Uniswap requirement)
    const [t0, t1] =
      token0.address.toLowerCase() < token1.address.toLowerCase()
        ? [token0, token1]
        : [token1, token0];

    // Validate addresses are properly formatted
    const t0Address = t0.address.startsWith("0x")
      ? t0.address
      : `0x${t0.address}`;
    const t1Address = t1.address.startsWith("0x")
      ? t1.address
      : `0x${t1.address}`;

    // Final validation before sending
    if (
      t0Address === "0x0000000000000000000000000000000000000000" ||
      t1Address === "0x0000000000000000000000000000000000000000"
    ) {
      alert(
        "Invalid token address detected. Please try selecting the tokens again."
      );
      return;
    }

    // Note: In Uniswap V3, createPool only creates the pool address
    // The initial price is set via the Pool.initialize() function after creation
    try {
      createPool({
        address: CONTRACTS.V3CoreFactory as `0x${string}`,
        abi: Factory_ABI,
        functionName: "createPool",
        args: [
          t0Address.toLowerCase() as `0x${string}`,
          t1Address.toLowerCase() as `0x${string}`,
          fee,
        ],
      });
    } catch (error) {
      console.error("Error creating pool:", error);
      alert(
        `Failed to create pool: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Get pool address from factory after pool is created
  const { data: fetchedPoolAddress } = useReadContract({
    address: CONTRACTS.V3CoreFactory as `0x${string}`,
    abi: Factory_ABI,
    functionName: "getPool",
    args:
      token0 && token1 && fee
        ? [
            (token0.address < token1.address
              ? token0.address
              : token1.address
            ).toLowerCase() as `0x${string}`,
            (token0.address < token1.address
              ? token1.address
              : token0.address
            ).toLowerCase() as `0x${string}`,
            fee,
          ]
        : undefined,
    query: {
      enabled: isSuccess && !!token0 && !!token1 && !!fee,
    },
  });

  // Update pool address when fetched
  useEffect(() => {
    if (
      fetchedPoolAddress &&
      fetchedPoolAddress !== "0x0000000000000000000000000000000000000000"
    ) {
      setPoolAddress(fetchedPoolAddress as string);
    }
  }, [fetchedPoolAddress]);

  // Auto-initialize pool after it's created
  useEffect(() => {
    if (
      poolAddress &&
      isSuccess &&
      !isInitSuccess &&
      !isInitPending &&
      !isInitLoading &&
      token0 &&
      token1 &&
      initialPrice
    ) {
      const priceValue = parseFloat(initialPrice);
      if (!isNaN(priceValue) && priceValue > 0) {
        // Calculate sqrtPriceX96 from the initial price
        // Price is token1 per token0 (e.g., if price is 1.5, 1 token1 = 1.5 token0)
        const sqrtPriceX96 = priceToSqrtPriceX96(
          priceValue,
          token0.decimals,
          token1.decimals
        );

        // Initialize the pool
        initializePool({
          address: poolAddress as `0x${string}`,
          abi: Pool_ABI,
          functionName: "initialize",
          args: [sqrtPriceX96],
        });
      }
    }
  }, [
    poolAddress,
    isSuccess,
    isInitSuccess,
    isInitPending,
    isInitLoading,
    token0,
    token1,
    initialPrice,
    initializePool,
  ]);

  const isValidPrice = initialPrice
    ? !isNaN(parseFloat(initialPrice)) && parseFloat(initialPrice) > 0
    : false;
  const isLoadingOrPending =
    isLoading || isPending || isInitLoading || isInitPending;
  const isButtonDisabled =
    !token0 ||
    !token1 ||
    !initialPrice ||
    !isValidPrice ||
    !isConnected ||
    isLoadingOrPending;

  // Display errors if any
  const displayError = writeError || txError || initWriteError || initTxError;
  const isFullySuccess = isSuccess && isInitSuccess;

  return (
    <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6 border border-border max-w-2xl">
      <h2 className="text-2xl font-bold mb-6 text-text-primary">Create Pool</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-text-primary">Token 0</label>
          <TokenSelector
            selectedToken={token0}
            onTokenSelect={setToken0}
            excludeToken={token1}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-text-primary">Token 1</label>
          <TokenSelector
            selectedToken={token1}
            onTokenSelect={setToken1}
            excludeToken={token0}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-text-primary">Fee Tier</label>
          <div className="grid grid-cols-4 gap-2">
            {FEE_TIERS.map((tier) => (
              <button
                key={tier.value}
                onClick={() => setFee(tier.value)}
                className={`p-3 rounded-lg border transition-colors ${
                  fee === tier.value
                    ? "bg-primary text-bg border-primary"
                    : "bg-gray-100 dark:bg-input-bg border-border"
                }`}
              >
                <div className="font-semibold text-text-primary">{tier.label}</div>
                <div className="text-xs opacity-75 text-text-secondary">{tier.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-text-primary">
            Initial Price ({token1?.symbol} per {token0?.symbol})
          </label>
          <input
            type="text"
            value={initialPrice}
            onChange={(e) => setInitialPrice(e.target.value)}
            placeholder="1.0"
            className="w-full px-4 py-2 bg-gray-50 dark:bg-input-bg rounded-lg border border-border outline-none focus:border-primary text-text-primary"
          />
          <p className="text-xs text-text-secondary mt-1">
            Set the initial price for this pool
          </p>
        </div>

        {!isConnected && (
          <div className="p-4 bg-secondary/20 border border-secondary/40 rounded-lg">
            <p className="text-sm text-text-primary">
              Please connect your wallet to create a pool.
            </p>
          </div>
        )}

        {displayError && (
          <div className="p-4 bg-error/20 border border-error/40 rounded-lg">
            <p className="text-sm text-error font-semibold mb-1">
              Transaction Failed
            </p>
            <p className="text-xs text-error">
              {writeError?.message ||
                txError?.message ||
                "Unknown error occurred"}
            </p>
            {writeError?.message?.includes("reverted") && (
              <p className="text-xs text-error mt-2">
                Common causes: Invalid token addresses, pool already exists, or
                insufficient gas.
              </p>
            )}
          </div>
        )}

        {isSuccess && !isInitSuccess && (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm text-text-primary font-semibold mb-1">
              Pool Created! Initializing...
            </p>
            {hash && (
              <p className="text-xs text-text-secondary">
                Create TX: {hash.slice(0, 10)}...{hash.slice(-8)}
              </p>
            )}
          </div>
        )}

        {isFullySuccess && (
          <div className="p-4 bg-success/20 border border-success/40 rounded-lg">
            <p className="text-sm text-success font-semibold mb-1">
              Pool Created and Initialized Successfully! 🎉
            </p>
            {poolAddress && (
              <p className="text-xs text-text-primary break-all">
                Pool Address: {poolAddress}
              </p>
            )}
            {hash && (
              <p className="text-xs text-text-secondary">
                Create TX: {hash.slice(0, 10)}...{hash.slice(-8)}
              </p>
            )}
            {initHash && (
              <p className="text-xs text-text-secondary">
                Init TX: {initHash.slice(0, 10)}...{initHash.slice(-8)}
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleCreatePool}
          disabled={isButtonDisabled}
          className="w-full py-4 bg-primary text-bg rounded-xl font-semibold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isInitPending || isInitLoading
            ? "Initializing Pool..."
            : isLoadingOrPending
            ? "Creating Pool..."
            : isFullySuccess
            ? "Pool Ready!"
            : !isConnected
            ? "Connect Wallet"
            : "Create Pool"}
        </button>
      </div>
    </div>
  );
}
