// Ensure Object and other globals are available first
if (typeof window !== 'undefined') {
  // Ensure globalThis exists
  if (typeof globalThis === 'undefined') {
    (window as any).globalThis = window;
  }
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
// Import polyfills in correct order - stream first, then CommonJS
import '@/lib/stream-polyfill-init';
import '@/lib/commonjs-polyfill';
// Import config to verify env vars are loaded (helps debug production build issues)
import { CHAIN_ID } from '@/config/env';

// Diagnostic: Log CHAIN_ID on startup to verify env vars are loaded correctly
// This helps debug production build issues where env vars might not be set
if (typeof window !== 'undefined') {
  console.log('[App Startup] CHAIN_ID:', CHAIN_ID, 'Type:', typeof CHAIN_ID, 'Is Valid:', typeof CHAIN_ID === 'number' && !isNaN(CHAIN_ID) && CHAIN_ID > 0);
  if (typeof CHAIN_ID !== 'number' || isNaN(CHAIN_ID) || CHAIN_ID <= 0) {
    console.error('[App Startup] WARNING: Invalid CHAIN_ID detected! This may cause wrong network popup issues.');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
