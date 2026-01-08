const webpack = require('webpack');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Base fallbacks for all environments
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Ignore optional dependencies that cause issues in browser
    if (!isServer) {
      const tokenListStubPath = path.resolve(__dirname, 'lib/token-lists-stub.js');
      
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
        // Provide stub for brotli instead of ignoring it
        'brotli': path.resolve(__dirname, 'lib/brotli-stub.js'),
        'brotli/compress': path.resolve(__dirname, 'lib/brotli-stub.js'),
        'brotli/decompress': path.resolve(__dirname, 'lib/brotli-stub.js'),
        // Provide stub for token lists (alias as fallback)
        '@uniswap/smart-order-router/build/main/util/token-lists/index': tokenListStubPath,
        '@uniswap/smart-order-router/build/module/util/token-lists/index': tokenListStubPath,
      };
      
      // Use NormalModuleReplacementPlugin to replace token list modules
      // This works better than aliases for dynamic imports and handles all variations
      if (!config.plugins) {
        config.plugins = [];
      }
      
      // Replace token list index modules with our stub
      // Use aggressive patterns to catch all variations including dynamic imports
      // The "Critical dependency" warning suggests dynamic imports, so patterns must be flexible
      
      // Most specific patterns first (module path)
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /@uniswap\/smart-order-router\/build\/module\/util\/token-lists\/index\.js$/,
          tokenListStubPath
        )
      );
      
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /@uniswap\/smart-order-router\/build\/module\/util\/token-lists\/index$/,
          tokenListStubPath
        )
      );
      
      // CommonJS path (main)
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /@uniswap\/smart-order-router\/build\/main\/util\/token-lists\/index\.js$/,
          tokenListStubPath
        )
      );
      
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /@uniswap\/smart-order-router\/build\/main\/util\/token-lists\/index$/,
          tokenListStubPath
        )
      );
      
      // More general patterns to catch dynamic imports
      // Match any token-lists/index reference in the smart-order-router package
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /@uniswap\/smart-order-router[^/]*\/util\/token-lists\/index/,
          tokenListStubPath
        )
      );
      
      // Very general pattern to catch any token-lists/index reference
      // This is a fallback for any path variations we might have missed
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /smart-order-router[^/]*\/util\/token-lists\/index/,
          tokenListStubPath
        )
      );
      
      // Even more general - catch any reference to token-lists in smart-order-router
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /@uniswap\/smart-order-router.*token-lists.*index/,
          tokenListStubPath
        )
      );
      
      // Catch any .js file in token-lists directory
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /@uniswap\/smart-order-router.*\/util\/token-lists\/[^/]+\.js$/,
          tokenListStubPath
        )
      );
      
      // Add ContextReplacementPlugin to handle dynamic requires
      // This catches cases where the module path is constructed dynamically
      config.plugins.push(
        new webpack.ContextReplacementPlugin(
          /@uniswap\/smart-order-router[^/]*\/util\/token-lists/,
          tokenListStubPath
        )
      );
      
      // Add a custom plugin to intercept and replace token list modules
      // This is more aggressive and catches modules that NormalModuleReplacementPlugin might miss
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.normalModuleFactory.tap('TokenListStubPlugin', (nmf) => {
            nmf.hooks.beforeResolve.tap('TokenListStubPlugin', (data) => {
              if (!data) return;
              
              // Check if this is a token-lists module request
              const request = data.request || '';
              if (request.includes('token-lists') && request.includes('smart-order-router')) {
                // Replace with our stub
                data.request = tokenListStubPath;
              }
            });
          });
        }
      });
      
      // Add a plugin that modifies source code to handle token list errors
      // This runs during compilation and modifies the actual source
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.compilation.tap('TokenListSourcePatchPlugin', (compilation) => {
            compilation.hooks.buildModule.tap('TokenListSourcePatchPlugin', (module) => {
              // Only process modules from smart-order-router that use token lists
              if (module.resource && 
                  module.resource.includes('smart-order-router') &&
                  (module.resource.includes('get-candidate-pools') || 
                   module.resource.includes('token-lists'))) {
                
                // Intercept and modify the source
                if (module._source && module._source._value) {
                  let source = module._source._value;
                  
                  // Replace problematic property accesses with safe versions
                  // Pattern: something.DAI_OPTIMISM_SEPOLIA.property
                  source = source.replace(
                    /(\w+)\[?['"]?(\w+)['"]?\]?\.(DAI_OPTIMISM_SEPOLIA|USDC_OPTIMISM_SEPOLIA|WETH_OPTIMISM_SEPOLIA)(\.[\w]+)?/g,
                    (match, obj, key, token, prop) => {
                      // Return a safe access that won't throw
                      return `((${obj}${key ? `[${key}]` : ''} && ${obj}${key ? `[${key}]` : ''}.${token}) ? ${obj}${key ? `[${key}]` : ''}.${token}${prop || ''} : undefined)`;
                    }
                  );
                  
                  // Also handle direct property access: DAI_OPTIMISM_SEPOLIA.property
                  source = source.replace(
                    /(DAI_OPTIMISM_SEPOLIA|USDC_OPTIMISM_SEPOLIA|WETH_OPTIMISM_SEPOLIA)(\.[\w]+)?/g,
                    (match, token, prop) => {
                      // If it's not already wrapped, wrap it
                      if (!match.startsWith('(') && !match.includes('?')) {
                        return `(undefined${prop || ''})`;
                      }
                      return match;
                    }
                  );
                  
                  module._source._value = source;
                }
              }
            });
          });
        }
      });
      
      // Add a rule to replace the module at the loader level
      // This is the most reliable way to intercept modules
      const tokenListLoaderPath = path.resolve(__dirname, 'lib/token-lists-loader.js');
      
      if (!config.module) {
        config.module = {};
      }
      if (!config.module.rules) {
        config.module.rules = [];
      }
      
      // Add loader rule to replace token list modules - use multiple patterns
      // The loader must run BEFORE other loaders to replace the module
      config.module.rules.push({
        test: /node_modules\/@uniswap\/smart-order-router.*\/util\/token-lists\/index\.js$/,
        use: tokenListLoaderPath,
        enforce: 'pre'
      });
      
      config.module.rules.push({
        test: /node_modules\/@uniswap\/smart-order-router.*\/util\/token-lists\/index$/,
        use: tokenListLoaderPath,
        enforce: 'pre'
      });
      
      // Also try matching the actual file path from the error
      config.module.rules.push({
        test: /smart-order-router.*token-lists.*index/,
        use: tokenListLoaderPath,
        enforce: 'pre'
      });
      
      // Most aggressive: match any file in token-lists directory
      config.module.rules.push({
        test: /smart-order-router.*\/util\/token-lists\//,
        use: tokenListLoaderPath,
        enforce: 'pre'
      });
      
      // Also match the exact path from the error message
      config.module.rules.push({
        test: /@uniswap\/smart-order-router\/build\/module\/util\/token-lists\/index/,
        use: tokenListLoaderPath,
        enforce: 'pre'
      });
      
      config.module.rules.push({
        test: /@uniswap\/smart-order-router\/build\/main\/util\/token-lists\/index/,
        use: tokenListLoaderPath,
        enforce: 'pre'
      });
    }

    // Ignore modules that use Node.js APIs in browser
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        'pino-pretty': 'commonjs pino-pretty',
      });
    }

    return config;
  },
};

module.exports = nextConfig;

