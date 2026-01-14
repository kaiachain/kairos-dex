import { useState, useCallback, useEffect, useRef } from 'react';
import { StatusMessage } from '@/components/swap/TerminalStatus';

let statusMessages: StatusMessage[] = [];
let listeners: Set<() => void> = new Set();

export function useSwapStatus() {
  const [messages, setMessages] = useState<StatusMessage[]>([]);

  // Subscribe to updates
  useEffect(() => {
    const listener = () => {
      setMessages([...statusMessages]);
    };
    listeners.add(listener);
    setMessages([...statusMessages]);
    
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addMessage = useCallback((type: StatusMessage['type'], message: string, details?: string) => {
    const id = `msg-${Date.now()}-${Math.random()}`;
    const newMessage: StatusMessage = {
      id,
      timestamp: Date.now(),
      type,
      message,
      details,
    };
    
    statusMessages = [...statusMessages, newMessage];
    
    // Keep only last 50 messages
    if (statusMessages.length > 50) {
      statusMessages = statusMessages.slice(-50);
    }
    
    // Notify all listeners
    listeners.forEach(listener => listener());
  }, []);

  const clearMessages = useCallback(() => {
    statusMessages = [];
    listeners.forEach(listener => listener());
  }, []);

  return {
    messages,
    addMessage,
    clearMessages,
  };
}

// Global function to add status messages (can be called from anywhere)
export function addStatusMessage(type: StatusMessage['type'], message: string, details?: string) {
  const id = `msg-${Date.now()}-${Math.random()}`;
  const newMessage: StatusMessage = {
    id,
    timestamp: Date.now(),
    type,
    message,
    details,
  };
  
  statusMessages = [...statusMessages, newMessage];
  
  // Keep only last 50 messages
  if (statusMessages.length > 50) {
    statusMessages = statusMessages.slice(-50);
  }
  
  // Notify all listeners
  listeners.forEach(listener => listener());
}
