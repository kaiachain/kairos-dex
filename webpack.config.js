/**
 * Webpack Configuration
 * Extracted from next.config.js for better organization
 * 
 * This configuration handles:
 * - Browser fallbacks for Node.js modules
 * - Token list stubs for @uniswap/smart-order-router
 * - Brotli compression stubs
 * - Module replacements for browser compatibility
 */

const webpack = require('webpack');
const path = require('path');

/**
 * Configure webpack for browser compatibility
 */
function configureWebpack(config, { isServer }) {
  // Base fallbacks for all environments
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    net: false,
    tls: false,
  };

  // Browser-specific configuration
  if (!isServer) {
    const tokenListStubPath = path.resolve(__dirname, 'lib/token-lists-stub.js');
    const brotliStubPath = path.resolve(__dirname, 'lib/brotli-stub.js');
    
    // Module aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
      'brotli': brotliStubPath,
      'brotli/compress': brotliStubPath,
      'brotli/decompress': brotliStubPath,
      '@uniswap/smart-order-router/build/main/util/token-lists/index': tokenListStubPath,
      '@uniswap/smart-order-router/build/module/util/token-lists/index': tokenListStubPath,
    };
    
    // Webpack plugins for module replacement
    if (!config.plugins) {
      config.plugins = [];
    }
    
    // Token list module replacements
    // These replace token list modules with stubs to avoid chain-specific token errors
    const tokenListReplacements = [
      /@uniswap\/smart-order-router\/build\/module\/util\/token-lists\/index\.js$/,
      /@uniswap\/smart-order-router\/build\/module\/util\/token-lists\/index$/,
      /@uniswap\/smart-order-router\/build\/main\/util\/token-lists\/index\.js$/,
      /@uniswap\/smart-order-router\/build\/main\/util\/token-lists\/index$/,
      /@uniswap\/smart-order-router[^/]*\/util\/token-lists\/index/,
      /smart-order-router[^/]*\/util\/token-lists\/index/,
      /@uniswap\/smart-order-router.*token-lists.*index/,
      /@uniswap\/smart-order-router.*\/util\/token-lists\/[^/]+\.js$/,
    ];
    
    tokenListReplacements.forEach((pattern) => {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(pattern, tokenListStubPath)
      );
    });
    
    // Context replacement for dynamic requires
    config.plugins.push(
      new webpack.ContextReplacementPlugin(
        /@uniswap\/smart-order-router[^/]*\/util\/token-lists/,
        tokenListStubPath
      )
    );
    
    // Custom plugin for token list interception
    config.plugins.push({
      apply: (compiler) => {
        compiler.hooks.normalModuleFactory.tap('TokenListStubPlugin', (nmf) => {
          nmf.hooks.beforeResolve.tap('TokenListStubPlugin', (data) => {
            if (!data) return;
            const request = data.request || '';
            if (request.includes('token-lists') && request.includes('smart-order-router')) {
              data.request = tokenListStubPath;
            }
          });
        });
      }
    });
    
    // Module loader rules
    if (!config.module) {
      config.module = {};
    }
    if (!config.module.rules) {
      config.module.rules = [];
    }
    
    const tokenListLoaderPath = path.resolve(__dirname, 'lib/token-lists-loader.js');
    const tokenListLoaderPatterns = [
      /node_modules\/@uniswap\/smart-order-router.*\/util\/token-lists\/index\.js$/,
      /node_modules\/@uniswap\/smart-order-router.*\/util\/token-lists\/index$/,
      /smart-order-router.*token-lists.*index/,
      /smart-order-router.*\/util\/token-lists\//,
      /@uniswap\/smart-order-router\/build\/module\/util\/token-lists\/index/,
      /@uniswap\/smart-order-router\/build\/main\/util\/token-lists\/index/,
    ];
    
    tokenListLoaderPatterns.forEach((pattern) => {
      config.module.rules.push({
        test: pattern,
        use: tokenListLoaderPath,
        enforce: 'pre'
      });
    });
  }

  // Server-specific externals
  config.externals = config.externals || [];
  if (isServer) {
    config.externals.push({
      'pino-pretty': 'commonjs pino-pretty',
    });
  }

  return config;
}

module.exports = { configureWebpack };
