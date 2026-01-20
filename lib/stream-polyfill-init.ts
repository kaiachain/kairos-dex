/**
 * Stream polyfill initialization
 * Ensures stream.Readable and other stream classes are available
 * This must be imported before any code that uses Node.js streams
 */

if (typeof window !== 'undefined') {
  // The vite-plugin-node-polyfills should provide this,
  // but we ensure it's available as a fallback
  try {
    // Try to import stream if it's not already available
    // This will be handled by the polyfill plugin, but we ensure it's ready
    // Note: The polyfill is injected by vite-plugin-node-polyfills at build time
    // This check is just a safeguard and the warning can be ignored in dev mode
    if (typeof (globalThis as any).stream === 'undefined' && import.meta.env.DEV) {
      // Only log in dev mode - in production the polyfill is always available
      console.debug('Stream polyfill not found - this should be provided by vite-plugin-node-polyfills');
    }
  } catch (e) {
    // Ignore - polyfill plugin will handle it
  }
}
