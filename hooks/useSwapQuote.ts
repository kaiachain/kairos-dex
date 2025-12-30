import { useState, useEffect } from 'react';
import { Token } from '@/types/token';
import { SwapQuote } from '@/types/swap';
import { CONTRACTS } from '@/config/contracts';
import { useReadContract } from 'wagmi';
import { QuoterV2_ABI } from '@/abis/QuoterV2';
import { parseUnits, formatUnits, calculatePriceImpact } from '@/lib/utils';

export function useSwapQuote(
  tokenIn: Token | null,
  tokenOut: Token | null,
  amountIn: string
) {
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const amountInWei = tokenIn && amountIn
    ? parseUnits(amountIn, tokenIn.decimals)
    : BigInt(0);

  // Call QuoterV2 to get quote
  const { data: quoteData, isLoading: isQuoteLoading } = useReadContract({
    address: CONTRACTS.QuoterV2 as `0x${string}`,
    abi: QuoterV2_ABI,
    functionName: 'quoteExactInputSingle',
    args:
      tokenIn && tokenOut && amountInWei > 0
        ? [
            {
              token: tokenIn.address as `0x${string}`,
              fee: 3000, // Default fee tier
              amountIn: amountInWei,
              sqrtPriceLimitX96: BigInt(0),
            },
            tokenOut.address as `0x${string}`,
          ]
        : undefined,
    query: {
      enabled: !!tokenIn && !!tokenOut && !!amountIn && parseFloat(amountIn) > 0,
    },
  });

  useEffect(() => {
    if (isQuoteLoading) {
      setIsLoading(true);
      return;
    }

    if (quoteData && tokenIn && tokenOut) {
      const result = quoteData as any;
      const amountOut = result.amountOut || BigInt(0);
      const amountOutFormatted = formatUnits(amountOut, tokenOut.decimals);
      const price = parseFloat(amountOutFormatted) / parseFloat(amountIn);
      
      // Calculate price impact (simplified)
      const priceImpact = calculatePriceImpact(
        amountInWei,
        amountOut,
        BigInt(Math.floor(price * 10 ** 18))
      );

      setQuote({
        amountOut: amountOutFormatted,
        price,
        priceImpact,
        fee: 3000,
        gasEstimate: '150000', // Estimated gas
      });
      setIsLoading(false);
    } else {
      setQuote(null);
      setIsLoading(false);
    }
  }, [quoteData, tokenIn, tokenOut, amountIn, amountInWei, isQuoteLoading]);

  return { data: quote, isLoading };
}

