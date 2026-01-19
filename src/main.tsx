import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
// Import CommonJS polyfill before any router imports
import '@/lib/commonjs-polyfill';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
