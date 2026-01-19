# Uniswap V3 DEX - Kairos Testnet

Uniswap V3 AMM interface for Kairos testnet built with React and TypeScript.

## Features

- Token swaps with smart routing
- Liquidity provision with custom price ranges
- Position management (NFT-based)
- Pool discovery and analytics
- Multi-wallet support

## Tech Stack

- React 18, TypeScript 5, Vite 5
- wagmi v2, viem v2
- Uniswap V3 SDK, Smart Order Router
- TanStack Query, Zustand
- Tailwind CSS

## Prerequisites

- Node.js 18+
- Web3 wallet (MetaMask, Kaia Wallet, or WalletConnect)
- Testnet KAIA tokens ([Kairos Faucet](https://kairos.kaiascan.io))

## Installation

```bash
git clone <repository-url>
cd ui
npm install
```

Required: Copy `env.example` to `.env.local` and update env variables.

## Development

```bash
npm run dev
```

Available at [http://localhost:3000](http://localhost:3000)

### Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - TypeScript type checking

## Contract Addresses

Kairos testnet defaults:

| Contract                   | Address                                        |
| -------------------------- | ---------------------------------------------- |
| V3CoreFactory              | `0xb522cF1A5579c0EAe37Da6797aeBcE1bac2D4a29` |
| SwapRouter02               | `0xd28909Ef8bd258DCeFD8B5A380ff55f92eD8ae4b` |
| NonfungiblePositionManager | `0x9546E23b2642334E7B82027B09e5c6c8E808F4E3` |
| QuoterV2                   | `0x56a4BD4a66785Af030A2003254E93f111892BfB5` |
| WKAIA                      | `0x043c471bee060e00a56ccd02c0ca286808a5a436` |

Override via environment variables with `VITE_` prefix.

## Network

- Chain ID: `1001`
- RPC: `https://public-en-kairos.node.kaia.io`
- Explorer: `https://kairos.kaiascan.io`

## Project Structure

```
src/
├── app/          # Layout, pages, providers
├── features/     # Feature modules (swap, pools, positions, liquidity)
├── shared/       # Utilities, components, hooks, types
└── main.tsx      # Entry point
```

## License

MIT

## Resources

- [Uniswap V3 Docs](https://docs.uniswap.org/)
- [KAIA Docs](https://docs.kaia.io/)
- [Kairos Explorer](https://kairos.kaiascan.io)
