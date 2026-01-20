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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
