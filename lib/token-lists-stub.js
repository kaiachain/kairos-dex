/**
 * Browser stub for token lists
 * Provides safe exports to prevent "Cannot read properties of undefined" errors
 * The Smart Order Router tries to access chain-specific tokens like DAI_OPTIMISM_SEPOLIA
 * that don't exist for our KAIA chain
 */

// Comprehensive list of all possible token names that might be accessed
// This includes tokens from all chains that Uniswap supports
const knownTokens = [
  // Optimism Sepolia
  'DAI_OPTIMISM_SEPOLIA',
  'USDC_OPTIMISM_SEPOLIA',
  'WETH_OPTIMISM_SEPOLIA',
  'USDT_OPTIMISM_SEPOLIA',
  // Optimism
  'DAI_OPTIMISM',
  'USDC_OPTIMISM',
  'WETH_OPTIMISM',
  'USDT_OPTIMISM',
  // Base
  'DAI_BASE',
  'USDC_BASE',
  'WETH_BASE',
  'USDT_BASE',
  // Arbitrum
  'DAI_ARBITRUM',
  'USDC_ARBITRUM',
  'WETH_ARBITRUM',
  'USDT_ARBITRUM',
  // Polygon
  'DAI_POLYGON',
  'USDC_POLYGON',
  'WETH_POLYGON',
  'USDT_POLYGON',
  // BSC
  'DAI_BSC',
  'USDC_BSC',
  'WETH_BSC',
  'USDT_BSC',
  // Avalanche
  'DAI_AVALANCHE',
  'USDC_AVALANCHE',
  'WETH_AVALANCHE',
  'USDT_AVALANCHE',
  // Celo
  'DAI_CELO',
  'USDC_CELO',
  'WETH_CELO',
  'USDT_CELO',
];

// Create a stub object that returns undefined for all token properties
// This prevents "Cannot read properties of undefined" errors
const tokenListStub = {};

// Define all known tokens as undefined getters
// Note: Cannot use writable with getter, so we only use get
knownTokens.forEach(tokenName => {
  Object.defineProperty(tokenListStub, tokenName, {
    get: () => undefined,
    enumerable: true,
    configurable: true
  });
});

// Create a safe object that returns another safe object for any property access
// This handles nested access like tokenList[chainId].DAI_OPTIMISM_SEPOLIA
function createSafeObject() {
  return new Proxy({}, {
    get: function(target, prop) {
      // Return the stub itself for any property access
      // This allows chained property access without errors
      if (prop === Symbol.toPrimitive || prop === 'valueOf' || prop === 'toString') {
        return () => '[object Object]';
      }
      return createSafeObject();
    },
    has: function() {
      return true; // Always return true so 'in' operator works
    },
    ownKeys: function() {
      return []; // Return empty array
    },
    getOwnPropertyDescriptor: function() {
      return {
        enumerable: true,
        configurable: true,
        value: createSafeObject()
      };
    }
  });
}

// Create the proxied stub first (without default property)
const proxiedStub = new Proxy(tokenListStub, {
  get: function(target, prop) {
    // If property is already defined, return it
    if (prop in target) {
      return target[prop];
    }
    // For 'default', return the stub itself (ES module support)
    if (prop === 'default') {
      return proxiedStub;
    }
    // For numeric or string keys (like chain IDs), return a safe object
    // This handles cases like tokenList[42161] or tokenList['42161']
    if (typeof prop === 'string' || typeof prop === 'number') {
      return createSafeObject();
    }
    // For Symbol properties, return undefined
    if (typeof prop === 'symbol') {
      return undefined;
    }
    // For any other property, return a safe object that won't throw errors
    return createSafeObject();
  },
  has: function(target, prop) {
    // Always return true to prevent 'in' operator errors
    return true;
  },
  ownKeys: function(target) {
    // Return all known token names plus 'default'
    return [...knownTokens, 'default'];
  },
  getOwnPropertyDescriptor: function(target, prop) {
    if (prop === 'default') {
      return {
        enumerable: true,
        configurable: true,
        get: () => proxiedStub
      };
    }
    if (prop in target) {
      return Object.getOwnPropertyDescriptor(target, prop);
    }
    // Return a descriptor for any property to prevent errors
    return {
      enumerable: true,
      configurable: true,
      value: createSafeObject()
    };
  }
});

// Now define 'default' on the target using the already-created proxiedStub
// Use defineProperty to avoid "Cannot redefine property" error
Object.defineProperty(tokenListStub, 'default', {
  enumerable: true,
  configurable: true,
  get: function() {
    return proxiedStub;
  }
});

// Export as CommonJS
module.exports = proxiedStub;
