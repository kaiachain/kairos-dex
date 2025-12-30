import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { metaMask, walletConnect, coinbaseWallet } from "wagmi/connectors";
import {
  CHAIN_ID,
  CHAIN_NAME,
  CHAIN_NETWORK,
  NATIVE_CURRENCY_NAME,
  NATIVE_CURRENCY_SYMBOL,
  NATIVE_CURRENCY_DECIMALS,
  RPC_URL,
  RPC_URL_PUBLIC,
  BLOCK_EXPLORER_NAME,
  BLOCK_EXPLORER_URL,
  WALLETCONNECT_PROJECT_ID,
  APP_NAME,
  IS_TESTNET,
} from "./env";

// Define chain from environment variables
export const kairosTestnet = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  network: CHAIN_NETWORK,
  nativeCurrency: {
    decimals: NATIVE_CURRENCY_DECIMALS,
    name: NATIVE_CURRENCY_NAME,
    symbol: NATIVE_CURRENCY_SYMBOL,
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
    public: {
      http: [RPC_URL_PUBLIC],
    },
  },
  blockExplorers: {
    default: {
      name: BLOCK_EXPLORER_NAME,
      url: BLOCK_EXPLORER_URL,
    },
  },
  testnet: IS_TESTNET,
});

// Get connectors - lazy initialization to avoid SSR issues
function getConnectors() {
  const connectors: ReturnType<typeof metaMask>[] = [metaMask()];

  // Only add WalletConnect and Coinbase Wallet on client side
  if (typeof window !== "undefined") {
    if (
      WALLETCONNECT_PROJECT_ID &&
      WALLETCONNECT_PROJECT_ID !== "your-project-id"
    ) {
      try {
        connectors.push(
          walletConnect({
            projectId: WALLETCONNECT_PROJECT_ID,
            showQrModal: true,
          }) as any
        );
      } catch (error) {
        console.warn("Failed to initialize WalletConnect:", error);
      }
    }
    try {
      connectors.push(coinbaseWallet({ appName: APP_NAME }) as any);
    } catch (error) {
      console.warn("Failed to initialize Coinbase Wallet:", error);
    }
  }

  return connectors;
}

export const wagmiConfig = createConfig({
  chains: [kairosTestnet],
  connectors: getConnectors(),
  transports: {
    [kairosTestnet.id]: http(),
  },
  ssr: true,
});
