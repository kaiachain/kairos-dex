"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { showToast } from "@/lib/showToast";

/**
 * Component that shows a warning toast when user visits wallet-required pages
 * without having their wallet connected.
 * 
 * Monitored pages:
 * - / (Swap)
 * - /pools (Pools)
 * - /positions (Portfolio)
 */
export function WalletConnectionGuard() {
  const pathname = usePathname();
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const hasShownToastRef = useRef(false);
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

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

    // Reset flag when wallet becomes connected
    if (isConnected) {
      hasShownToastRef.current = false;
    }
  }, [pathname, isConnected, isConnecting, isReconnecting]);

  // This component doesn't render anything
  return null;
}
