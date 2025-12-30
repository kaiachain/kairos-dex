'use client';

import { useState, useEffect } from 'react';

export function SettingsPanel() {
  const [slippage, setSlippage] = useState(0.5);
  const [deadline, setDeadline] = useState(20);
  const [expertMode, setExpertMode] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Load settings from localStorage
    const savedSlippage = localStorage.getItem('slippage');
    const savedDeadline = localStorage.getItem('deadline');
    const savedExpertMode = localStorage.getItem('expertMode');
    const savedTheme = localStorage.getItem('theme');

    if (savedSlippage) setSlippage(parseFloat(savedSlippage));
    if (savedDeadline) setDeadline(parseInt(savedDeadline));
    if (savedExpertMode) setExpertMode(savedExpertMode === 'true');
    if (savedTheme) setTheme(savedTheme as 'light' | 'dark');
  }, []);

  const saveSettings = () => {
    localStorage.setItem('slippage', slippage.toString());
    localStorage.setItem('deadline', deadline.toString());
    localStorage.setItem('expertMode', expertMode.toString());
    localStorage.setItem('theme', theme);
    alert('Settings saved!');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Transaction Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Default Slippage Tolerance (%)
            </label>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
              min="0"
              max="50"
              step="0.1"
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Transaction Deadline (minutes)
            </label>
            <input
              type="number"
              value={deadline}
              onChange={(e) => setDeadline(parseInt(e.target.value) || 20)}
              min="1"
              max="60"
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Expert Mode</label>
              <p className="text-xs text-gray-500">
                Bypass confirmation screens and allow high slippage trades
              </p>
            </div>
            <button
              onClick={() => setExpertMode(!expertMode)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                expertMode ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  expertMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Appearance</h3>
        <div>
          <label className="block text-sm font-medium mb-2">Theme</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <button
        onClick={saveSettings}
        className="w-full py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
      >
        Save Settings
      </button>
    </div>
  );
}

