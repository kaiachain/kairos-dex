import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { tokenListsStubPlugin } from './lib/vite-token-lists-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills for Node.js modules
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Explicitly include stream polyfills
      include: ['stream', 'stream-browserify', 'readable-stream'],
      // Include polyfills for CommonJS support
      protocolImports: true,
      // Exclude modules that don't need polyfills
      exclude: ['fs', 'net', 'tls'],
    }),
    tokenListsStubPlugin(),
  ],
  resolve: {
    alias: [
      // Specific aliases must come first (longest match)
      { find: '@/features', replacement: path.resolve(__dirname, './src/features') },
      { find: '@/shared', replacement: path.resolve(__dirname, './src/shared') },
      { find: '@/app', replacement: path.resolve(__dirname, './src/app') },
      // General alias for root (must come last)
      { find: '@', replacement: path.resolve(__dirname, './') },
      { find: '@/lib', replacement: path.resolve(__dirname, './lib') },
      { find: '@/config', replacement: path.resolve(__dirname, './config') },
      { find: '@/abis', replacement: path.resolve(__dirname, './abis') },
      { find: '@/types', replacement: path.resolve(__dirname, './types') },
      { find: '@/components', replacement: path.resolve(__dirname, './components') },
      { find: '@/hooks', replacement: path.resolve(__dirname, './hooks') },
      { find: '@/contexts', replacement: path.resolve(__dirname, './contexts') },
      { find: '@/services', replacement: path.resolve(__dirname, './services') },
      // Brotli stubs
      { find: 'brotli', replacement: path.resolve(__dirname, './lib/brotli-stub.js') },
      { find: 'brotli/compress', replacement: path.resolve(__dirname, './lib/brotli-stub.js') },
      { find: 'brotli/decompress', replacement: path.resolve(__dirname, './lib/brotli-stub.js') },
    ],
  },
  define: {
    // Note: Vite uses import.meta.env, not process.env
    'process.env': {},
    global: 'globalThis',
    'Browser': 'undefined',
  },
  optimizeDeps: {
    // Include CommonJS modules in optimizeDeps to handle CommonJS properly
    // These need to be pre-bundled with proper CommonJS interop
    // Common crypto/hash/blockchain libraries used by @ethersproject and @uniswap
    include: [
      'bn.js',
      'bignumber.js',
      'js-sha3',
      'hash.js',
      'bech32',
      'toformat',
      // Include @uniswap/smart-order-router to transform CommonJS require() calls
      // This ensures require() is transformed to ESM imports
      '@uniswap/smart-order-router',
      '@uniswap/smart-order-router/build/main',
    ],
    exclude: [
      'brotli',
      // Exclude other @ethersproject and @uniswap packages from pre-bundling
      // Let them be bundled normally during build to avoid TDZ issues
      // Note: @uniswap/smart-order-router is now included above to fix require() errors
      '@ethersproject/providers',
      '@ethersproject/address',
      '@ethersproject/contracts',
      '@uniswap/v3-sdk',
      '@uniswap/sdk-core',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      // Disable tree-shaking in optimizeDeps to avoid TDZ issues
      treeShaking: false,
      // Ensure proper initialization order
      keepNames: true,
    },
    // Force re-optimization to rebuild deps with new settings
    // Set to false after first successful build
    force: true,
  },
  build: {
    // Completely disable minification to avoid TDZ errors
    // Minification can cause "Cannot access 'X' before initialization" errors
    // We can re-enable later once TDZ issues are fully resolved
    minify: false,
    // Minification options (disabled - minify is false)
    // esbuild: {
    //   keepNames: true,
    //   legalComments: 'none',
    //   minifyIdentifiers: false,
    //   minifySyntax: false,
    //   minifyWhitespace: false,
    // },
    // Aggressive minification options
    target: 'es2020', // Target modern browsers (ES2020 needed for BigInt literals)
    // Disable sourcemaps for production to reduce bundle size
    sourcemap: false,
    // Report compressed size (can disable to speed up builds)
    reportCompressedSize: true,
    // CommonJS options to handle circular dependencies better
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
      // Ensure proper require order to avoid TDZ issues
      strictRequires: false,
      // Handle circular dependencies - use 'namespace' for @ethersproject
      requireReturnsDefault: (id) => {
        // Use 'namespace' for @ethersproject to avoid TDZ issues
        if (id.includes('@ethersproject/')) {
          return 'namespace';
        }
        // Handle CommonJS modules that don't have default exports
        // These libraries are imported as default but are CommonJS modules
        // Common crypto/hash/blockchain libraries used by @ethersproject and @uniswap
        const commonJsCryptoModules = [
          'bn.js',
          'bignumber.js',
          'js-sha3',
          'hash.js',
          'bech32',
          'toformat',
        ];
        if (commonJsCryptoModules.some(module => id.includes(module))) {
          return 'preferred'; // This allows both default and named imports
        }
        return 'auto';
      },
      // Use default export mode for better compatibility
      defaultIsModuleExports: 'auto',
    },
    // Aggressive tree-shaking
    rollupOptions: {
      treeshake: {
        moduleSideEffects: (id) => {
          // Preserve side effects for problematic modules
          if (id.includes('@uniswap/') || id.includes('@ethersproject/')) {
            return true;
          }
          return 'no-external';
        },
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        // Don't hoist transitive imports - can cause TDZ with circular deps
        hoistTransitiveImports: false,
        // Don't preserve modules - causes too many files
        preserveModules: false,
        // Don't use compact output - can cause initialization order issues
        compact: false,
        // Use ES module format for better circular dependency handling
        format: 'es',
        // Don't preserve entry signatures - allows more flexibility in bundling
        preserveEntrySignatures: false,
        // Use 'compat' interop for better CommonJS handling, especially for bn.js
        // 'compat' ensures CommonJS modules work properly with ESM imports
        interop: 'compat',
        // Don't inline dynamic imports - let them be separate chunks
        inlineDynamicImports: false,
        // Ensure proper chunk loading order
        generatedCode: {
          // Use const/let instead of var to avoid hoisting issues
          constBindings: true,
          // Preserve object shorthand to avoid transformation issues
          objectShorthand: false,
          // Use arrow functions to avoid 'this' binding issues
          arrowFunctions: false,
        },
        manualChunks: (id) => {
          // Only chunk node_modules, skip source files
          if (!id.includes('node_modules')) {
            return;
          }
          
          // React ecosystem - inline React into main bundle
          // This ensures React is always available when other chunks load
          // React and ReactDOM are small enough to inline
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return; // Inline into main bundle - ensures React is available
          }
          
          // React ecosystem - inline React libraries that depend on React
          // This ensures they have access to the same React instance
          if (
            id.includes('node_modules/react-router/') ||
            id.includes('node_modules/@tanstack/react-query/')
          ) {
            return; // Inline into main bundle - ensures same React instance
          }
          
          // Web3 ecosystem - inline ALL web3 packages into main bundle
          // This avoids TDZ errors from chunking circular dependencies
          // Also ensures React is available when wagmi tries to use it
          if (
            id.includes('node_modules/wagmi/') ||
            id.includes('node_modules/viem/') ||
            id.includes('node_modules/@wagmi/') ||
            id.includes('node_modules/@coinbase/') ||
            id.includes('node_modules/@walletconnect/') ||
            id.includes('node_modules/@web3modal/') ||
            id.includes('node_modules/ox/') ||
            id.includes('node_modules/abitype/')
          ) {
            return; // Inline into main bundle - avoids TDZ and ensures React is available
          }
          
          // DeFi ecosystem - inline both @ethersproject and @uniswap to avoid TDZ
          // The TDZ issue is caused by chunking these packages together
          // Inlining them into the main bundle avoids the circular dependency bundling issue
          const isEthersProject = id.includes('node_modules/@ethersproject/');
          const isUniswap = id.includes('node_modules/@uniswap/');
          
          // Don't chunk either - let them be in the main bundle
          // This avoids TDZ issues from chunking circular dependencies
          if (isEthersProject || isUniswap) {
            return; // Don't chunk, goes to main bundle
          }
          
          // GraphQL (standalone, can be lazy-loaded)
          if (
            id.includes('node_modules/graphql/') ||
            id.includes('node_modules/graphql-request/')
          ) {
            return 'graphql-vendor';
          }
          
          // UI libraries - inline ALL React-dependent libraries to ensure React is available
          // All of these use React, so they need to be in the same bundle
          if (
            id.includes('node_modules/react-toastify/') ||
            id.includes('node_modules/lucide-react/') ||
            id.includes('node_modules/recharts/')
          ) {
            return; // Inline into main bundle - needs React
          }
          
          // Crypto/encoding utilities
          if (
            id.includes('node_modules/jsbi/') ||
            id.includes('node_modules/base64-') ||
            id.includes('node_modules/@noble/')
          ) {
            return 'crypto-vendor';
          }
          
          // Small utility libraries (commonly used, keep together)
          if (
            id.includes('node_modules/clsx/') ||
            id.includes('node_modules/tailwind-merge/')
          ) {
            return 'utils-vendor';
          }
          
          // Note: Polyfills are included in vendor chunk to avoid circular dependencies
          // The vite-plugin-node-polyfills handles the polyfill injection automatically
          
          // Everything else goes into vendor chunk (including polyfills)
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB to reduce noise
  },
  server: {
    port: 3000,
    open: true,
  },
});
