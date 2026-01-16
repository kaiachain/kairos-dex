import { Connector } from 'wagmi';

/**
 * Wallet connector type with proper typing
 */
export type WalletConnector = Connector;

/**
 * Wallet connector metadata
 */
export interface WalletConnectorInfo {
  id: string;
  name: string;
  iconUrl?: string;
  description?: string;
}

/**
 * Wallet connection state
 */
export interface WalletConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  address: `0x${string}` | undefined;
  isCorrectChain: boolean;
  balance: bigint | undefined;
  error: Error | null;
}
