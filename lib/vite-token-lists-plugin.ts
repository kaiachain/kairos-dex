/**
 * Vite plugin to handle token list errors in production builds
 * This transforms the smart-order-router modules to handle missing token constants
 */

import type { Plugin } from 'vite';

export function tokenListsStubPlugin(): Plugin {
  const virtualRouterModuleId = 'virtual:router-main-stub';
  const resolvedVirtualRouterModuleId = '\0' + virtualRouterModuleId;

  return {
    name: 'token-lists-stub',
    enforce: 'pre', // Run before other plugins
    
    transform(code, id) {
      // Only transform smart-order-router modules during build
      if (!id.includes('@uniswap/smart-order-router')) {
        return null;
      }

      // Transform index.js files to handle errors in __exportStar calls
      // This prevents token list errors in providers from breaking the entire module
      if (
        (id.includes('@uniswap/smart-order-router/build/main/index.js') || 
         id.includes('@uniswap/smart-order-router/build/main/routers/index.js')) &&
        !id.includes('.backup')
      ) {
        // Wrap __exportStar calls in try-catch to prevent errors from breaking the module
        let transformed = code;
        
        // Replace __exportStar calls with safe versions that catch errors
        // This allows the module to continue loading even if providers export fails
        transformed = transformed.replace(
          /__exportStar\(require\(["']([^"']+)["']\),\s*exports\);/g,
          (match, modulePath) => {
            // Don't wrap if it's already wrapped
            if (match.includes('try {')) {
              return match;
            }
            return `
try {
  __exportStar(require("${modulePath}"), exports);
} catch (error) {
  // Silently continue if providers export fails (token list errors)
  // This allows routers and other exports to still work
  if (!"${modulePath}".includes('providers')) {
    console.warn('⚠️ Error exporting from ${modulePath}:', error.message);
  }
}`;
          }
        );
        
        if (transformed !== code) {
          return {
            code: transformed,
            map: null,
          };
        }
      }

      // Transform token-provider.js to make problematic tokens undefined
      if (id.includes('/providers/token-provider.js') && !id.includes('.backup')) {
        let transformed = code;
        
        // Replace token constant assignments with undefined for OPTIMISM_SEPOLIA tokens
        // Pattern: exports.DAI_OPTIMISM_SEPOLIA = new Token(...) -> exports.DAI_OPTIMISM_SEPOLIA = undefined;
        const tokenExportPattern = /exports\.(DAI_OPTIMISM_SEPOLIA|USDC_OPTIMISM_SEPOLIA|USDT_OPTIMISM_SEPOLIA|WBTC_OPTIMISM_SEPOLIA)\s*=\s*new[^;]+;/g;
        
        transformed = transformed.replace(tokenExportPattern, (match, tokenName) => {
          return `exports.${tokenName} = undefined; // Stubbed for KAIA chain`;
        });

        if (transformed !== code) {
          return {
            code: transformed,
            map: null,
          };
        }
      }

      // Transform get-candidate-pools to handle undefined tokens in arrays
      // Skip if already patched by the patch script
      if (id.includes('get-candidate-pools') && !id.includes('.backup') && !code.includes('// PATCHED: Safe token list for KAIA chain')) {
        let transformed = code;
        
        // Handle the OPTIMISM_SEPOLIA array case
        // Only match the original pattern, not already-patched code
        // Match: [sdk_core_1.ChainId.OPTIMISM_SEPOLIA]: [ providers_1.DAI_OPTIMISM_SEPOLIA, ... ]
        const optimismSepoliaPattern = /\[sdk_core_1\.ChainId\.OPTIMISM_SEPOLIA\]:\s*\[\s*providers_1\.DAI_OPTIMISM_SEPOLIA[\s\S]*?providers_1\.WBTC_OPTIMISM_SEPOLIA[\s\S]*?\],/;
        
        // Only transform if pattern matches original format (not already patched)
        if (optimismSepoliaPattern.test(code) && !code.includes('...(providers_1.DAI_OPTIMISM_SEPOLIA')) {
          transformed = code.replace(optimismSepoliaPattern, (match) => {
            // Extract tokens from the match
            const tokensMatch = match.match(/providers_1\.(\w+_OPTIMISM_SEPOLIA)/g);
            if (tokensMatch) {
              const safeList = tokensMatch
                .map((token) => {
                  return `...(providers_1.${token.replace('providers_1.', '')} ? [providers_1.${token.replace('providers_1.', '')}] : [])`;
                })
                .join(',\n        ');
              return `[sdk_core_1.ChainId.OPTIMISM_SEPOLIA]: [
        // PATCHED: Safe token list for KAIA chain - filters out undefined tokens
        ${safeList},
    ],`;
            }
            return match;
          });
        }

        if (transformed !== code) {
          return {
            code: transformed,
            map: null,
          };
        }
      }

      // Transform methodParameters.js to ensure SwapType is available
      // The router's buildSwapMethodParameters function needs SwapType.UNIVERSAL_ROUTER
      // methodParameters.js imports from ".." which is routers/index.js
      if (id.includes('/util/methodParameters.js') && !id.includes('.backup')) {
        let transformed = code;
        
        // Find where the module is imported (const __1 = require("..");)
        // This imports from routers/index.js which should export SwapType
        const moduleImportPattern = /(const\s+__\d+\s*=\s*require\(["']\.\.["']\);)/;
        
        transformed = transformed.replace(moduleImportPattern, (match, importStatement) => {
          // Extract the variable name (__1, __2, etc.)
          const varMatch = importStatement.match(/const\s+(__\d+)/);
          const varName = varMatch ? varMatch[1] : '__1';
          
          return `${importStatement}
// Ensure SwapType is available even if routers/index.js export failed
// This is critical - router's buildSwapMethodParameters needs SwapType
// The routers/index.js may fail to export SwapType due to token list errors
if (!${varName} || !${varName}.SwapType) {
  try {
    // Try to load SwapType directly from routers/router.js
    const routerModule = require("@uniswap/smart-order-router/build/main/routers/router");
    if (routerModule && routerModule.SwapType) {
      // Create or update the module object
      if (!${varName}) {
        ${varName} = {};
      }
      ${varName}.SwapType = routerModule.SwapType;
      // Also copy other exports that might be needed
      if (routerModule.SWAP_ROUTER_02_ADDRESSES) {
        ${varName}.SWAP_ROUTER_02_ADDRESSES = routerModule.SWAP_ROUTER_02_ADDRESSES;
      }
      if (routerModule.CurrencyAmount) {
        ${varName}.CurrencyAmount = routerModule.CurrencyAmount;
      }
    }
  } catch (e) {
    console.warn('Failed to load SwapType for methodParameters:', e.message);
    // Create a minimal SwapType enum as fallback
    if (!${varName}) {
      ${varName} = {};
    }
    ${varName}.SwapType = ${varName}.SwapType || {
      UNIVERSAL_ROUTER: 0,
      SWAP_ROUTER_02: 1
    };
  }
}`;
        });
        
        // Also wrap the SwapType access in buildSwapMethodParameters with a safe check
        // Pattern: swapConfig.type == __1.SwapType.UNIVERSAL_ROUTER
        // We need to ensure __1.SwapType exists before accessing .UNIVERSAL_ROUTER
        // Also handle the case where __1 itself might be undefined
        transformed = transformed.replace(
          /(swapConfig\.type\s*==\s*)(__\d+)\.SwapType\.UNIVERSAL_ROUTER/g,
          (match, prefix, varName) => {
            return `${prefix}((${varName} && ${varName}.SwapType) ? ${varName}.SwapType.UNIVERSAL_ROUTER : 0)`;
          }
        );
        
        // Also handle SWAP_ROUTER_02 access
        transformed = transformed.replace(
          /(swapConfig\.type\s*==\s*)(__\d+)\.SwapType\.SWAP_ROUTER_02/g,
          (match, prefix, varName) => {
            return `${prefix}((${varName} && ${varName}.SwapType) ? ${varName}.SwapType.SWAP_ROUTER_02 : 1)`;
          }
        );
        
        // Also handle the else if case
        transformed = transformed.replace(
          /(else\s+if\s*\(\s*swapConfig\.type\s*==\s*)(__\d+)\.SwapType\.SWAP_ROUTER_02/g,
          (match, prefix, varName) => {
            return `${prefix}((${varName} && ${varName}.SwapType) ? ${varName}.SwapType.SWAP_ROUTER_02 : 1)`;
          }
        );

        if (transformed !== code) {
          return {
            code: transformed,
            map: null,
          };
        }
      }

      return null;
    },
  };
}
