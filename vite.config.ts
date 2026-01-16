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
    alias: {
      '@': path.resolve(__dirname, './'),
      'brotli': path.resolve(__dirname, './lib/brotli-stub.js'),
      'brotli/compress': path.resolve(__dirname, './lib/brotli-stub.js'),
      'brotli/decompress': path.resolve(__dirname, './lib/brotli-stub.js'),
    },
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
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'wagmi-vendor': ['wagmi', 'viem'],
          'uniswap-vendor': ['@uniswap/v3-sdk', '@uniswap/sdk-core'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
