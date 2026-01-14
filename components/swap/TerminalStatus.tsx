'use client';

import { useEffect, useRef } from 'react';

export interface StatusMessage {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'warning' | 'loading';
  message: string;
  details?: string;
}

interface TerminalStatusProps {
  messages: StatusMessage[];
  isActive: boolean;
}

export function TerminalStatus({ messages, isActive }: TerminalStatusProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getPrefix = (type: StatusMessage['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'loading':
        return '⟳';
      default:
        return '→';
    }
  };

  if (!isActive || messages.length === 0) {
    return null;
  }

  // Show only last 10 messages for minimalistic design
  const displayMessages = messages.slice(-10);

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-700/50 font-mono text-xs overflow-hidden backdrop-blur-sm">
      {/* Minimal Header */}
      <div className="bg-gray-800/50 px-3 py-1.5 border-b border-gray-700/50">
        <span className="text-gray-400">Swap Router Console</span>
      </div>

      {/* Minimal Body */}
      <div className="p-2 h-32 overflow-y-auto bg-gray-950/50">
        <div className="space-y-0.5">
          {displayMessages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-2 py-0.5"
            >
              <span className="text-gray-500 flex-shrink-0 w-12 text-[10px]">
                {new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                  hour12: false, 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit'
                })}
              </span>
              <span className="text-gray-400 flex-shrink-0">{getPrefix(msg.type)}</span>
              <span
                className={
                  msg.type === 'error'
                    ? 'text-red-400'
                    : msg.type === 'success'
                    ? 'text-green-400'
                    : msg.type === 'warning'
                    ? 'text-yellow-400'
                    : msg.type === 'loading'
                    ? 'text-blue-400'
                    : 'text-gray-300'
                }
              >
                {msg.message}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
