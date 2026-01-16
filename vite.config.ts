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
    // Note: Vite uses import.meta.env, not process.env
    // We keep this empty object for compatibility with libraries that expect process.env
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
          // Don't split feature code - keep it in main bundle to avoid circular deps
          // Features will be code-split via dynamic imports instead
          
          // React and core libraries (must come first to avoid circular deps)
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler')
          ) {
            return 'react-vendor';
          }
          
          // React Query (depends on React)
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'react-query-vendor';
          }
          
          // Wagmi and viem (depends on React Query)
          if (id.includes('node_modules/wagmi')) {
            return 'wagmi-vendor';
          }
          if (id.includes('node_modules/viem')) {
            return 'viem-vendor';
          }
          
          // Uniswap SDK (large, standalone)
          if (id.includes('node_modules/@uniswap')) {
            return 'uniswap-vendor';
          }
          
          // Ethers (used by router, large)
          if (id.includes('node_modules/@ethersproject') || id.includes('node_modules/ethers')) {
            return 'ethers-vendor';
          }
          
          // GraphQL (standalone)
          if (id.includes('node_modules/graphql') || id.includes('node_modules/graphql-request')) {
            return 'graphql-vendor';
          }
          
          // UI libraries
          if (
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/react-toastify') ||
            id.includes('node_modules/recharts')
          ) {
            return 'ui-vendor';
          }
          
          // Utility libraries
          if (
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/tailwind-merge') ||
            id.includes('node_modules/zustand')
          ) {
            return 'utils-vendor';
          }
          
          // Other vendor libraries (catch-all, but smaller now)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
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
