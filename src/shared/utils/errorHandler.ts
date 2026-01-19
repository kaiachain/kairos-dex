/**
 * Centralized Error Handling Utilities
 */

export interface AppError {
  message: string;
  code?: string;
  type: 'network' | 'contract' | 'validation' | 'quote' | 'unknown';
  cause?: Error;
  details?: Record<string, unknown>;
}

export class NetworkError extends Error implements AppError {
  type: 'network' = 'network';
  code?: string;
  cause?: Error;
  details?: Record<string, unknown>;

  constructor(message: string, cause?: Error, details?: Record<string, unknown>) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
    this.details = details;
  }
}

export class ContractError extends Error implements AppError {
  type: 'contract' = 'contract';
  code?: string;
  cause?: Error;
  details?: Record<string, unknown>;

  constructor(message: string, code?: string, cause?: Error, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
    this.cause = cause;
    this.details = details;
  }
}

export class ValidationError extends Error implements AppError {
  type: 'validation' = 'validation';
  code?: string;
  cause?: Error;
  details?: Record<string, unknown>;
  field?: string;

  constructor(message: string, field?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.details = details;
  }
}

export class QuoteError extends Error implements AppError {
  type: 'quote' = 'quote';
  code?: string;
  cause?: Error;
  details?: Record<string, unknown>;

  constructor(message: string, cause?: Error, details?: Record<string, unknown>) {
    super(message);
    this.name = 'QuoteError';
    this.cause = cause;
    this.details = details;
  }
}

/**
 * Normalize error to AppError format
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof NetworkError || 
      error instanceof ContractError || 
      error instanceof ValidationError || 
      error instanceof QuoteError) {
    return error;
  }

  if (error instanceof Error) {
    // Try to infer error type from message
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return new NetworkError(error.message, error);
    }
    if (message.includes('contract') || message.includes('revert') || message.includes('execution')) {
      return new ContractError(error.message, undefined, error);
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return new ValidationError(error.message, undefined, undefined);
    }
    if (message.includes('quote') || message.includes('route')) {
      return new QuoteError(error.message, error);
    }
    
    return {
      message: error.message,
      type: 'unknown',
      cause: error,
    };
  }

  return {
    message: String(error),
    type: 'unknown',
  };
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: AppError): string {
  switch (error.type) {
    case 'network':
      return 'Network error. Please check your connection and try again.';
    case 'contract':
      return error.message || 'Contract interaction failed. Please try again.';
    case 'validation':
      return error.message || 'Invalid input. Please check your values.';
    case 'quote':
      return 'Unable to get quote. Please try again or use different tokens.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
}

/**
 * Log error with context
 */
export function logError(error: AppError, context?: Record<string, unknown>): void {
  console.error(`[${error.type.toUpperCase()}]`, {
    message: error.message,
    code: error.code,
    details: error.details,
    context,
    cause: error.cause,
  });
}
