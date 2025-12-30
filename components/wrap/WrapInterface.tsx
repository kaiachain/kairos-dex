'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_WRAPPED_NATIVE_TOKEN, NATIVE_CURRENCY_SYMBOL } from '@/config/env';
import { WKAIA_ABI } from '@/abis/WKAIA';
import { parseUnits, formatUnits } from '@/lib/utils';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { Token } from '@/types/token';

export function WrapInterface() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const [isWrapping, setIsWrapping] = useState(true); // true = wrap (KAIA -> WKAIA), false = unwrap

  // Get native KAIA balance
  const { data: nativeBalance, isLoading: isLoadingNative, refetch: refetchNativeBalance } = useBalance({
    address,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Get WKAIA token object
  const wkaiaToken: Token = {
    address: CONTRACT_WRAPPED_NATIVE_TOKEN,
    symbol: `W${NATIVE_CURRENCY_SYMBOL}`,
    name: `Wrapped ${NATIVE_CURRENCY_SYMBOL}`,
    decimals: 18,
  };

  // Get WKAIA balance
  const { data: wkaiaBalance, isLoading: isLoadingWkaia, refetch: refetchWkaiaBalance } = useTokenBalance(wkaiaToken);

  // Wrap transaction
  const { writeContract: wrap, data: wrapHash, error: wrapError } = useWriteContract();
  const { isLoading: isWrappingTx, isSuccess: isWrapSuccess } = useWaitForTransactionReceipt({
    hash: wrapHash,
  });

  // Unwrap transaction
  const { writeContract: unwrap, data: unwrapHash, error: unwrapError } = useWriteContract();
  const { isLoading: isUnwrappingTx, isSuccess: isUnwrapSuccess } = useWaitForTransactionReceipt({
    hash: unwrapHash,
  });

  const handleMax = () => {
    if (isWrapping && nativeBalance) {
      // Leave some for gas (0.01 KAIA)
      const maxAmount = parseFloat(nativeBalance.formatted) - 0.01;
      if (maxAmount > 0) {
        setAmount(maxAmount.toString());
      } else {
        setAmount(nativeBalance.formatted);
      }
    } else if (!isWrapping && wkaiaBalance) {
      setAmount(wkaiaBalance);
    }
  };

  const handleWrap = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (!isConnected || !address) return;

    try {
      const amountWei = parseUnits(amount, 18);
      wrap({
        address: CONTRACT_WRAPPED_NATIVE_TOKEN as `0x${string}`,
        abi: WKAIA_ABI,
        functionName: 'deposit',
        value: amountWei,
      });
    } catch (error) {
      console.error('Wrap error:', error);
    }
  };

  const handleUnwrap = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (!isConnected || !address) return;

    try {
      const amountWei = parseUnits(amount, 18);
      unwrap({
        address: CONTRACT_WRAPPED_NATIVE_TOKEN as `0x${string}`,
        abi: WKAIA_ABI,
        functionName: 'withdraw',
        args: [amountWei],
      });
    } catch (error) {
      console.error('Unwrap error:', error);
    }
  };

  const handleToggle = () => {
    setIsWrapping(!isWrapping);
    setAmount('');
  };

  // Reset amount and refetch balances on success
  useEffect(() => {
    if (isWrapSuccess || isUnwrapSuccess) {
      // Refetch both balances after transaction is confirmed
      refetchNativeBalance();
      refetchWkaiaBalance();
      
      // Clear amount after showing success message
      const timer = setTimeout(() => setAmount(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [isWrapSuccess, isUnwrapSuccess, refetchNativeBalance, refetchWkaiaBalance]);

  const isLoading = isWrappingTx || isUnwrappingTx;
  const currentBalance = isWrapping ? nativeBalance?.formatted : wkaiaBalance;
  const isLoadingBalance = isWrapping ? isLoadingNative : isLoadingWkaia;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Wrap / Unwrap</h2>
        <button
          onClick={handleToggle}
          className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {isWrapping ? 'Switch to Unwrap' : 'Switch to Wrap'}
        </button>
      </div>

      <div className="space-y-4">
        {/* From Token */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              {isWrapping ? 'From' : 'From'}
            </label>
            {currentBalance && (
              <button
                onClick={handleMax}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Balance: {isLoadingBalance ? '...' : currentBalance}
              </button>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full text-2xl font-semibold bg-transparent border-none outline-none"
                disabled={!isConnected}
              />
            </div>
            <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-lg font-medium">
                {isWrapping ? NATIVE_CURRENCY_SYMBOL : `W${NATIVE_CURRENCY_SYMBOL}`}
              </span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* To Token */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">To</label>
            {!isWrapping && nativeBalance && (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Balance: {nativeBalance.formatted}
              </span>
            )}
            {isWrapping && wkaiaBalance && (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Balance: {wkaiaBalance}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={amount}
                placeholder="0.0"
                readOnly
                className="w-full text-2xl font-semibold bg-transparent border-none outline-none text-gray-400"
              />
            </div>
            <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-lg font-medium">
                {isWrapping ? `W${NATIVE_CURRENCY_SYMBOL}` : NATIVE_CURRENCY_SYMBOL}
              </span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {isWrapping
              ? `Wrapping converts your native ${NATIVE_CURRENCY_SYMBOL} to W${NATIVE_CURRENCY_SYMBOL} (Wrapped ${NATIVE_CURRENCY_SYMBOL}) tokens, which can be used in Uniswap V3 pools and swaps.`
              : `Unwrapping converts your W${NATIVE_CURRENCY_SYMBOL} tokens back to native ${NATIVE_CURRENCY_SYMBOL}.`}
          </p>
        </div>

        {/* Action Button */}
        {!isConnected ? (
          <button
            disabled
            className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
          >
            Connect Wallet
          </button>
        ) : !amount || parseFloat(amount) <= 0 ? (
          <button
            disabled
            className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
          >
            Enter Amount
          </button>
        ) : isWrapping && nativeBalance && parseFloat(amount) > parseFloat(nativeBalance.formatted) ? (
          <button
            disabled
            className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
          >
            Insufficient Balance
          </button>
        ) : !isWrapping && wkaiaBalance && parseFloat(amount) > parseFloat(wkaiaBalance) ? (
          <button
            disabled
            className="w-full py-4 bg-gray-300 dark:bg-gray-700 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
          >
            Insufficient Balance
          </button>
        ) : isLoading ? (
          <button
            disabled
            className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold cursor-not-allowed opacity-50"
          >
            {isWrapping ? 'Wrapping...' : 'Unwrapping...'}
          </button>
        ) : (
          <button
            onClick={isWrapping ? handleWrap : handleUnwrap}
            className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            {isWrapping ? `Wrap ${NATIVE_CURRENCY_SYMBOL}` : `Unwrap W${NATIVE_CURRENCY_SYMBOL}`}
          </button>
        )}

        {/* Error Messages */}
        {wrapError && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">
              Error: {wrapError.message || 'Failed to wrap tokens'}
            </p>
          </div>
        )}
        {unwrapError && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">
              Error: {unwrapError.message || 'Failed to unwrap tokens'}
            </p>
          </div>
        )}

        {/* Success Messages */}
        {isWrapSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-200">
              Successfully wrapped {amount} {NATIVE_CURRENCY_SYMBOL} to W{NATIVE_CURRENCY_SYMBOL}!
            </p>
          </div>
        )}
        {isUnwrapSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-200">
              Successfully unwrapped {amount} W{NATIVE_CURRENCY_SYMBOL} to {NATIVE_CURRENCY_SYMBOL}!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

