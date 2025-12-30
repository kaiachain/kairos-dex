import {
  CONTRACT_V3_CORE_FACTORY,
  CONTRACT_SWAP_ROUTER_02,
  CONTRACT_NONFUNGIBLE_POSITION_MANAGER,
  CONTRACT_QUOTER_V2,
  CONTRACT_MULTICALL2,
  CONTRACT_TICK_LENS,
  CONTRACT_V3_MIGRATOR,
  CONTRACT_V3_STAKER,
} from './env';

// Contract addresses - loaded from environment variables
export const CONTRACTS = {
  V3CoreFactory: CONTRACT_V3_CORE_FACTORY,
  SwapRouter02: CONTRACT_SWAP_ROUTER_02,
  NonfungiblePositionManager: CONTRACT_NONFUNGIBLE_POSITION_MANAGER,
  QuoterV2: CONTRACT_QUOTER_V2,
  Multicall2: CONTRACT_MULTICALL2,
  TickLens: CONTRACT_TICK_LENS,
  V3Migrator: CONTRACT_V3_MIGRATOR,
  V3Staker: CONTRACT_V3_STAKER,
} as const;

// Fee tiers for Uniswap V3
export const FEE_TIERS = [
  { value: 100, label: '0.01%', description: 'Best for stable pairs' },
  { value: 500, label: '0.05%', description: 'Best for most pairs' },
  { value: 3000, label: '0.3%', description: 'Best for exotic pairs' },
  { value: 10000, label: '1%', description: 'Best for exotic pairs' },
] as const;

// Network configuration is now in wagmi.ts

