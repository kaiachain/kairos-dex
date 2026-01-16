
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { StatusMessage } from '@/features/swap/components/TerminalStatus';
import { UI_CONSTANTS } from '@/shared/constants';

interface SwapStatusContextValue {
  messages: StatusMessage[];
  addMessage: (type: StatusMessage['type'], message: string, details?: string) => void;
  clearMessages: () => void;
}

const SwapStatusContext = createContext<SwapStatusContextValue | undefined>(undefined);

export function SwapStatusProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const messagesRef = useRef<StatusMessage[]>([]);

  const addMessage = useCallback((type: StatusMessage['type'], message: string, details?: string) => {
    const id = `msg-${Date.now()}-${Math.random()}`;
    const newMessage: StatusMessage = {
      id,
      timestamp: Date.now(),
      type,
      message,
      details,
    };

    const updatedMessages = [...messagesRef.current, newMessage];
    
    // Keep only last N messages
    const trimmedMessages = updatedMessages.slice(-UI_CONSTANTS.MAX_STATUS_MESSAGES);
    
    messagesRef.current = trimmedMessages;
    setMessages(trimmedMessages);
  }, []);

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
  }, []);

  return (
    <SwapStatusContext.Provider value={{ messages, addMessage, clearMessages }}>
      {children}
    </SwapStatusContext.Provider>
  );
}

export function useSwapStatus() {
  const context = useContext(SwapStatusContext);
  if (context === undefined) {
    throw new Error('useSwapStatus must be used within a SwapStatusProvider');
  }
  return context;
}

// Global function to add status messages (for use outside React components)
let globalAddMessage: ((type: StatusMessage['type'], message: string, details?: string) => void) | null = null;

export function setGlobalSwapStatusHandler(handler: (type: StatusMessage['type'], message: string, details?: string) => void) {
  globalAddMessage = handler;
}

export function addStatusMessage(type: StatusMessage['type'], message: string, details?: string) {
  if (globalAddMessage) {
    globalAddMessage(type, message, details);
  } else {
    console.warn('addStatusMessage called before SwapStatusProvider is initialized');
  }
}
