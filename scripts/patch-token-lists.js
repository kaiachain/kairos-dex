#!/usr/bin/env node

/**
 * Postinstall script to patch @uniswap/smart-order-router
 * This patches files to handle missing chain-specific tokens for KAIA chain
 */

const fs = require('fs');
const path = require('path');

// Files to patch
const filesToPatch = [
  {
    path: 'node_modules/@uniswap/smart-order-router/build/module/routers/alpha-router/functions/get-candidate-pools.js',
    patch: (content) => {
      // Patch the import to handle undefined tokens
      if (content.includes('DAI_OPTIMISM_SEPOLIA') && !content.includes('// PATCHED')) {
        // Replace the import statement to handle undefined values
        // Change: import { DAI_OPTIMISM_SEPOLIA, ... } from '../../../providers';
        // To: import * as providers from '../../../providers'; const DAI_OPTIMISM_SEPOLIA = providers.DAI_OPTIMISM_SEPOLIA;
        const importPattern = /import\s*\{\s*DAI_OPTIMISM_SEPOLIA,\s*isPoolFeeDynamic,\s*USDC_ARBITRUM_SEPOLIA,\s*USDC_OPTIMISM_SEPOLIA,\s*USDT_OPTIMISM_SEPOLIA,\s*WBTC_OPTIMISM_SEPOLIA,\s*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/providers['"];/;
        
        if (importPattern.test(content)) {
          // For KAIA chain, these tokens don't exist, so we define them as undefined directly
          // This avoids the providers module import which fails due to token-lists issues
          content = content.replace(importPattern, `// PATCHED: Direct undefined definitions for KAIA chain
// These tokens don't exist for KAIA, so we define them as undefined to avoid import failures
const DAI_OPTIMISM_SEPOLIA = undefined;
const isPoolFeeDynamic = (() => false); // Default function that returns false
const USDC_ARBITRUM_SEPOLIA = undefined;
const USDC_OPTIMISM_SEPOLIA = undefined;
const USDT_OPTIMISM_SEPOLIA = undefined;
const WBTC_OPTIMISM_SEPOLIA = undefined;`);
        }
        
        // Replace the entire array with a safe version
        const safePattern = /\[ChainId\.OPTIMISM_SEPOLIA\]:\s*\[[\s\S]*?DAI_OPTIMISM_SEPOLIA[\s\S]*?\],/;
        const safeReplacement = `[ChainId.OPTIMISM_SEPOLIA]: [
        // PATCHED: Safe token list for KAIA chain
        ...(DAI_OPTIMISM_SEPOLIA ? [DAI_OPTIMISM_SEPOLIA] : []),
        ...(USDC_OPTIMISM_SEPOLIA ? [USDC_OPTIMISM_SEPOLIA] : []),
        ...(USDT_OPTIMISM_SEPOLIA ? [USDT_OPTIMISM_SEPOLIA] : []),
        ...(WBTC_OPTIMISM_SEPOLIA ? [WBTC_OPTIMISM_SEPOLIA] : []),
    ],`;
        
        let patched = content.replace(safePattern, safeReplacement);
        
        // Also add a comment at the top if not already there
        if (!patched.includes('// PATCHED for KAIA chain')) {
          patched = '// PATCHED for KAIA chain - handles undefined tokens\n' + patched;
        }
        
        return patched;
      }
      return content;
    }
  },
  {
    path: 'node_modules/@uniswap/smart-order-router/build/main/routers/alpha-router/functions/get-candidate-pools.js',
    patch: (content) => {
      // Same patch for main build path
      if (content.includes('DAI_OPTIMISM_SEPOLIA') && !content.includes('// PATCHED')) {
        const importPattern = /import\s*\{\s*DAI_OPTIMISM_SEPOLIA,\s*isPoolFeeDynamic,\s*USDC_ARBITRUM_SEPOLIA,\s*USDC_OPTIMISM_SEPOLIA,\s*USDT_OPTIMISM_SEPOLIA,\s*WBTC_OPTIMISM_SEPOLIA,\s*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/providers['"];/;
        
        if (importPattern.test(content)) {
          content = content.replace(importPattern, `// PATCHED: Safe import for KAIA chain
import * as _providers from '../../../providers';
const DAI_OPTIMISM_SEPOLIA = _providers.DAI_OPTIMISM_SEPOLIA;
const isPoolFeeDynamic = _providers.isPoolFeeDynamic;
const USDC_ARBITRUM_SEPOLIA = _providers.USDC_ARBITRUM_SEPOLIA;
const USDC_OPTIMISM_SEPOLIA = _providers.USDC_OPTIMISM_SEPOLIA;
const USDT_OPTIMISM_SEPOLIA = _providers.USDT_OPTIMISM_SEPOLIA;
const WBTC_OPTIMISM_SEPOLIA = _providers.WBTC_OPTIMISM_SEPOLIA;`);
        }
        
        const safePattern = /\[ChainId\.OPTIMISM_SEPOLIA\]:\s*\[[\s\S]*?DAI_OPTIMISM_SEPOLIA[\s\S]*?\],/;
        const safeReplacement = `[ChainId.OPTIMISM_SEPOLIA]: [
        // PATCHED: Safe token list for KAIA chain
        ...(DAI_OPTIMISM_SEPOLIA ? [DAI_OPTIMISM_SEPOLIA] : []),
        ...(USDC_OPTIMISM_SEPOLIA ? [USDC_OPTIMISM_SEPOLIA] : []),
        ...(USDT_OPTIMISM_SEPOLIA ? [USDT_OPTIMISM_SEPOLIA] : []),
        ...(WBTC_OPTIMISM_SEPOLIA ? [WBTC_OPTIMISM_SEPOLIA] : []),
    ],`;
        
        let patched = content.replace(safePattern, safeReplacement);
        
        if (!patched.includes('// PATCHED for KAIA chain')) {
          patched = '// PATCHED for KAIA chain - handles undefined tokens\n' + patched;
        }
        
        return patched;
      }
      return content;
    }
  },
];

function patchFile(fileConfig) {
  const fullPath = path.resolve(__dirname, '..', fileConfig.path);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${fileConfig.path}`);
    return false;
  }
  
  try {
    // Read the original file
    const originalContent = fs.readFileSync(fullPath, 'utf8');
    
    // Check if already patched
    if (originalContent.includes('// PATCHED')) {
      console.log(`✅ Already patched: ${fileConfig.path}`);
      return true;
    }
    
    // Apply patch
    const patchedContent = fileConfig.patch(originalContent);
    
    if (patchedContent === originalContent) {
      console.log(`ℹ️  No changes needed: ${fileConfig.path}`);
      return false;
    }
    
    // Backup the original file
    const backupPath = fullPath + '.backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, originalContent, 'utf8');
      console.log(`📦 Created backup: ${backupPath}`);
    }
    
    // Write the patched version
    fs.writeFileSync(fullPath, patchedContent, 'utf8');
    console.log(`✅ Patched: ${fileConfig.path}`);
    return true;
  } catch (error) {
    console.error(`❌ Error patching ${fileConfig.path}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔧 Patching @uniswap/smart-order-router for KAIA chain...\n');

let patchedCount = 0;
filesToPatch.forEach(fileConfig => {
  if (patchFile(fileConfig)) {
    patchedCount++;
  }
});

console.log(`\n✨ Patched ${patchedCount} of ${filesToPatch.length} files`);

if (patchedCount === 0 && filesToPatch.length > 0) {
  console.log('\n⚠️  No files were patched. The files may not exist or may already be patched.');
}

console.log('\n✅ Patching complete!');
