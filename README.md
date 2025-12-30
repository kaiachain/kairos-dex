# Uniswap V3 DEX - Kairos Testnet

A fully functional Uniswap V3 AMM DEX interface for Kairos testnet users to interact with and experiment with the protocol.

## Features

### Core Trading

- ✅ Token swaps with real-time price quotes
- ✅ Slippage tolerance and transaction deadline settings
- ✅ Price impact warnings
- ✅ Expert mode toggle

### Liquidity Provision

- ✅ Create new pools
- ✅ Add liquidity with price range selection
- ✅ Full range and custom range options

### Position Management

- ✅ View all NFT positions
- ✅ Position details and analytics
- ✅ Collect fees

### Pool Discovery

- ✅ Browse all pools
- ✅ Filter and sort pools
- ✅ Pool analytics

### Wallet Integration

- ✅ MetaMask, WalletConnect, Coinbase Wallet support
- ✅ Account management
- ✅ Network configuration for Kairos testnet

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file based on `.env.example`:

```env
# Network Configuration
NEXT_PUBLIC_CHAIN_ID=2021
NEXT_PUBLIC_CHAIN_NAME=Kairos Testnet
NEXT_PUBLIC_CHAIN_NETWORK=kairos-testnet
NEXT_PUBLIC_NATIVE_CURRENCY_NAME=KAI
NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL=KAI
NEXT_PUBLIC_NATIVE_CURRENCY_DECIMALS=18

# RPC URLs
NEXT_PUBLIC_RPC_URL=https://kairos-testnet.kaia.io
NEXT_PUBLIC_RPC_URL_PUBLIC=https://kairos-testnet.kaia.io

# Block Explorer
NEXT_PUBLIC_BLOCK_EXPLORER_NAME=Kairos Explorer
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://kairos-testnet.scope.klaytn.com

# Contract Addresses
NEXT_PUBLIC_V3_CORE_FACTORY=0xb522cF1A5579c0EAe37Da6797aeBcE1bac2D4a29
NEXT_PUBLIC_SWAP_ROUTER_02=0xd28909Ef8bd258DCeFD8B5A380ff55f92eD8ae4b
NEXT_PUBLIC_NONFUNGIBLE_POSITION_MANAGER=0x9546E23b2642334E7B82027B09e5c6c8E808F4E3
NEXT_PUBLIC_QUOTER_V2=0x56a4BD4a66785Af030A2003254E93f111892BfB5
NEXT_PUBLIC_MULTICALL2=0x2A2aDD27F8C70f6161C9F29ea06D4e171E55C680
NEXT_PUBLIC_TICK_LENS=0x56C8DAB2fFf78D49a76B897828E7c58896bA8b87
NEXT_PUBLIC_V3_MIGRATOR=0xDab424Aba37f24A94f568Df345634d4B66830ebB
NEXT_PUBLIC_V3_STAKER=0xc3cF7B37E5020f718aceE1f4e1b12bC7b1C6CE4B

# WalletConnect (optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# App Configuration
NEXT_PUBLIC_APP_NAME=Uniswap V3 DEX
NEXT_PUBLIC_IS_TESTNET=true
```

**Note:** All values have defaults, so you only need to set variables if you want to override them. The defaults are configured for Kairos testnet.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Contract Addresses

Contract addresses are configured via environment variables. Default values (for Kairos testnet):

- **V3CoreFactory**: `0xb522cF1A5579c0EAe37Da6797aeBcE1bac2D4a29`
- **SwapRouter02**: `0xd28909Ef8bd258DCeFD8B5A380ff55f92eD8ae4b`
- **NonfungiblePositionManager**: `0x9546E23b2642334E7B82027B09e5c6c8E808F4E3`
- **QuoterV2**: `0x56a4BD4a66785Af030A2003254E93f111892BfB5`
- **Multicall2**: `0x2A2aDD27F8C70f6161C9F29ea06D4e171E55C680`
- **TickLens**: `0x56C8DAB2fFf78D49a76B897828E7c58896bA8b87`
- **V3Migrator**: `0xDab424Aba37f24A94f568Df345634d4B66830ebB`
- **V3Staker**: `0xc3cF7B37E5020f718aceE1f4e1b12bC7b1C6CE4B`

To use different addresses, set the corresponding `NEXT_PUBLIC_*` environment variables.

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **wagmi** - Ethereum React hooks
- **viem** - TypeScript Ethereum library
- **Tailwind CSS** - Styling
- **Uniswap V3 SDK** - Uniswap integration

## Project Structure

```
/ui
├── app/                 # Next.js app directory
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home/Swap page
│   ├── pools/          # Pools pages
│   ├── positions/      # Positions pages
│   └── explore/        # Analytics pages
├── components/          # React components
│   ├── layout/         # Layout components
│   ├── swap/           # Swap interface
│   ├── pools/          # Pool components
│   ├── positions/      # Position components
│   ├── liquidity/     # Liquidity components
│   └── analytics/      # Analytics components
├── hooks/              # Custom React hooks
├── types/              # TypeScript types
├── config/             # Configuration files
├── lib/                # Utility functions
└── abis/               # Contract ABIs
```

## License

MIT
