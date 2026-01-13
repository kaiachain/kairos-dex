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
        className="p-2 hover:bg-gray-100 dark:hover:bg-input-bg rounded-xl transition-colors text-text-secondary hover:text-text-primary"
      >
        <Settings className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-input-bg rounded-2xl shadow-lg border border-border z-50 p-5">
            <h3 className="font-semibold mb-4 text-text-primary">Transaction Settings</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-text-secondary">
                  Slippage Tolerance
                </label>
                <div className="flex items-center space-x-2 mb-2">
                  {slippagePresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => onSlippageChange(preset)}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        slippage === preset
                          ? 'bg-primary text-bg shadow-md'
                          : 'bg-gray-100 dark:bg-bg hover:bg-gray-200 dark:hover:bg-card text-text-primary'
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
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-bg rounded-xl border border-border outline-none focus:border-primary transition-colors text-text-primary"
                  placeholder="Custom"
                />
                {slippage > 5 && (
                  <p className="text-xs text-error mt-1">
                    High slippage tolerance
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-text-secondary">
                  Transaction Deadline
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={deadline}
                    onChange={(e) => onDeadlineChange(parseInt(e.target.value) || 20)}
                    min="1"
                    max="60"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-input-bg rounded-xl border border-border outline-none focus:border-primary transition-colors text-text-primary"
                  />
                  <span className="text-sm text-text-secondary">minutes</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text-primary">Expert Mode</label>
                <button
                  onClick={() => onExpertModeChange(!expertMode)}
                  className={`relative w-12 h-6 rounded-full transition-all ${
                    expertMode ? 'bg-primary' : 'bg-secondary'
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
                <p className="text-xs text-secondary">
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

