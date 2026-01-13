'use client';

import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

interface ErrorDisplayProps {
  error: Error | string;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorDisplay({ error, onDismiss, className = '' }: ErrorDisplayProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={`flex items-start gap-3 p-3 bg-error/20 rounded-lg text-error text-sm border border-error/40 ${className}`}>
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium">Error</p>
        <p className="text-xs mt-1">{errorMessage}</p>
      </div>
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-error/30 rounded transition-colors"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
