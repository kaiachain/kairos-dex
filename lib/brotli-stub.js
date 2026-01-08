/**
 * Browser stub for brotli compression
 * Provides no-op implementations to prevent "Browser is not defined" errors
 * The Smart Order Router uses brotli for compression, but it's optional
 */

// Stub for brotli module - returns data as-is (no compression)
// This is a no-op that just returns the input unchanged
const noop = (data) => data;

module.exports = {
  compress: noop,
  decompress: noop,
  compressSync: noop,
  decompressSync: noop,
};

// Also export as default for ES modules
module.exports.default = module.exports;

