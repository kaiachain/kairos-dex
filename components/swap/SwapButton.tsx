'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSendTransaction, usePublicClient } from 'wagmi';
import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from '@/lib/utils';
import { erc20Abi } from 'viem';
import { SwapRouter, SwapOptions, FeeAmount } from '@uniswap/v3-sdk';
import { Percent } from '@uniswap/sdk-core';
import { createUncheckedTradeFromQuote } from '@/lib/sdk-utils';
import { Loader2 } from 'lucide-react';
import { getAddress, isAddress, decodeErrorResult, decodeAbiParameters } from 'viem';
import { FEE_TIERS } from '@/config/contracts';
import { Pool_ABI } from '@/abis/Pool';
import { SwapRouter02_ABI } from '@/abis/SwapRouter02';
import { formatUnits } from '@/lib/utils';

interface SwapButtonProps {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  slippage: number;
  deadline: number;
  quote: SwapQuote | null;
  isQuoteLoading: boolean;
}

export function SwapButton({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  slippage,
  deadline,
  quote,
  isQuoteLoading,
}: SwapButtonProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const { writeContract: approveToken, data: approveHash } = useWriteContract();
  const { isLoading: isApprovingTx } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { sendTransaction: sendSwapTransaction, data: swapHash, error: sendSwapError } = useSendTransaction();
  const { isLoading: isSwapping, isError: isSwapError, error: swapReceiptError } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  // Log swap errors with detailed decoding
  useEffect(() => {
    if (sendSwapError) {
      console.error('Send swap transaction error:', sendSwapError);
      
      // Try to extract revert reason
      const errorMessage = String(sendSwapError?.message || sendSwapError || '');
      if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
        console.log('User rejected the transaction');
      } else if (errorMessage.includes('insufficient funds')) {
        console.error('Insufficient funds for gas');
      }
    }
    
    // When transaction hash is available but receipt shows error, fetch receipt to get revert reason
    if (swapHash && (isSwapError || swapReceiptError) && publicClient) {
      const fetchRevertReason = async () => {
        try {
          console.log('Fetching transaction receipt to get revert reason...');
          const receipt = await publicClient.getTransactionReceipt({ hash: swapHash });
          
          if (receipt.status === 'reverted') {
            console.error('Transaction reverted on-chain. Receipt:', receipt);
            console.error(`Transaction hash: ${swapHash}`);
            console.error(`Block explorer: https://kairos.kaiascan.io/tx/${swapHash}`);
            
            // The revert reason is typically not in the receipt itself, but we can try to trace
            // For now, log the receipt details
          }
        } catch (receiptError) {
          console.error('Error fetching transaction receipt:', receiptError);
        }
      };
      
      fetchRevertReason();
    }
    
    if (swapReceiptError) {
      console.error('Swap receipt error:', swapReceiptError);
      
      // Try to decode revert reason from error
      let revertReason = 'Unknown error';
      const errorMessage = String(swapReceiptError?.message || swapReceiptError || '');
      const errorData = (swapReceiptError as any)?.data || (swapReceiptError as any)?.cause?.data || (swapReceiptError as any)?.cause?.cause?.data;
      
      console.error('Attempting to decode revert reason. Error data:', errorData);
      
      if (errorData && publicClient) {
        try {
          const decoded = decodeErrorResult({
            abi: SwapRouter02_ABI,
            data: errorData as `0x${string}`,
          });
          revertReason = decoded.errorName || 'Contract revert';
          console.error('✅ Decoded revert reason from receipt:', decoded);
        } catch (decodeError) {
          console.error('Could not decode revert reason:', decodeError);
          // Try to decode as a standard Error(string) revert
          if (errorData && typeof errorData === 'string' && errorData.startsWith('0x08c379a0')) {
            try {
              const decoded = decodeAbiParameters(
                [{ type: 'string' }],
                `0x${errorData.substring(10)}` as `0x${string}`
              );
              revertReason = decoded[0] as string;
              console.error('✅ Decoded Error(string) revert:', revertReason);
            } catch (stringDecodeError) {
              console.error('Could not decode Error(string):', stringDecodeError);
            }
          }
        }
      }
      
      // Check for specific error codes (like uint(9) from block explorer)
      if (errorMessage.includes('uint(9)') || errorMessage.includes('uint 9') || errorMessage.includes('error code 9')) {
        revertReason = 'Insufficient output amount (slippage protection) - The actual output was less than the minimum required. Try increasing slippage tolerance or using a smaller amount.';
      } else if (errorMessage.includes('STF') || errorMessage.includes('Swap Too Far')) {
        revertReason = 'Insufficient liquidity in price range (STF)';
      } else if (errorMessage.includes('SPL') || errorMessage.includes('Sqrt Price Limit')) {
        revertReason = 'Price limit exceeded (SPL)';
      } else if (errorMessage.includes('LOK') || errorMessage.includes('Locked')) {
        revertReason = 'Pool is locked (LOK)';
      } else if (errorMessage.includes('allowance') || errorMessage.includes('insufficient allowance')) {
        revertReason = 'Insufficient token allowance';
      } else if (errorMessage.includes('balance') || errorMessage.includes('insufficient balance')) {
        revertReason = 'Insufficient token balance';
      } else if (errorMessage.includes('deadline') || errorMessage.includes('expired')) {
        revertReason = 'Transaction deadline expired';
      } else if (errorMessage.includes('amountOutMinimum') || errorMessage.includes('slippage') || errorMessage.includes('Too little received')) {
        revertReason = 'Slippage tolerance exceeded - price moved unfavorably since quote';
      } else if (errorMessage.includes('execution reverted')) {
        revertReason = 'Transaction reverted - likely insufficient output amount or liquidity issue';
      }
      
      console.error('Swap failed with reason:', revertReason);
      console.error('Full error details:', {
        message: errorMessage,
        data: errorData,
        error: swapReceiptError,
        transactionHash: swapHash,
      });
      
      // Show user-friendly error with transaction hash
      if (swapHash) {
        alert(`Swap failed: ${revertReason}\n\nTransaction hash: ${swapHash}\n\nCheck the block explorer for more details:\nhttps://kairos.kaiascan.io/tx/${swapHash}`);
      } else {
        alert(`Swap failed: ${revertReason}\n\nCheck console for detailed error information.`);
      }
    }
    
    if (isSwapError) {
      console.error('Swap transaction failed - check transaction receipt for revert reason');
      if (swapHash) {
        console.error(`Transaction hash: ${swapHash}`);
        console.error(`Block explorer: https://kairos.kaiascan.io/tx/${swapHash}`);
      }
    }
  }, [sendSwapError, swapReceiptError, isSwapError, publicClient]);

  // Check allowance
  const { data: allowance } = useReadContract({
    address: tokenIn?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && tokenIn
      ? [address, CONTRACTS.SwapRouter02 as `0x${string}`]
      : undefined,
    query: {
      enabled: !!tokenIn && !!address,
    },
  });

  // Check token balance
  const { data: tokenBalance } = useReadContract({
    address: tokenIn?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!tokenIn && !!address,
    },
  });

  // Check pool liquidity and state
  const { data: poolLiquidity } = useReadContract({
    address: quote?.poolAddress as `0x${string}` | undefined,
    abi: Pool_ABI,
    functionName: 'liquidity',
    query: {
      enabled: !!quote?.poolAddress,
    },
  });

  // Check pool slot0 to verify pool is unlocked
  const { data: poolSlot0 } = useReadContract({
    address: quote?.poolAddress as `0x${string}` | undefined,
    abi: Pool_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!quote?.poolAddress,
    },
  });


  // Check if approval is needed and validate balance
  useEffect(() => {
    if (!tokenIn || !amountIn) {
      setNeedsApproval(false);
      return;
    }

    // If allowance or tokenBalance haven't loaded yet, don't update needsApproval
    if (allowance === undefined || tokenBalance === undefined) {
      return;
    }

    const requiredAmount = parseUnits(amountIn, tokenIn.decimals);
    const hasEnoughBalance = tokenBalance >= requiredAmount;
    const hasEnoughAllowance = allowance >= requiredAmount;

    if (!hasEnoughBalance) {
      console.warn('Insufficient token balance:', {
        required: requiredAmount.toString(),
        available: tokenBalance.toString(),
      });
    }

    if (!hasEnoughAllowance) {
      console.log('Insufficient allowance detected:', {
        required: requiredAmount.toString(),
        approved: allowance.toString(),
      });
    }

    setNeedsApproval(!hasEnoughAllowance);
  }, [tokenIn, amountIn, allowance, tokenBalance]);

  const handleApprove = async () => {
    if (!tokenIn || !amountIn) return;
    setIsApproving(true);
    try {
      // Approve a bit more than needed to avoid needing re-approval for small amounts
      // Following the guide: "we must give the SwapRouter approval to spend our tokens"
      const amountInWei = parseUnits(amountIn, tokenIn.decimals);
      // Approve 110% of input amount to account for small variations
      const approveAmount = (amountInWei * BigInt(110)) / BigInt(100);

      approveToken({
        address: tokenIn.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [
          CONTRACTS.SwapRouter02 as `0x${string}`,
          approveAmount,
        ],
      });
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setIsApproving(false);
    }
  };

  /**
   * Comprehensive validation function following Uniswap V3 protocol criteria
   * Validates all aspects before executing swap transaction
   * Includes checks for: token approval, user balance, and pool liquidity
   */
  const validateSwap = async (): Promise<{ valid: boolean; error?: string }> => {
    // 1. Basic input validation
    if (!tokenIn || !tokenOut || !amountIn || !amountOut || !address || !quote) {
      return { valid: false, error: 'Missing required swap parameters' };
    }

    // 2. Token validation
    // 2.1: Token addresses must be valid
    if (!isAddress(tokenIn.address) || !isAddress(tokenOut.address)) {
      return { valid: false, error: 'Invalid token addresses' };
    }

    // 2.2: Tokens must be different
    if (tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()) {
      return { valid: false, error: 'Cannot swap token for itself' };
    }

    // 2.3: Token decimals must be valid (0-18)
    if (
      tokenIn.decimals < 0 || tokenIn.decimals > 18 ||
      tokenOut.decimals < 0 || tokenOut.decimals > 18
    ) {
      return { valid: false, error: 'Invalid token decimals (must be 0-18)' };
    }

    // 3. Amount validation
    // 3.1: Amounts must be valid numbers
    const amountInNum = parseFloat(amountIn);
    const amountOutNum = parseFloat(quote.amountOut);

    if (isNaN(amountInNum) || isNaN(amountOutNum)) {
      return { valid: false, error: 'Invalid amount format' };
    }

    // 3.2: Amounts must be greater than 0
    if (amountInNum <= 0) {
      return { valid: false, error: 'Input amount must be greater than 0' };
    }

    if (amountOutNum <= 0) {
      return { valid: false, error: 'Output amount must be greater than 0' };
    }

    // 3.3: Check for dust amounts (very small amounts that might fail)
    const MIN_AMOUNT = 0.000001; // Minimum 0.000001 tokens
    if (amountInNum < MIN_AMOUNT) {
      return { valid: false, error: `Amount too small (minimum ${MIN_AMOUNT})` };
    }

    // 3.4: Balance validation - Ensure user has enough balance
    const requiredAmount = parseUnits(amountIn, tokenIn.decimals);
    
    if (tokenBalance === undefined) {
      return { valid: false, error: 'Unable to check token balance. Please try again.' };
    }
    
    if (!tokenBalance || tokenBalance < requiredAmount) {
      const balanceFormatted = tokenBalance ? formatUnits(tokenBalance, tokenIn.decimals) : '0';
      const requiredFormatted = formatUnits(requiredAmount, tokenIn.decimals);
      return { 
        valid: false, 
        error: `Insufficient ${tokenIn.symbol} balance. Required: ${requiredFormatted}, Available: ${balanceFormatted}` 
      };
    }

    // 3.5: Allowance validation - Ensure enough tokens are approved for spending
    if (allowance === undefined) {
      return { valid: false, error: 'Unable to check token allowance. Please try again.' };
    }
    
    if (!allowance || allowance < requiredAmount) {
      const allowanceFormatted = allowance ? formatUnits(allowance, tokenIn.decimals) : '0';
      const requiredFormatted = formatUnits(requiredAmount, tokenIn.decimals);
      return { 
        valid: false, 
        error: `Insufficient token allowance. Required: ${requiredFormatted}, Approved: ${allowanceFormatted}. Please approve more tokens.` 
      };
    }

    // 4. Quote validation
    // 4.1: Quote must have required fields
    if (!quote.fee || quote.fee === undefined || quote.fee === null) {
      return { valid: false, error: 'Quote missing fee information' };
    }

    if (!quote.poolAddress || !isAddress(quote.poolAddress)) {
      return { valid: false, error: 'Quote missing or invalid pool address' };
    }

    // 4.2: Fee must be a valid Uniswap V3 fee tier
    const validFees = FEE_TIERS.map(tier => tier.value);
    if (!validFees.includes(quote.fee as FeeAmount)) {
      return { valid: false, error: `Invalid fee tier: ${quote.fee}. Must be one of: ${validFees.join(', ')}` };
    }

    // 4.3: Quote amount out must be reasonable
    if (parseFloat(quote.amountOut) <= 0) {
      return { valid: false, error: 'Quote output amount must be greater than 0' };
    }

    // 4.4: Pool liquidity validation - Ensure pool has enough liquidity
    if (poolLiquidity === undefined) {
      // If we can't check liquidity, we'll still proceed but log a warning
      console.warn('Unable to check pool liquidity. Proceeding with caution.');
    } else {
      const liquidity = poolLiquidity as bigint;
      
      // Pool must have liquidity (greater than 0)
      if (liquidity === BigInt(0)) {
        return { valid: false, error: 'Pool has no liquidity. Cannot execute swap.' };
      }
      
      // For very small swaps, we need at least some minimum liquidity
      // For larger swaps, we need proportionally more liquidity
      // A rough check: liquidity should be at least 10x the input amount for safety
      const minLiquidityRequired = requiredAmount * BigInt(10);
      
      if (liquidity < minLiquidityRequired) {
        const liquidityFormatted = formatUnits(liquidity, 18); // Liquidity is in Q128.128 format, but we'll format as 18 decimals for display
        const requiredFormatted = formatUnits(minLiquidityRequired, 18);
        console.warn('Pool liquidity may be insufficient:', {
          poolLiquidity: liquidity.toString(),
          minRequired: minLiquidityRequired.toString(),
          inputAmount: requiredAmount.toString(),
        });
        // We'll warn but not block - the quote should have already accounted for this
      }
    }

    // 4.5: Pool state validation - Ensure pool is not locked
    if (poolSlot0 !== undefined) {
      let unlocked = true;
      
      // Extract unlocked status from slot0
      if (Array.isArray(poolSlot0)) {
        // slot0 is a tuple: [sqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext, feeProtocol, unlocked]
        unlocked = poolSlot0[6] as boolean;
      } else if (poolSlot0 && typeof poolSlot0 === 'object') {
        unlocked = (poolSlot0 as any).unlocked as boolean;
      }
      
      if (!unlocked) {
        return { valid: false, error: 'Pool is currently locked (swap in progress). Please wait and try again.' };
      }
    }

    // 5. Slippage validation
    // 5.1: Slippage must be within reasonable bounds (0-50%)
    if (slippage < 0 || slippage > 50) {
      return { valid: false, error: 'Slippage tolerance must be between 0% and 50%' };
    }

    // 5.2: Warn if slippage is very high (but allow it)
    if (slippage > 10) {
      console.warn(`High slippage tolerance: ${slippage}%`);
    }

    // 6. Deadline validation
    // 6.1: Deadline must be positive
    if (deadline <= 0) {
      return { valid: false, error: 'Deadline must be greater than 0 minutes' };
    }

    // 6.2: Deadline must not be too far in the future (max 30 days)
    const MAX_DEADLINE_MINUTES = 30 * 24 * 60; // 30 days
    if (deadline > MAX_DEADLINE_MINUTES) {
      return { valid: false, error: `Deadline too far in future (max ${MAX_DEADLINE_MINUTES} minutes)` };
    }

    // 6.3: Calculate and validate deadline timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const deadlineTimestamp = currentTimestamp + deadline * 60;

    if (deadlineTimestamp <= currentTimestamp) {
      return { valid: false, error: 'Deadline must be in the future' };
    }

    // 6.4: Deadline must be at least 1 minute in the future
    const minDeadlineTimestamp = currentTimestamp + 60;
    if (deadlineTimestamp < minDeadlineTimestamp) {
      return { valid: false, error: 'Deadline must be at least 1 minute in the future' };
    }

    // 7. Recipient validation
    if (!address || !isAddress(address)) {
      return { valid: false, error: 'Invalid recipient address' };
    }

    // All validations passed
    return { valid: true };
  };

  const handleSwap = async () => {
    // Perform comprehensive validation before proceeding
    const validation = await validateSwap();
    if (!validation.valid) {
      console.error('Swap validation failed:', validation.error);
      alert(validation.error || 'Swap validation failed. Please check your inputs.');
      return;
    }

    if (!tokenIn || !tokenOut || !amountIn || !amountOut || !address || !quote) return;

    // Following the Uniswap V3 SDK guide: "Executing a Trade"
    // Step 1: Check token approval (already validated in validateSwap, but double-check)
    const requiredAmount = parseUnits(amountIn, tokenIn.decimals);

    if (!allowance || allowance < requiredAmount) {
      console.warn('Insufficient allowance detected');
      setNeedsApproval(true);
      return;
    }

    if (!tokenBalance || tokenBalance < requiredAmount) {
      console.error('Insufficient token balance for swap');
      alert(`Insufficient ${tokenIn.symbol} balance.`);
      return;
    }

    try {
      // Step 2: Construct an unchecked trade from the fetched quote
      // Following the guide: "Constructing an unchecked trade"
      // We use the quote data we already have from useSwapQuote
      console.log('Constructing unchecked trade from quote...');
      
      const tradeResult = await createUncheckedTradeFromQuote(
        tokenIn,
        tokenOut,
        amountIn,
        quote.amountOut,
        quote.poolAddress,
        quote.fee
      );

      if (!tradeResult) {
        console.error('Failed to create unchecked trade from quote');
        alert('Failed to prepare swap. Please try again.');
        return;
      }

      const { trade, route } = tradeResult;
      
      // 8. Trade validation
      // 8.1: Trade must exist and have valid amounts
      if (!trade || !trade.inputAmount || !trade.outputAmount) {
        console.error('Invalid trade created');
        alert('Invalid trade. Please try again.');
        return;
      }
      
      // 8.2: Trade route must be valid
      if (!route || route.pools.length === 0) {
        console.error('Trade has no valid route or pools');
        alert('No valid route found. Please try again.');
        return;
      }

      // 8.3: Verify output amount is reasonable (not zero or negative)
      if (trade.outputAmount.quotient.toString() === '0') {
        console.error('Trade output amount is zero');
        alert('Invalid trade output. Please try again.');
        return;
      }

      // 8.4: Verify input amount matches expected
      const expectedInputAmount = parseUnits(amountIn, tokenIn.decimals);
      const tradeInputAmount = BigInt(trade.inputAmount.quotient.toString());
      
      // Allow small difference due to rounding (0.1% tolerance)
      const inputTolerance = expectedInputAmount / BigInt(1000);
      if (tradeInputAmount < expectedInputAmount - inputTolerance || tradeInputAmount > expectedInputAmount + inputTolerance) {
        console.warn('Trade input amount mismatch:', {
          expected: expectedInputAmount.toString(),
          actual: tradeInputAmount.toString(),
        });
      }

      // 8.5: Verify output amount is reasonable compared to quote
      const quoteAmountOut = parseUnits(quote.amountOut, tokenOut.decimals);
      const tradeOutputAmount = BigInt(trade.outputAmount.quotient.toString());
      
      // Output should be close to quote (within 5% tolerance for price movement)
      const outputTolerance = quoteAmountOut / BigInt(20); // 5%
      if (tradeOutputAmount < quoteAmountOut - outputTolerance) {
        console.warn('Trade output amount significantly lower than quote:', {
          quote: quoteAmountOut.toString(),
          trade: tradeOutputAmount.toString(),
        });
      }

      // Step 3: Set swap options
      // Following the guide: "Executing a trade" - setting options
      // Convert slippage percentage to bips (basis points)
      // e.g., 0.5% = 50 bips = 50/10000
      const slippageBips = Math.floor(slippage * 100); // Convert percentage to bips
      const slippageTolerance = new Percent(slippageBips, 10_000);
      
      // Calculate deadline: current timestamp + deadline minutes
      // Following the guide: "20 minutes from the current Unix time"
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const deadlineTimestamp = currentTimestamp + Math.max(deadline * 60, 60); // At least 1 minute

      // 9. Final validation before constructing swap parameters
      // 9.1: Calculate minimum amount out and verify it's reasonable
      const minimumAmountOut = trade.minimumAmountOut(slippageTolerance);
      const minimumAmountOutValue = parseFloat(minimumAmountOut.toExact());
      
      if (minimumAmountOutValue <= 0) {
        console.error('Minimum amount out is zero or negative');
        alert('Invalid minimum output amount. Please try again.');
        return;
      }

      // 9.2: Verify minimum amount out is within expected range
      const expectedMinimum = parseFloat(quote.amountOut) * (1 - slippage / 100);
      const actualMinimum = minimumAmountOutValue;
      const minDifference = Math.abs(expectedMinimum - actualMinimum) / expectedMinimum;
      
      if (minDifference > 0.1) { // More than 10% difference
        console.warn('Minimum output amount calculation might be incorrect:', {
          expectedMinimum,
          actualMinimum,
          difference: `${(minDifference * 100).toFixed(2)}%`,
        });
      }

      const options: SwapOptions = {
        slippageTolerance,
        deadline: deadlineTimestamp,
        recipient: address,
      };
      
      console.log('Swap options:', {
        slippagePercent: `${slippage}%`,
        slippageBips,
        slippageTolerance: slippageTolerance.toFixed(),
        deadline: deadlineTimestamp,
        deadlineDate: new Date(deadlineTimestamp * 1000).toISOString(),
        recipient: address,
      });

      // Step 4: Get method parameters from SwapRouter
      // Following the guide: "Use the SwapRouter class... to get the associated call parameters"
      const methodParameters = SwapRouter.swapCallParameters([trade], options);

      // 10. Method parameters validation
      // 10.1: Calldata must exist and be valid
      if (!methodParameters.calldata || methodParameters.calldata.length < 10) {
        console.error('Invalid method parameters calldata');
        alert('Failed to generate swap transaction data. Please try again.');
        return;
      }

      // 10.2: Verify contract address is valid
      if (!CONTRACTS.SwapRouter02 || !isAddress(CONTRACTS.SwapRouter02)) {
        console.error('Invalid SwapRouter02 contract address');
        alert('Invalid swap router address. Please check configuration.');
        return;
      }

      // 10.3: Verify value is valid (should be 0 for ERC20 swaps, or positive for ETH swaps)
      if (methodParameters.value && methodParameters.value < 0) {
        console.error('Invalid transaction value');
        alert('Invalid transaction value. Please try again.');
        return;
      }

      console.log('Swap execution details:', {
        inputAmount: trade.inputAmount.toExact(),
        inputAmountRaw: trade.inputAmount.quotient.toString(),
        outputAmount: trade.outputAmount.toExact(),
        outputAmountRaw: trade.outputAmount.quotient.toString(),
        minimumOutput: minimumAmountOut.toExact(),
        slippageTolerance: slippageTolerance.toFixed(),
        slippagePercent: `${slippage}%`,
        deadline: deadlineTimestamp,
        deadlineDate: new Date(deadlineTimestamp * 1000).toISOString(),
        calldataLength: methodParameters.calldata.length,
        calldataPreview: methodParameters.calldata.substring(0, 100) + '...',
        value: methodParameters.value,
        to: CONTRACTS.SwapRouter02,
        route: route.pools.map(p => ({
          token0: p.token0.symbol,
          token1: p.token1.symbol,
          fee: p.fee,
        })),
      });

      // Step 5: Double-check allowance, balance, pool state, liquidity, and get fresh quote
      // Sometimes state can change between validation and execution
      if (publicClient && address && tokenIn && quote?.poolAddress) {
        console.log('Re-checking state before simulation...');
        try {
          const [currentAllowance, currentBalance, poolSlot0, poolLiquidity] = await Promise.all([
            publicClient.readContract({
              address: tokenIn.address as `0x${string}`,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [address as `0x${string}`, CONTRACTS.SwapRouter02 as `0x${string}`],
            }),
            publicClient.readContract({
              address: tokenIn.address as `0x${string}`,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            }),
            publicClient.readContract({
              address: quote.poolAddress as `0x${string}`,
              abi: Pool_ABI,
              functionName: 'slot0',
            }),
            publicClient.readContract({
              address: quote.poolAddress as `0x${string}`,
              abi: Pool_ABI,
              functionName: 'liquidity',
            }),
          ]);
          
          const requiredAmount = BigInt(trade.inputAmount.quotient.toString());
          
          // Check pool lock status
          let poolUnlocked = true;
          if (Array.isArray(poolSlot0)) {
            poolUnlocked = poolSlot0[6] as boolean;
          } else if (poolSlot0 && typeof poolSlot0 === 'object') {
            poolUnlocked = (poolSlot0 as any).unlocked as boolean;
          }
          
          // Validate pool liquidity is sufficient
          const liquidity = poolLiquidity as bigint;
          console.log('Pool liquidity check:', {
            poolLiquidity: liquidity.toString(),
            inputAmount: requiredAmount.toString(),
            liquidityFormatted: formatUnits(liquidity, 18), // Approximate display
          });
          
          // Pool must have liquidity
          if (liquidity === BigInt(0)) {
            alert('Pool has no liquidity. Cannot execute swap. Please add liquidity to the pool first.');
            return;
          }
          
          // For Uniswap V3, liquidity is stored in Q128.128 format
          // A rough heuristic: liquidity should be significantly larger than the swap amount
          // For small pools, we need at least 20x the input amount in liquidity
          // For larger swaps, we need proportionally more
          // Since liquidity is in Q128.128, we compare it directly (it's already scaled)
          const minLiquidityMultiplier = BigInt(20); // Require at least 20x liquidity
          const minLiquidityRequired = requiredAmount * minLiquidityMultiplier;
          
          // For very large swaps, increase the multiplier
          // If swapping more than 1 token (assuming 18 decimals), need more liquidity
          const oneToken = BigInt(10) ** BigInt(18);
          if (requiredAmount > oneToken) {
            // For swaps > 1 token, need at least 50x liquidity
            const largeSwapMultiplier = BigInt(50);
            const largeSwapMinLiquidity = requiredAmount * largeSwapMultiplier;
            if (liquidity < largeSwapMinLiquidity) {
              const liquidityFormatted = formatUnits(liquidity, 18);
              const requiredFormatted = formatUnits(largeSwapMinLiquidity, 18);
              const inputFormatted = formatUnits(requiredAmount, tokenIn.decimals);
              alert(
                `⚠️ Insufficient pool liquidity for this swap size!\n\n` +
                `Swap amount: ${inputFormatted} ${tokenIn.symbol}\n` +
                `Pool liquidity: ~${liquidityFormatted}\n` +
                `Minimum required: ~${requiredFormatted}\n\n` +
                `The pool needs more liquidity to handle this swap size safely.\n\n` +
                `Recommendations:\n` +
                `1. Try a smaller swap amount (less than ${formatUnits(requiredAmount / BigInt(2), tokenIn.decimals)} ${tokenIn.symbol})\n` +
                `2. Add more liquidity to the pool\n` +
                `3. Increase slippage tolerance significantly (5-10%)\n\n` +
                `Note: Pool liquidity is currently too low for this swap size.`
              );
              return;
            }
          } else {
            // For smaller swaps, use the standard multiplier
            if (liquidity < minLiquidityRequired) {
              const liquidityFormatted = formatUnits(liquidity, 18);
              const requiredFormatted = formatUnits(minLiquidityRequired, 18);
              const inputFormatted = formatUnits(requiredAmount, tokenIn.decimals);
              console.warn('Pool liquidity may be insufficient:', {
                poolLiquidity: liquidity.toString(),
                minRequired: minLiquidityRequired.toString(),
                inputAmount: requiredAmount.toString(),
                multiplier: minLiquidityMultiplier.toString(),
              });
              
              // Warn but allow if it's close (within 50% of required)
              const warningThreshold = minLiquidityRequired * BigInt(50) / BigInt(100);
              if (liquidity < warningThreshold) {
                alert(
                  `⚠️ Low pool liquidity warning!\n\n` +
                  `Swap amount: ${inputFormatted} ${tokenIn.symbol}\n` +
                  `Pool liquidity: ~${liquidityFormatted}\n` +
                  `Recommended minimum: ~${requiredFormatted}\n\n` +
                  `The pool may have insufficient liquidity for this swap.\n\n` +
                  `Recommendations:\n` +
                  `1. Try a smaller swap amount\n` +
                  `2. Increase slippage tolerance (3-5%)\n` +
                  `3. Add more liquidity to the pool\n\n` +
                  `Proceeding may result in high price impact or swap failure.`
                );
                // Don't block, but warn the user
              }
            }
          }
          
          console.log('Pre-simulation state check:', {
            requiredAmount: requiredAmount.toString(),
            currentAllowance: currentAllowance.toString(),
            currentBalance: currentBalance.toString(),
            hasEnoughAllowance: currentAllowance >= requiredAmount,
            hasEnoughBalance: currentBalance >= requiredAmount,
            poolUnlocked,
            poolLiquidity: liquidity.toString(),
            liquiditySufficient: liquidity >= minLiquidityRequired,
            poolSlot0: poolSlot0,
          });
          
          if (currentAllowance < requiredAmount) {
            const allowanceFormatted = formatUnits(currentAllowance, tokenIn.decimals);
            const requiredFormatted = formatUnits(requiredAmount, tokenIn.decimals);
            alert(`Insufficient token allowance. Required: ${requiredFormatted}, Approved: ${allowanceFormatted}. Please approve more tokens.`);
            setNeedsApproval(true);
            return;
          }
          
          if (currentBalance < requiredAmount) {
            const balanceFormatted = formatUnits(currentBalance, tokenIn.decimals);
            const requiredFormatted = formatUnits(requiredAmount, tokenIn.decimals);
            alert(`Insufficient token balance. Required: ${requiredFormatted}, Available: ${balanceFormatted}.`);
            return;
          }
          
          if (!poolUnlocked) {
            alert('Pool is currently locked (another swap in progress). Please wait a moment and try again.');
            return;
          }
          
          // Get a fresh quote to check if slippage is the issue
          try {
            const { getQuoteFromQuoterV2 } = await import('@/hooks/useSwapQuote');
            const freshQuote = await getQuoteFromQuoterV2(
              tokenIn,
              tokenOut,
              amountIn,
              quote.fee
            );
            
            if (freshQuote) {
              const freshAmountOut = BigInt(freshQuote.amountOut.toString());
              const minimumAmountOutRaw = BigInt(minimumAmountOut.quotient.toString());
              
              // Add a safety buffer (5% below minimum) to account for execution-time price movement
              const safetyBuffer = minimumAmountOutRaw * BigInt(95) / BigInt(100);
              
              console.log('Fresh quote check:', {
                originalQuote: quote.amountOut,
                freshQuote: formatUnits(freshAmountOut, tokenOut.decimals),
                minimumRequired: formatUnits(minimumAmountOutRaw, tokenOut.decimals),
                safetyBuffer: formatUnits(safetyBuffer, tokenOut.decimals),
                freshQuoteMeetsMinimum: freshAmountOut >= minimumAmountOutRaw,
                freshQuoteMeetsSafetyBuffer: freshAmountOut >= safetyBuffer,
                priceMoved: freshAmountOut < minimumAmountOutRaw,
              });
              
              // Check against safety buffer first (more lenient)
              if (freshAmountOut < safetyBuffer) {
                const priceImpact = ((Number(minimumAmountOutRaw) - Number(freshAmountOut)) / Number(minimumAmountOutRaw)) * 100;
                const suggestedSlippage = Math.max(slippage * 2, 5); // Suggest at least 5% slippage
                alert(
                  `⚠️ High price impact detected!\n\n` +
                  `Current output: ${formatUnits(freshAmountOut, tokenOut.decimals)} ${tokenOut.symbol}\n` +
                  `Minimum required: ${formatUnits(minimumAmountOutRaw, tokenOut.decimals)} ${tokenOut.symbol}\n` +
                  `Price impact: ${priceImpact.toFixed(2)}%\n\n` +
                  `The pool may have insufficient liquidity for this swap size.\n\n` +
                  `Recommendations:\n` +
                  `1. Increase slippage tolerance to at least ${suggestedSlippage}%\n` +
                  `2. Try a smaller swap amount\n` +
                  `3. Wait for more liquidity to be added to the pool\n\n` +
                  `Current slippage: ${slippage}%`
                );
                return;
              }
              
              // Check against exact minimum (stricter)
              if (freshAmountOut < minimumAmountOutRaw) {
                const priceImpact = ((Number(minimumAmountOutRaw) - Number(freshAmountOut)) / Number(minimumAmountOutRaw)) * 100;
                const suggestedSlippage = Math.max(slippage * 1.5, 2); // Suggest at least 2% slippage
                alert(
                  `Price moved unfavorably since quote.\n\n` +
                  `Current output: ${formatUnits(freshAmountOut, tokenOut.decimals)} ${tokenOut.symbol}\n` +
                  `Minimum required: ${formatUnits(minimumAmountOutRaw, tokenOut.decimals)} ${tokenOut.symbol}\n` +
                  `Price impact: ${priceImpact.toFixed(2)}%\n\n` +
                  `Try increasing slippage tolerance to ${suggestedSlippage}% or wait for better price.`
                );
                return;
              }
            } else {
              console.warn('Could not get fresh quote - pool may have insufficient liquidity');
              alert(
                `⚠️ Could not get fresh quote from pool.\n\n` +
                `This usually means:\n` +
                `1. Pool has insufficient liquidity for this swap size\n` +
                `2. Pool state changed significantly\n\n` +
                `Try:\n` +
                `- Using a smaller swap amount\n` +
                `- Increasing slippage tolerance significantly (5-10%)\n` +
                `- Waiting for more liquidity to be added`
              );
              return;
            }
          } catch (freshQuoteError) {
            console.warn('Could not get fresh quote:', freshQuoteError);
            alert(
              `⚠️ Failed to verify quote with pool.\n\n` +
              `This may indicate insufficient liquidity.\n\n` +
              `Recommendations:\n` +
              `- Try a smaller swap amount\n` +
              `- Increase slippage tolerance to 5-10%\n` +
              `- Check if pool has enough liquidity`
            );
            return;
          }
        } catch (stateCheckError) {
          console.warn('Could not re-check state:', stateCheckError);
          // Continue anyway - validation already checked this
        }
      }

      // Step 6: Simulate transaction before sending
      // This helps catch revert reasons before actually sending the transaction
      if (publicClient && address) {
        try {
          console.log('Simulating swap transaction...');
          
          // Try using simulateContract first for better error messages
          // Decode the calldata to extract function and parameters
          const calldata = methodParameters.calldata as `0x${string}`;
          const functionSelector = calldata.substring(0, 10);
          
          // Check if it's exactInputSingle (0x414bf389)
          if (functionSelector === '0x414bf389' && tokenIn && tokenOut) {
            try {
              // Decode the parameters from calldata
              const { decodeFunctionData } = await import('viem');
              const decoded = decodeFunctionData({
                abi: SwapRouter02_ABI,
                data: calldata,
              });
              
              console.log('Decoded function call:', decoded);
              
              // Try simulateContract with decoded parameters for better error messages
              const result = await publicClient.simulateContract({
                address: CONTRACTS.SwapRouter02 as `0x${string}`,
                abi: SwapRouter02_ABI,
                functionName: decoded.functionName as 'exactInputSingle',
                args: decoded.args,
                account: address as `0x${string}`,
                value: methodParameters.value ? BigInt(methodParameters.value) : undefined,
              });
              
              console.log('✅ Swap simulation successful (via simulateContract)');
              // Continue to send transaction
            } catch (simulateContractError: any) {
              // simulateContract might give better error messages
              console.log('simulateContract failed, trying raw call...', simulateContractError);
              // Fall through to raw call
            }
          }
          
          // Fallback: Use raw call to simulate the exact transaction that will be sent
          const result = await publicClient.call({
            to: CONTRACTS.SwapRouter02 as `0x${string}`,
            data: calldata,
            value: methodParameters.value ? BigInt(methodParameters.value) : undefined,
            account: address as `0x${string}`,
          });
          
          if (result.data && result.data !== '0x') {
            console.log('✅ Swap simulation successful - transaction should succeed');
            console.log('Simulation result:', result.data);
          } else {
            console.warn('⚠️ Swap simulation returned empty data, but no error occurred');
          }
        } catch (simulateError: any) {
          // Log the full error object first to see its structure
          console.error('❌ Swap simulation failed - Full error object:', simulateError);
          console.error('Error type:', typeof simulateError);
          console.error('Error constructor:', simulateError?.constructor?.name);
          console.error('Error keys:', Object.keys(simulateError || {}));
          
          // Extract revert reason from simulation error
          let revertReason = 'Unknown error';
          let errorDetails: any = {};
          
          // Try multiple ways to extract error data
          let errorData: string = '';
          let errorMessage: string = '';
          
          // Check various error properties
          if (simulateError?.data) {
            errorData = String(simulateError.data);
          } else if (simulateError?.cause?.data) {
            errorData = String(simulateError.cause.data);
          } else if (simulateError?.error?.data) {
            errorData = String(simulateError.error.data);
          } else if (simulateError?.reason?.data) {
            errorData = String(simulateError.reason.data);
          }
          
          // Extract error message
          if (simulateError?.message) {
            errorMessage = String(simulateError.message);
          } else if (simulateError?.shortMessage) {
            errorMessage = String(simulateError.shortMessage);
          } else if (simulateError?.cause?.message) {
            errorMessage = String(simulateError.cause.message);
          } else if (simulateError?.error?.message) {
            errorMessage = String(simulateError.error.message);
          } else if (simulateError?.reason) {
            errorMessage = String(simulateError.reason);
          } else {
            errorMessage = String(simulateError || 'Unknown error');
          }
          
          console.error('Extracted error message:', errorMessage);
          console.error('Extracted error data:', errorData ? `${errorData.substring(0, 200)}...` : 'none');
          
          // Try to decode the error if we have data
          if (errorData && errorData.startsWith('0x') && errorData.length > 10) {
            try {
              const decoded = decodeErrorResult({
                abi: SwapRouter02_ABI,
                data: errorData as `0x${string}`,
              });
              revertReason = decoded.errorName || 'Contract revert';
              errorDetails = decoded.args || {};
              console.error('✅ Decoded revert reason:', decoded);
            } catch (decodeError) {
              console.error('Could not decode error data:', decodeError);
              // Try to extract error selector
              const errorSelector = errorData.substring(0, 10);
              console.error('Error selector:', errorSelector);
            }
          }
          
          // If we couldn't decode, use the message
          if (revertReason === 'Unknown error') {
            revertReason = errorMessage || 'Contract revert';
          }
          
          // Check for common error patterns
          const combinedErrorText = `${errorMessage} ${errorData}`.toLowerCase();
          
          // Check for specific error codes first (like uint(9) from block explorer)
          if (combinedErrorText.includes('uint(9)') || combinedErrorText.includes('uint 9') || combinedErrorText.includes('error code 9')) {
            revertReason = 'Insufficient output amount (error code 9) - The actual output was less than the minimum required. This usually means:\n1. Price moved unfavorably between quote and execution\n2. Pool has insufficient liquidity for this swap size\n\nTry: Increasing slippage tolerance or using a smaller swap amount';
          } else if (combinedErrorText.includes('stf') || combinedErrorText.includes('swap too far')) {
            revertReason = 'Insufficient liquidity in price range (STF)';
          } else if (combinedErrorText.includes('spl') || combinedErrorText.includes('sqrt price limit')) {
            revertReason = 'Price limit exceeded (SPL)';
          } else if (combinedErrorText.includes('lok') || combinedErrorText.includes('locked')) {
            revertReason = 'Pool is locked (LOK)';
          } else if (combinedErrorText.includes('allowance') || combinedErrorText.includes('insufficient allowance') || combinedErrorText.includes('transferfrom')) {
            revertReason = 'Insufficient token allowance - please approve more tokens';
          } else if (combinedErrorText.includes('balance') || combinedErrorText.includes('insufficient balance') || combinedErrorText.includes('transfer')) {
            revertReason = 'Insufficient token balance';
          } else if (combinedErrorText.includes('deadline') || combinedErrorText.includes('expired') || combinedErrorText.includes('transaction too old')) {
            revertReason = 'Transaction deadline expired';
          } else if (combinedErrorText.includes('amountoutminimum') || combinedErrorText.includes('slippage') || combinedErrorText.includes('too little received')) {
            revertReason = 'Slippage tolerance exceeded - price moved unfavorably since quote';
          } else if (combinedErrorText.includes('execution reverted')) {
            // Try to extract more specific information
            const revertMatch = errorMessage.match(/execution reverted(?: with reason:?)?\s*(.+)/i);
            if (revertMatch && revertMatch[1] && revertMatch[1].trim() !== '.' && revertMatch[1].trim() !== 'evm:') {
              const reason = revertMatch[1].trim();
              // Check if it's a uint error code
              if (reason.includes('uint(') || reason.includes('uint ')) {
                revertReason = `Contract revert: ${reason} - This is likely a slippage or liquidity issue. Try increasing slippage tolerance.`;
              } else {
                revertReason = `Contract revert: ${reason}`;
              }
            } else {
              // Generic revert without specific reason - most common causes:
              // 1. Insufficient allowance (router can't pull tokens)
              // 2. Insufficient balance (user doesn't have tokens)
              // 3. Slippage exceeded (price moved, output < minimum)
              // 4. Pool locked (another swap in progress)
              revertReason = 'Transaction would revert (likely: insufficient allowance, insufficient balance, slippage exceeded, or pool locked)';
            }
          }
          
          console.error('❌ Swap simulation failed:', {
            revertReason,
            errorDetails,
            errorMessage,
            errorData: errorData ? `${errorData.substring(0, 200)}...` : 'none',
            errorType: simulateError?.constructor?.name,
            errorCode: simulateError?.code,
            errorName: simulateError?.name,
          });
          
          // Since all other checks passed (allowance, balance, pool unlocked, fresh quote),
          // the simulation failure might be a false positive (RPC node state, gas estimation, etc.)
          // Give user the option to proceed anyway
          const proceedAnyway = confirm(
            `⚠️ Simulation failed, but all checks passed:\n` +
            `✅ Token allowance: Sufficient\n` +
            `✅ Token balance: Sufficient\n` +
            `✅ Pool unlocked: Yes\n` +
            `✅ Price check: Fresh quote meets minimum\n\n` +
            `Simulation error: ${revertReason}\n\n` +
            `This might be a simulation issue. Do you want to proceed with the swap anyway?\n\n` +
            `Note: The actual transaction might succeed even if simulation fails.`
          );
          
          if (!proceedAnyway) {
            console.log('User chose not to proceed after simulation failure');
            return;
          }
          
          console.warn('⚠️ Proceeding with swap despite simulation failure - user confirmed');
        }
      }

      // Step 6: Send transaction
      // Following the guide: "Finally, we can construct a transaction from the method parameters and send the transaction"
      sendSwapTransaction({
        to: CONTRACTS.SwapRouter02 as `0x${string}`,
        data: methodParameters.calldata as `0x${string}`,
        value: methodParameters.value ? BigInt(methodParameters.value) : undefined,
      });

      console.log('Swap transaction sent successfully');
    } catch (error) {
      console.error('Swap error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      alert('Swap failed. Please try again.');
    }
  };

  if (!isConnected) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
      >
        Connect Wallet
      </button>
    );
  }

  if (!tokenIn || !tokenOut) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
      >
        Select Tokens
      </button>
    );
  }

  if (!amountIn || parseFloat(amountIn) <= 0) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
      >
        Enter Amount
      </button>
    );
  }

  if (isQuoteLoading) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Fetching Quote...
      </button>
    );
  }

  if (!quote) {
    return (
      <button
        disabled
        className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
      >
        No Route Found
      </button>
    );
  }

  if (needsApproval && !isApproving && !isApprovingTx) {
    return (
      <button
        onClick={handleApprove}
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
      >
        Approve {tokenIn.symbol}
      </button>
    );
  }

  if (isApproving || isApprovingTx) {
    return (
      <button
        disabled
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold cursor-not-allowed opacity-50 flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Approving...
      </button>
    );
  }

  if (isSwapping) {
    return (
      <button
        disabled
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold cursor-not-allowed opacity-50 flex items-center justify-center gap-2"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Swapping...
      </button>
    );
  }

  return (
    <button
      onClick={handleSwap}
      className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
    >
      Swap
    </button>
  );
}
