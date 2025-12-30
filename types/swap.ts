export interface SwapQuote {
  amountOut: string;
  price: number;
  priceImpact: number;
  fee?: number;
  gasEstimate?: string;
  route?: string[];
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  fee: number;
  recipient: string;
  deadline: number;
  amountOutMinimum: string;
}

