'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';

interface SwapSettingsProps {
  slippage: number;
  deadline: number;
  expertMode: boolean;
  onSlippageChange: (value: number) => void;
  onDeadlineChange: (value: number) => void;
  onExpertModeChange: (value: boolean) => void;
}

export function SwapSettings({
  slippage,
  deadline,
  expertMode,
  onSlippageChange,
  onDeadlineChange,
  onExpertModeChange,
}: SwapSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const slippagePresets = [0.1, 0.5, 1.0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Settings className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 p-4">
            <h3 className="font-semibold mb-4">Transaction Settings</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Slippage Tolerance
                </label>
                <div className="flex items-center space-x-2 mb-2">
                  {slippagePresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => onSlippageChange(preset)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        slippage === preset
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => onSlippageChange(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="50"
                  step="0.1"
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none"
                  placeholder="Custom"
                />
                {slippage > 5 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    High slippage tolerance
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Transaction Deadline
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={deadline}
                    onChange={(e) => onDeadlineChange(parseInt(e.target.value) || 20)}
                    min="1"
                    max="60"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">minutes</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Expert Mode</label>
                <button
                  onClick={() => onExpertModeChange(!expertMode)}
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
              {expertMode && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Expert mode bypasses confirmation screens and allows high slippage trades
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

