/**
 * Quote Expiration Timer Component
 * Shows countdown timer for quote expiration
 */

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface QuoteTimerProps {
  timestamp: number | null;
  expirationTime: number; // in milliseconds (default 60000 = 60 seconds)
  onExpired?: () => void;
}

export function QuoteTimer({ timestamp, expirationTime, onExpired }: QuoteTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!timestamp) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - timestamp;
      const remaining = expirationTime - elapsed;

      if (remaining <= 0) {
        setTimeRemaining(0);
        if (onExpired) {
          onExpired();
        }
        return;
      }

      setTimeRemaining(remaining);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [timestamp, expirationTime, onExpired]);

  if (!timestamp || timeRemaining === null) {
    return null;
  }

  if (timeRemaining <= 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-warning">
        <Clock className="w-3 h-3" />
        <span>Quote expired - refreshing...</span>
      </div>
    );
  }

  const seconds = Math.floor(timeRemaining / 1000);
  const isLowTime = seconds < 10;

  return (
    <div className={`flex items-center gap-2 text-xs ${isLowTime ? 'text-warning' : 'text-text-secondary'}`}>
      <Clock className={`w-3 h-3 ${isLowTime ? 'animate-pulse' : ''}`} />
      <span>
        Quote expires in <span className="font-semibold">{seconds}s</span>
      </span>
    </div>
  );
}
