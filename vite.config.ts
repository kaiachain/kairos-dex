import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

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
      // Include polyfills for CommonJS support
      protocolImports: true,
      // Exclude modules that don't need polyfills
      exclude: ['fs', 'net', 'tls'],
    }),
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
    include: [
      '@uniswap/v3-sdk',
      '@uniswap/sdk-core',
      // Include router to pre-bundle and convert CommonJS to ESM
      '@uniswap/smart-order-router',
      '@uniswap/smart-order-router/build/main',
    ],
    exclude: [
      'brotli',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      // Enable tree-shaking in optimizeDeps
      treeShaking: true,
    },
    // Force re-optimization if needed
    force: false,
  },
  build: {
    // Use esbuild for faster builds (default, faster than terser)
    // For better minification, can switch to 'terser' but requires terser package
    minify: 'esbuild',
    // Aggressive minification options
    target: 'es2015', // Target modern browsers for smaller bundles
    // Disable sourcemaps for production to reduce bundle size
    sourcemap: false,
    // Report compressed size (can disable to speed up builds)
    reportCompressedSize: true,
    // Aggressive tree-shaking
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        manualChunks: (id) => {
          // Only chunk node_modules, skip source files
          if (!id.includes('node_modules')) {
            return;
          }
          
          // React and core libraries (must come first to avoid circular deps)
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          
          // React Query (depends on React)
          if (id.includes('node_modules/@tanstack/react-query/')) {
            return 'react-query-vendor';
          }
          
          // Wagmi (depends on React Query) - check before viem to avoid cycles
          if (id.includes('node_modules/wagmi/') && !id.includes('node_modules/wagmi/node_modules')) {
            return 'wagmi-vendor';
          }
          
          // Viem (separate from wagmi to avoid circular deps)
          if (id.includes('node_modules/viem/') && !id.includes('node_modules/viem/node_modules')) {
            return 'viem-vendor';
          }
          
          // Wallet libraries (large, can be lazy-loaded)
          if (
            id.includes('node_modules/@coinbase/') ||
            id.includes('node_modules/@walletconnect/') ||
            id.includes('node_modules/@web3modal/')
          ) {
            return 'wallet-vendor';
          }
          
          // Wagmi connectors and core (separate from main wagmi)
          if (
            id.includes('node_modules/@wagmi/core/') ||
            id.includes('node_modules/@wagmi/connectors/')
          ) {
            return 'wagmi-connectors-vendor';
          }
          
          // Uniswap SDK (large, standalone)
          if (id.includes('node_modules/@uniswap/')) {
            return 'uniswap-vendor';
          }
          
          // Ethers (used by router, large)
          if (
            id.includes('node_modules/@ethersproject/') ||
            (id.includes('node_modules/ethers/') && !id.includes('node_modules/ethers/node_modules'))
          ) {
            return 'ethers-vendor';
          }
          
          // GraphQL (standalone)
          if (
            id.includes('node_modules/graphql/') ||
            id.includes('node_modules/graphql-request/')
          ) {
            return 'graphql-vendor';
          }
          
          // Crypto/encoding libraries
          if (
            id.includes('node_modules/jsbi/') ||
            id.includes('node_modules/base64-') ||
            id.includes('node_modules/@noble/')
          ) {
            return 'crypto-vendor';
          }
          
          // Node polyfills (vm-browserify, buffer, stream, util)
          if (
            id.includes('node_modules/vm-browserify/') ||
            id.includes('node_modules/buffer/') ||
            id.includes('node_modules/stream-') ||
            id.includes('node_modules/util/') ||
            id.includes('node_modules/process/')
          ) {
            return 'polyfills-vendor';
          }
          
          // UI libraries
          if (
            id.includes('node_modules/lucide-react/') ||
            id.includes('node_modules/react-toastify/') ||
            id.includes('node_modules/recharts/')
          ) {
            return 'ui-vendor';
          }
          
          // Utility libraries (small, commonly used)
          if (
            id.includes('node_modules/clsx/') ||
            id.includes('node_modules/tailwind-merge/') ||
            id.includes('node_modules/zustand/')
          ) {
            return 'utils-vendor';
          }
          
          // Shared/common dependencies that might cause circular deps
          // Put these in a separate chunk to break cycles
          if (
            id.includes('node_modules/ox/') ||
            id.includes('node_modules/abitype/')
          ) {
            return 'shared-vendor';
          }
          
          // Other vendor libraries (catch-all, but smaller now)
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
