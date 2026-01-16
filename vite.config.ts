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
      // Legacy aliases for backward compatibility
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
    'process.env': {},
    global: 'globalThis',
    'Browser': 'undefined',
  },
  optimizeDeps: {
    include: [
      '@uniswap/v3-sdk',
      '@uniswap/sdk-core',
    ],
    exclude: ['brotli'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /@uniswap\/smart-order-router/],
      transformMixedEsModules: true,
      strictRequires: true,
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React and core libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          // Wagmi and viem
          if (id.includes('node_modules/wagmi') || id.includes('node_modules/viem')) {
            return 'wagmi-vendor';
          }
          // Uniswap SDK
          if (id.includes('node_modules/@uniswap')) {
            return 'uniswap-vendor';
          }
          // Ethers (used by router)
          if (id.includes('node_modules/@ethersproject') || id.includes('node_modules/ethers')) {
            return 'ethers-vendor';
          }
          // GraphQL
          if (id.includes('node_modules/graphql') || id.includes('node_modules/graphql-request')) {
            return 'graphql-vendor';
          }
          // Feature-based code splitting
          if (id.includes('/src/features/swap/')) {
            return 'swap-feature';
          }
          if (id.includes('/src/features/pools/')) {
            return 'pools-feature';
          }
          if (id.includes('/src/features/positions/')) {
            return 'positions-feature';
          }
          if (id.includes('/src/features/liquidity/')) {
            return 'liquidity-feature';
          }
          // Other vendor libraries
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
