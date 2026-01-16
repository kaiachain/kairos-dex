import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { metaMask, walletConnect, coinbaseWallet, injected } from "wagmi/connectors";
import { createStorage } from "wagmi";
import {
  CHAIN_ID,
  CHAIN_NAME,
  CHAIN_NETWORK,
  NATIVE_CURRENCY_NAME,
  NATIVE_CURRENCY_SYMBOL,
  NATIVE_CURRENCY_DECIMALS,
  RPC_URL,
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
      http: [RPC_URL],
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

  // Only add WalletConnect, Coinbase Wallet, and Kaia Wallet on client side
  if (typeof window !== "undefined") {
    // Add Kaia Wallet (injected wallet via window.klaytn)
    // Always add it so users can see it in the list, even if not installed
    try {
      const kaiaConnector = injected({
        target: {
          id: "kaia",
          name: "Kaia Wallet",
          provider: () => (window as any).klaytn || undefined,
        },
        shimDisconnect: true,
      }) as any;
      
      connectors.push(kaiaConnector);
    } catch (error) {
      console.warn("Failed to initialize Kaia Wallet:", error);
    }

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

// Create storage with localStorage for persistence across page navigations
const storage = typeof window !== "undefined" 
  ? createStorage({ storage: window.localStorage })
  : undefined;

export const wagmiConfig = createConfig({
  chains: [kairosTestnet],
  connectors: getConnectors(),
  transports: {
    [kairosTestnet.id]: http(),
  },
  ssr: true,
  storage,
});
