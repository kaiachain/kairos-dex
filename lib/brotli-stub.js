/**
 * Browser stub for brotli compression
 * Provides no-op implementations to prevent "Browser is not defined" errors
 * The Smart Order Router uses brotli for compression, but it's optional
 */

// Stub for brotli module - returns data as-is (no compression)
// This is a no-op that just returns the input unchanged
const noop = (data) => {
  if (data && typeof data === 'object' && data.buffer) {
    // Handle Buffer/Uint8Array
    return data;
  }
  return data;
};

const stub = {
  compress: noop,
  decompress: noop,
  compressSync: noop,
  decompressSync: noop,
};

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = stub;
  module.exports.default = stub;
}

// ES module export
export default stub;
export const compress = noop;
export const decompress = noop;
export const compressSync = noop;
export const decompressSync = noop;

