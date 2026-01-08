export interface SwapQuote {
  amountOut: string;
  price: number;
  priceImpact: number;
  fee?: number;
  gasEstimate?: string;
  route?: string[];
  poolAddress?: string;
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

export interface SwapExecutionResult {
  success: boolean;
  transactionHash?: string;
  error?: Error;
}

export interface SwapValidationError {
  type: 'insufficient_balance' | 'insufficient_allowance' | 'no_route' | 'invalid_input' | 'network_error';
  message: string;
  details?: Record<string, unknown>;
}
