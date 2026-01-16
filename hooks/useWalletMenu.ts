import { useState, useRef, useCallback } from 'react';
import { useClickOutside } from './useClickOutside';

/**
 * Hook for managing wallet menu state
 */
export function useWalletMenu() {
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(walletMenuRef, () => {
    setShowWalletMenu(false);
  });

  const toggleWalletMenu = useCallback(() => {
    setShowWalletMenu((prev) => !prev);
  }, []);

  const closeWalletMenu = useCallback(() => {
    setShowWalletMenu(false);
  }, []);

  const handleCopy = useCallback(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return {
    showWalletMenu,
    copied,
    walletMenuRef,
    toggleWalletMenu,
    closeWalletMenu,
    handleCopy,
  };
}
