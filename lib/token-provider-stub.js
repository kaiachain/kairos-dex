/**
 * Stub for token-provider module
 * Exports undefined for chain-specific tokens that don't exist on KAIA
 * This prevents "Cannot read properties of undefined" errors during production builds
 */

// Export all token constants as undefined for chains we don't support
// This allows the code to run without errors when these tokens are accessed

// Optimism Sepolia tokens
exports.DAI_OPTIMISM_SEPOLIA = undefined;
exports.USDC_OPTIMISM_SEPOLIA = undefined;
exports.USDT_OPTIMISM_SEPOLIA = undefined;
exports.WBTC_OPTIMISM_SEPOLIA = undefined;

// Re-export everything else from the original module
// We'll use a dynamic import to get the original exports
// But for now, just export undefined for the problematic ones

// For ES module compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exports;
}
