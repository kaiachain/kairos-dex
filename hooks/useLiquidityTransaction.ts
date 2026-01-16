import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { PositionManager_ABI } from '@/abis/PositionManager';
import { Pool_ABI } from '@/abis/Pool';
import { erc20Abi } from 'viem';
import { parseUnits } from '@/lib/utils';
import { Token } from '@/types/token';
import { showToast } from '@/lib/showToast';

interface UseLiquidityTransactionProps {
  token0: Token | null;
  token1: Token | null;
  amount0: string;
  amount1: string;
  recipient?: `0x${string}`;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for managing liquidity addition transactions
 */
export function useLiquidityTransaction({
  token0,
  token1,
  amount0,
  amount1,
  recipient,
  onSuccess,
  onError,
}: UseLiquidityTransactionProps) {
  const { isConnected } = useAccount();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTxError, setShowTxError] = useState(false);

  const {
    writeContract: addLiquidity,
    data: hash,
    error: mintError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isTxError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const { writeContract: approveToken, data: approveHash } = useWriteContract();
  const { isLoading: isApproving, isSuccess: isApproved } =
    useWaitForTransactionReceipt({
      hash: approveHash,
    });

  // Show transaction errors when they occur
  useEffect(() => {
    if (mintError || isTxError) {
      setShowTxError(true);
      if (mintError) {
        console.error('Mint error:', mintError);
        const errorMessage = mintError.message || String(mintError);
        if (errorMessage.includes('uint(9)') || errorMessage.includes('error code 9')) {
          console.error('Error Code 9: Amount mismatch for first liquidity addition');
        }
      }
      if (onError && mintError) {
        onError(mintError as Error);
      }
    }
  }, [mintError, isTxError, onError]);

  // Clear transaction errors when user starts typing new amounts
  useEffect(() => {
    if (amount0 || amount1) {
      setShowTxError(false);
    }
  }, [amount0, amount1]);

  // Reset amounts and refetch balances when transaction is confirmed
  useEffect(() => {
    if (isConfirmed && !showSuccess) {
      setShowSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
      // Hide success message after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmed, showSuccess, onSuccess]);

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
        functionName: 'approve',
        args: [
          CONTRACTS.NonfungiblePositionManager as `0x${string}`,
          finalAmount,
        ],
      });
    } catch (error) {
      console.error('Approval error:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  };

  const executeAddLiquidity = (params: {
    token0: Token;
    token1: Token;
    amount0: string;
    amount1: string;
    tickLower: number;
    tickUpper: number;
    fee: number;
    deadline: number;
    recipient: `0x${string}`;
    sqrtPriceX96?: bigint;
  }) => {
    if (!isConnected) {
      showToast({
        type: 'warning',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first to add liquidity',
      });
      return;
    }

    const { token0: t0, token1: t1, amount0: amt0, amount1: amt1, tickLower, tickUpper, fee, deadline, recipient: recipientAddress, sqrtPriceX96 } = params;

    // Sort tokens by address (Uniswap V3 requirement)
    const isToken0First = t0.address.toLowerCase() < t1.address.toLowerCase();
    const sortedT0 = isToken0First ? t0 : t1;
    const sortedT1 = isToken0First ? t1 : t0;
    const sortedAmt0 = isToken0First ? amt0 : amt1;
    const sortedAmt1 = isToken0First ? amt1 : amt0;

    const amount0Desired = parseUnits(sortedAmt0, sortedT0.decimals);
    const amount1Desired = parseUnits(sortedAmt1, sortedT1.decimals);
    const amount0Min = amount0Desired - (amount0Desired * BigInt(5)) / BigInt(1000); // 0.5% slippage
    const amount1Min = amount1Desired - (amount1Desired * BigInt(5)) / BigInt(1000); // 0.5% slippage

    const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + deadline * 60);

    addLiquidity({
      address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
      abi: PositionManager_ABI,
      functionName: 'mint',
      args: [
        {
          token0: sortedT0.address.toLowerCase() as `0x${string}`,
          token1: sortedT1.address.toLowerCase() as `0x${string}`,
          fee,
          tickLower,
          tickUpper,
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          recipient: recipientAddress,
          deadline: deadlineTimestamp,
        },
      ],
    });
  };

  return {
    handleApprove,
    executeAddLiquidity,
    isConfirming,
    isConfirmed,
    isApproving,
    isApproved,
    showSuccess,
    showTxError,
    hash,
    approveHash,
  };
}
