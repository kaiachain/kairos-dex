/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_CHAIN_NAME?: string;
  readonly VITE_CHAIN_NETWORK?: string;
  readonly VITE_NATIVE_CURRENCY_NAME?: string;
  readonly VITE_NATIVE_CURRENCY_SYMBOL?: string;
  readonly VITE_NATIVE_CURRENCY_DECIMALS?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_BLOCK_EXPLORER_NAME?: string;
  readonly VITE_BLOCK_EXPLORER_URL?: string;
  readonly VITE_V3_CORE_FACTORY?: string;
  readonly VITE_SWAP_ROUTER_02?: string;
  readonly VITE_NONFUNGIBLE_POSITION_MANAGER?: string;
  readonly VITE_QUOTER_V2?: string;
  readonly VITE_MULTICALL2?: string;
  readonly VITE_TICK_LENS?: string;
  readonly VITE_V3_MIGRATOR?: string;
  readonly VITE_V3_STAKER?: string;
  readonly VITE_WRAPPED_NATIVE_TOKEN?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_SUBGRAPH_URL?: string;
  readonly VITE_SUBGRAPH_BEARER_TOKEN?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_IS_TESTNET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
