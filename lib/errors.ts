/**
 * Custom error classes for better error handling
 */

export class WalletConnectionError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'WalletConnectionError';
  }
}

export class SwapError extends Error {
  constructor(message: string, public cause?: Error, public code?: string) {
    super(message);
    this.name = 'SwapError';
  }
}

export class QuoteError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'QuoteError';
  }
}

export class ContractError extends Error {
  constructor(message: string, public cause?: Error, public code?: string) {
    super(message);
    this.name = 'ContractError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
