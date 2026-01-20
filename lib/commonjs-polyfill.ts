/**
 * CommonJS polyfill for browser environment
 * Needed for @uniswap/smart-order-router which uses CommonJS exports and require()
 */

// Ensure Object is available before using it
if (typeof Object === 'undefined') {
  throw new Error('Object is not available - this should never happen in a browser environment');
}

// Polyfill exports, module, and require for CommonJS modules
if (typeof window !== 'undefined') {
  // Ensure globalThis is available
  if (typeof globalThis === 'undefined') {
    (window as any).globalThis = window;
  }
  
  // Create a global exports object if it doesn't exist
  if (typeof (globalThis as any).exports === 'undefined') {
    (globalThis as any).exports = {};
  }
  
  // Create a global module object if it doesn't exist
  if (typeof (globalThis as any).module === 'undefined') {
    (globalThis as any).module = { exports: (globalThis as any).exports };
  }
  
  // Polyfill require() function for CommonJS modules
  // This is needed because @uniswap/smart-order-router uses require() internally
  // Vite should transform CommonJS to ESM, but some packages have require() in their built output
  if (typeof (globalThis as any).require === 'undefined') {
    // Module cache for require polyfill
    const requireCache: Record<string, any> = {};
    
    // Create a require polyfill that uses dynamic imports
    // This is a simplified version that handles the most common cases
    (globalThis as any).require = function require(moduleName: string): any {
      // Check cache first
      if (requireCache[moduleName]) {
        return requireCache[moduleName];
      }
      
      // Handle relative imports (these should be transformed by Vite, but just in case)
      if (moduleName.startsWith('.')) {
        console.warn(
          `require("${moduleName}") called with relative path. ` +
          `This should be transformed by Vite. Falling back to error.`
        );
        throw new Error(
          `require() with relative paths is not supported. ` +
          `Module "${moduleName}" should use ES module imports.`
        );
      }
      
      // For node_modules, we can't easily polyfill at runtime
      // The best we can do is provide a helpful error and suggest the module be included in optimizeDeps
      console.error(
        `require("${moduleName}") called but not polyfilled. ` +
        `This module should be transformed by Vite's CommonJS plugin. ` +
        `If you see this error, the module "${moduleName}" may need to be included in optimizeDeps.`
      );
      
      throw new Error(
        `require("${moduleName}") is not available in browser. ` +
        `The module "${moduleName}" needs to be transformed by Vite. ` +
        `This error is from @uniswap/smart-order-router which uses CommonJS internally. ` +
        `Please check vite.config.ts optimizeDeps configuration.`
      );
    };
    
    // Also set require on window for compatibility
    (window as any).require = (globalThis as any).require;
  }
}
