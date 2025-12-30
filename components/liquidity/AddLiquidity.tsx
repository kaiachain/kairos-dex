'use client';

import { useState, useMemo } from 'react';
import { TokenSelector } from '@/components/swap/TokenSelector';
import { Token } from '@/types/token';
import { PriceRangeSelector } from './PriceRangeSelector';
import { useWriteContract, useAccount } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { PositionManager_ABI } from '@/abis/PositionManager';
import { parseUnits, formatNumber } from '@/lib/utils';
import { useTokenBalance } from '@/hooks/useTokenBalance';

export function AddLiquidity() {
  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [fee, setFee] = useState(3000);
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [fullRange, setFullRange] = useState(false);

  const { address } = useAccount();
  const { writeContract: addLiquidity } = useWriteContract();

  // Get token balances
  const { data: balance0, isLoading: isLoadingBalance0 } = useTokenBalance(token0);
  const { data: balance1, isLoading: isLoadingBalance1 } = useTokenBalance(token1);

  // Validation errors
  const errors = useMemo(() => {
    const errs: { amount0?: string; amount1?: string } = {};
    
    if (token0 && amount0) {
      const amount0Num = parseFloat(amount0);
      const balance0Num = balance0 ? parseFloat(balance0) : 0;
      
      if (!isNaN(amount0Num) && !isNaN(balance0Num)) {
        if (amount0Num > balance0Num) {
          errs.amount0 = `Insufficient balance. You have ${formatNumber(balance0, 6)} ${token0.symbol}`;
        }
      }
    }
    
    if (token1 && amount1) {
      const amount1Num = parseFloat(amount1);
      const balance1Num = balance1 ? parseFloat(balance1) : 0;
      
      if (!isNaN(amount1Num) && !isNaN(balance1Num)) {
        if (amount1Num > balance1Num) {
          errs.amount1 = `Insufficient balance. You have ${formatNumber(balance1, 6)} ${token1.symbol}`;
        }
      }
    }
    
    return errs;
  }, [amount0, amount1, balance0, balance1, token0, token1]);

  const hasErrors = Object.keys(errors).length > 0;

  const handleAddLiquidity = () => {
    if (!token0 || !token1 || !amount0 || !amount1) return;

    // Implementation would calculate tick ranges and call mint function
    // This is a simplified version
    const [t0, t1] = token0.address < token1.address ? [token0, token1] : [token1, token0];
    const [amt0, amt1] = token0.address < token1.address ? [amount0, amount1] : [amount1, amount0];

    // Calculate tick range based on price range
    // This is simplified - actual implementation would use Uniswap V3 SDK
    const tickLower = fullRange ? -887272 : 0; // Simplified
    const tickUpper = fullRange ? 887272 : 0; // Simplified

    if (!address) return;

    addLiquidity({
      address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
      abi: PositionManager_ABI,
      functionName: 'mint',
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
                {isLoadingBalance0 ? (
                  'Loading...'
                ) : balance0 ? (
                  `Balance: ${formatNumber(balance0, 6)} ${token0.symbol}`
                ) : (
                  'Balance: 0'
                )}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={amount0}
                onChange={(e) => setAmount0(e.target.value)}
                placeholder="0.0"
                className={`w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg outline-none ${
                  errors.amount0 ? 'border-2 border-red-500' : 'border-none'
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
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Token 1</label>
            {token1 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isLoadingBalance1 ? (
                  'Loading...'
                ) : balance1 ? (
                  `Balance: ${formatNumber(balance1, 6)} ${token1.symbol}`
                ) : (
                  'Balance: 0'
                )}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                placeholder="0.0"
                className={`w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg outline-none ${
                  errors.amount1 ? 'border-2 border-red-500' : 'border-none'
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
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Fee Tier</label>
          <select
            value={fee}
            onChange={(e) => setFee(parseInt(e.target.value))}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none"
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

        <button
          onClick={handleAddLiquidity}
          disabled={!token0 || !token1 || !amount0 || !amount1 || hasErrors}
          className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Liquidity
        </button>
      </div>
    </div>
  );
}

