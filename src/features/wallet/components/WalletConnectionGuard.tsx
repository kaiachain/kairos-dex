
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { showToast } from "@/lib/showToast";
import { useWalletConnection } from "@/features/wallet/hooks/useWalletConnection";
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
  const location = useLocation();
  const pathname = location.pathname;
  const { isConnected, isConnecting, isReconnecting, chainId, address } = useAccount();
  const { isCorrectChain, switchChain, chainId: hookChainId } = useWalletConnection();
  const [showChainSwitchModal, setShowChainSwitchModal] = useState(false);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const hasShownToastRef = useRef(false);
  const lastPathnameRef = useRef<string | null>(null);
  const connectionStableRef = useRef(false);
  const connectionStableTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Only use chainId from account when wallet is actually connected with an address
  // Don't use hookChainId as fallback - it might return a default chain (1) even when not connected
  // Only trust the chainId when we have a confirmed connection with an address
  // This prevents false positives when wagmi reports isConnected=true but wallet isn't actually connected
  const hasValidConnection = isConnected && !!address;
  const currentChainId = (hasValidConnection && chainId) ? chainId : 0;
  
  // Validate CHAIN_ID is a valid number (safeguard against build-time issues)
  const isValidChainId = typeof CHAIN_ID === 'number' && !isNaN(CHAIN_ID) && CHAIN_ID > 0;
  
  // Determine if chain is correct - must be connected, have a valid chainId, and chainId must match
  // Only show wrong chain if:
  // 1. CHAIN_ID is valid
  // 2. Wallet is actually connected with an address (not just isConnected flag)
  // 3. We have a valid chainId from the connected wallet
  // 4. ChainId doesn't match expected CHAIN_ID
  const isWrongChain = isValidChainId && hasValidConnection && currentChainId > 0 && currentChainId !== CHAIN_ID;

  // Note: Wagmi automatically handles chain change events through its hooks
  // The useAccount and useChainId hooks will update automatically when chain changes

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    // Debug logging
    if (hasValidConnection) {
      console.log("[WalletConnectionGuard] Wallet connected:", {
        chainId: currentChainId,
        expectedChainId: CHAIN_ID,
        isValidChainId,
        isCorrectChain,
        isWrongChain,
        isConnected,
        hasAddress: !!address,
        hasValidConnection,
      });
      
      // Warn if CHAIN_ID is invalid (indicates build-time env var issue)
      if (!isValidChainId) {
        console.error("[WalletConnectionGuard] Invalid CHAIN_ID detected:", CHAIN_ID, 
          "This may indicate an environment variable issue in the production build.");
      }
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

    // Track when connection becomes stable (not connecting/reconnecting)
    // This prevents showing the modal during initial connection phase
    if (hasValidConnection && !isConnecting && !isReconnecting) {
      // Mark connection as stable after a short delay
      if (!connectionStableRef.current) {
        if (connectionStableTimeoutRef.current) {
          clearTimeout(connectionStableTimeoutRef.current);
        }
        connectionStableTimeoutRef.current = setTimeout(() => {
          connectionStableRef.current = true;
        }, 1000); // Wait 1 second after connection stabilizes
      }
    } else {
      // Reset stability flag if connection is lost or in progress
      connectionStableRef.current = false;
      if (connectionStableTimeoutRef.current) {
        clearTimeout(connectionStableTimeoutRef.current);
        connectionStableTimeoutRef.current = null;
      }
    }

    // Show chain switch modal if:
    // 1. Wallet is connected with an address
    // 2. Connection is stable (not during initial connection)
    // 3. Chain is incorrect (not 1001) - using isWrongChain for more reliable detection
    // 4. Not currently connecting or reconnecting
    // 5. Modal is not already shown
    // This ensures users are prompted to switch chain on any page when connected to wrong network
    if (
      isWrongChain &&
      connectionStableRef.current &&
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
  }, [pathname, isConnected, isConnecting, isReconnecting, isCorrectChain, isWrongChain, currentChainId, showChainSwitchModal, isValidChainId, hasValidConnection, address]);

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
