/**
 * Webpack loader that replaces token list modules with our stub
 * This runs at the loader level, before module evaluation
 */
const path = require('path');
const fs = require('fs');

module.exports = function(source) {
  // Get the stub path
  const stubPath = path.resolve(__dirname, 'token-lists-stub.js');
  
  // Read and return the stub code
  // This completely replaces the original module
  try {
    const stubCode = fs.readFileSync(stubPath, 'utf8');
    // Add a comment to show this was replaced
    return `/* Token list module replaced by webpack loader */\n${stubCode}`;
  } catch (error) {
    // Fallback: return a simple stub if file read fails
    console.warn('Token list loader: Could not read stub file, using fallback');
    return `module.exports = {};`;
  }
};
