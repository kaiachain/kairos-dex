
import { useEffect } from "react";
import { useAccount, useReconnect } from "wagmi";
import { useWalletConnection } from "@/hooks/useWalletConnection";

/**
 * Component that monitors wallet connection status and ensures
 * connection persists across page navigations.
 * This should be placed in the root layout or providers.
 */
export function WalletConnectionMonitor() {
  const { isConnected, isReconnecting } = useAccount();
  const { reconnect } = useReconnect();
  const { retryConnection } = useWalletConnection();

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    // Check if we have a stored connection preference
    const storedConnectorId = localStorage.getItem("wallet-connector-id");
    
    // If we have a stored connector but aren't connected, try to reconnect
    if (storedConnectorId && !isConnected && !isReconnecting) {
      // Small delay to ensure wagmi is fully initialized
      const timeoutId = setTimeout(() => {
        reconnect();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [isConnected, isReconnecting, reconnect]);

  // Monitor connection status and handle disconnections
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      // When page becomes visible again, check connection status
      if (document.visibilityState === "visible" && !isConnected && !isReconnecting) {
        const storedConnectorId = localStorage.getItem("wallet-connector-id");
        if (storedConnectorId) {
          // Try to reconnect after a short delay
          setTimeout(() => {
            reconnect();
          }, 1000);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isConnected, isReconnecting, reconnect]);

  // This component doesn't render anything
  return null;
}
