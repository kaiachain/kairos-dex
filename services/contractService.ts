/**
 * Contract Service
 * Encapsulates contract interaction patterns
 */

import { Address, encodeFunctionData } from 'viem';
import { CONTRACTS } from '@/config/contracts';
import { PositionManager_ABI } from '@/abis/PositionManager';
import { erc20Abi } from 'viem';
import { parseUnits } from '@/lib/validators';
import { Token } from '@/types/token';

export interface ApprovalRequest {
  token: Token;
  amount: string;
  spender: Address;
}

export interface AddLiquidityRequest {
  token0: Token;
  token1: Token;
  amount0: string;
  amount1: string;
  tickLower: number;
  tickUpper: number;
  fee: number;
  deadline: number;
  recipient: Address;
}

/**
 * Encode approval transaction data
 */
export function encodeApproval(request: ApprovalRequest): string {
  const approveAmount = parseUnits(request.amount, request.token.decimals);
  // Add 1% buffer for safety
  const buffer = approveAmount > BigInt(10 ** 18) 
    ? approveAmount / BigInt(100) 
    : BigInt(10 ** 18);
  const finalAmount = approveAmount + buffer;

  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [request.spender, finalAmount],
  });
}

/**
 * Encode add liquidity transaction data
 */
export function encodeAddLiquidity(request: AddLiquidityRequest): string {
  // Sort tokens by address (Uniswap V3 requirement)
  const isToken0First = request.token0.address.toLowerCase() < request.token1.address.toLowerCase();
  const t0 = isToken0First ? request.token0 : request.token1;
  const t1 = isToken0First ? request.token1 : request.token0;
  const amt0 = isToken0First ? request.amount0 : request.amount1;
  const amt1 = isToken0First ? request.amount1 : request.amount0;

  const amount0Desired = parseUnits(amt0, t0.decimals);
  const amount1Desired = parseUnits(amt1, t1.decimals);
  const amount0Min = amount0Desired - (amount0Desired * BigInt(5)) / BigInt(1000); // 0.5% slippage
  const amount1Min = amount1Desired - (amount1Desired * BigInt(5)) / BigInt(1000); // 0.5% slippage
  const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + request.deadline * 60);

  return encodeFunctionData({
    abi: PositionManager_ABI,
    functionName: 'mint',
    args: [
      {
        token0: t0.address.toLowerCase() as Address,
        token1: t1.address.toLowerCase() as Address,
        fee: request.fee,
        tickLower: request.tickLower,
        tickUpper: request.tickUpper,
        amount0Desired,
        amount1Desired,
          amount0Min,
          amount1Min,
          recipient: request.recipient,
          deadline: deadlineTimestamp,
      },
    ],
  });
}
