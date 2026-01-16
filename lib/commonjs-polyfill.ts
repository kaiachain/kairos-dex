/**
 * CommonJS polyfill for browser environment
 * Needed for @uniswap/smart-order-router which uses CommonJS exports
 */

// Polyfill exports and module for CommonJS modules
if (typeof window !== 'undefined') {
  // Create a global exports object if it doesn't exist
  if (typeof (globalThis as any).exports === 'undefined') {
    (globalThis as any).exports = {};
  }
  
  // Create a global module object if it doesn't exist
  if (typeof (globalThis as any).module === 'undefined') {
    (globalThis as any).module = { exports: (globalThis as any).exports };
  }
}
