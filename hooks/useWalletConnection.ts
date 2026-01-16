"use client";

import { useAccount, useConnect, useDisconnect, useBalance, useChainId, useSwitchChain } from "wagmi";
import { useEffect, useState, useCallback, useRef } from "react";
import { CHAIN_ID } from "@/config/env";

export interface WalletConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isReconnecting: boolean;
  address: `0x${string}` | undefined;
  chainId: number;
  isCorrectChain: boolean;
  balance: bigint | undefined;
  error: Error | null;
  connector: any;
}

export interface UseWalletConnectionReturn extends WalletConnectionState {
  connect: (connector?: any) => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: () => Promise<void>;
  retryConnection: () => Promise<void>;
}

/**
 * Custom hook for managing wallet connections with robust error handling,
 * auto-reconnection, and chain validation.
 */
export function useWalletConnection(): UseWalletConnectionReturn {
  const { address, isConnected, connector, isReconnecting } = useAccount();
  const chainId = useChainId();
  const { connect: wagmiConnect, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect: wagmiDisconnect, isPending: isDisconnecting } = useDisconnect();
  const { switchChain: wagmiSwitchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });
  
  const [error, setError] = useState<Error | null>(null);
  const [lastConnectorId, setLastConnectorId] = useState<string | null>(null);
  const reconnectAttemptedRef = useRef(false);
  const isCorrectChain = chainId === CHAIN_ID;

  // Clear error when connection succeeds
  useEffect(() => {
    if (isConnected && error) {
      setError(null);
    }
  }, [isConnected, error]);

  // Handle connection errors
  useEffect(() => {
    if (connectError) {
      const errorMessage = connectError.message || "Failed to connect wallet";
      setError(new Error(errorMessage));
    }
  }, [connectError]);

  // Auto-reconnect on mount if previously connected
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Only attempt auto-reconnect once
    if (reconnectAttemptedRef.current) return;
    
    // If already connected, no need to reconnect
    if (isConnected) {
      reconnectAttemptedRef.current = true;
      return;
    }

    // Try to reconnect if we have a stored connector preference
    const storedConnectorId = localStorage.getItem("wallet-connector-id");
    if (storedConnectorId && !isConnecting && !isReconnecting) {
      const connector = connectors.find((c) => c.id === storedConnectorId);
      if (connector) {
        reconnectAttemptedRef.current = true;
        // Small delay to ensure wagmi is ready
        setTimeout(() => {
          wagmiConnect({ connector });
        }, 100);
      }
    } else {
      reconnectAttemptedRef.current = true;
    }
  }, [connectors, isConnected, isConnecting, isReconnecting, wagmiConnect]);

  // Store connector preference when connected
  useEffect(() => {
    if (isConnected && connector) {
      localStorage.setItem("wallet-connector-id", connector.id);
      setLastConnectorId(connector.id);
      setError(null);
    } else if (!isConnected) {
      // Only clear if explicitly disconnected (not on page load)
      // This allows auto-reconnect to work
    }
  }, [isConnected, connector]);

  // Handle chain switching
  const switchChain = useCallback(async () => {
    if (!isConnected || isCorrectChain) return;
    
    try {
      setError(null);
      await wagmiSwitchChain({ chainId: CHAIN_ID });
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to switch chain";
      setError(new Error(errorMessage));
      throw err;
    }
  }, [isConnected, isCorrectChain, wagmiSwitchChain]);

  // Connect wallet
  const connect = useCallback(async (connectorArg?: any) => {
    try {
      setError(null);
      
      // If connector is provided, use it
      if (connectorArg) {
        await wagmiConnect({ connector: connectorArg });
        return;
      }

      // Otherwise, try to use last connected connector
      if (lastConnectorId) {
        const connector = connectors.find((c) => c.id === lastConnectorId);
        if (connector) {
          await wagmiConnect({ connector });
          return;
        }
      }

      // Fallback to first available connector (usually MetaMask)
      if (connectors.length > 0) {
        await wagmiConnect({ connector: connectors[0] });
      } else {
        throw new Error("No wallet connectors available");
      }
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to connect wallet";
      const error = new Error(errorMessage);
      setError(error);
      throw error;
    }
  }, [wagmiConnect, connectors, lastConnectorId]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      setError(null);
      localStorage.removeItem("wallet-connector-id");
      setLastConnectorId(null);
      await wagmiDisconnect();
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to disconnect wallet";
      setError(new Error(errorMessage));
      throw err;
    }
  }, [wagmiDisconnect]);

  // Retry connection
  const retryConnection = useCallback(async () => {
    if (lastConnectorId) {
      const connector = connectors.find((c) => c.id === lastConnectorId);
      if (connector) {
        await connect(connector);
      }
    } else if (connectors.length > 0) {
      await connect(connectors[0]);
    }
  }, [connect, connectors, lastConnectorId]);

  return {
    isConnected,
    isConnecting,
    isDisconnecting,
    isReconnecting,
    address,
    chainId,
    isCorrectChain,
    balance: balance?.value,
    error,
    connector,
    connect,
    disconnect,
    switchChain,
    retryConnection,
  };
}
