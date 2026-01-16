"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { showToast } from "@/lib/showToast";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { ChainSwitchModal } from "./ChainSwitchModal";
import { CHAIN_ID } from "@/config/env";

/**
 * Component that shows a warning toast when user visits wallet-required pages
 * without having their wallet connected, and prompts to switch chain if wrong network.
 * 
 * Monitored pages:
 * - / (Swap)
 * - /pools (Pools)
 * - /positions (Portfolio)
 */
export function WalletConnectionGuard() {
  const pathname = usePathname();
  const { isConnected, isConnecting, isReconnecting, chainId } = useAccount();
  const { isCorrectChain, switchChain, chainId: hookChainId } = useWalletConnection();
  const [showChainSwitchModal, setShowChainSwitchModal] = useState(false);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const hasShownToastRef = useRef(false);
  const lastPathnameRef = useRef<string | null>(null);
  
  // Use chainId from account if available, otherwise fall back to hook chainId
  const currentChainId = chainId || hookChainId || 0;
  
  // Determine if chain is correct - must be connected and chainId must match
  const isWrongChain = isConnected && currentChainId > 0 && currentChainId !== CHAIN_ID;

  // Note: Wagmi automatically handles chain change events through its hooks
  // The useAccount and useChainId hooks will update automatically when chain changes

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    // Debug logging
    if (isConnected) {
      console.log("[WalletConnectionGuard] Wallet connected:", {
        chainId: currentChainId,
        expectedChainId: CHAIN_ID,
        isCorrectChain,
        isWrongChain,
        isConnected,
      });
    }

    // Check if current page requires wallet connection
    // - / (Swap page)
    // - /pools (Pools page - exact match)
    // - /positions (Portfolio page - exact match or detail pages)
    const requiresWallet =
      pathname === "/" ||
      pathname === "/pools" ||
      pathname === "/positions" ||
      (pathname?.startsWith("/positions/") && pathname !== "/positions");

    // Reset toast flag when pathname changes
    if (pathname !== lastPathnameRef.current) {
      hasShownToastRef.current = false;
      lastPathnameRef.current = pathname;
    }

    // Show chain switch modal if:
    // 1. Wallet is connected
    // 2. Chain is incorrect (not 1001) - using isWrongChain for more reliable detection
    // 3. Not currently connecting or reconnecting
    // 4. Modal is not already shown
    // This ensures users are prompted to switch chain on any page when connected to wrong network
    if (
      isWrongChain &&
      !isConnecting &&
      !isReconnecting &&
      !showChainSwitchModal
    ) {
      console.log("[WalletConnectionGuard] Showing chain switch modal - wrong chain detected");
      // Small delay to ensure page is fully loaded
      const timeoutId = setTimeout(() => {
        setShowChainSwitchModal(true);
      }, 500);

      return () => clearTimeout(timeoutId);
    }

    // Show warning toast if:
    // 1. Page requires wallet
    // 2. Wallet is not connected
    // 3. Not currently connecting or reconnecting
    // 4. Haven't shown toast for this page visit yet
    if (
      requiresWallet &&
      !isConnected &&
      !isConnecting &&
      !isReconnecting &&
      !hasShownToastRef.current
    ) {
      // Small delay to ensure page is fully loaded
      const timeoutId = setTimeout(() => {
        showToast({
          type: "warning",
          title: "Wallet Not Connected",
          description: "Please connect your wallet first",
          autoClose: 5000,
        });
        hasShownToastRef.current = true;
      }, 500);

      return () => clearTimeout(timeoutId);
    }

    // Close modal when chain switches to correct one
    if (isCorrectChain && showChainSwitchModal) {
      console.log("[WalletConnectionGuard] Chain is now correct, closing modal");
      setShowChainSwitchModal(false);
      setIsSwitchingChain(false);
    }
  }, [pathname, isConnected, isConnecting, isReconnecting, isCorrectChain, isWrongChain, currentChainId, showChainSwitchModal]);

  const handleSwitchChain = async () => {
    try {
      setIsSwitchingChain(true);
      await switchChain();
      // Modal will close automatically when chain switches successfully
      // (handled by useEffect watching isCorrectChain)
    } catch (error) {
      console.error("Failed to switch chain:", error);
      setIsSwitchingChain(false);
      // Error is already handled by the hook and will show toast
    }
  };

  const handleCloseModal = () => {
    if (!isSwitchingChain) {
      setShowChainSwitchModal(false);
    }
  };

  return (
    <>
      <ChainSwitchModal
        isOpen={showChainSwitchModal}
        onClose={handleCloseModal}
        onSwitchChain={handleSwitchChain}
        currentChainId={currentChainId}
        isSwitching={isSwitchingChain}
      />
    </>
  );
}
