# Uniswap V3 DEX - Kairos Testnet

A fully functional Uniswap V3 AMM (Automated Market Maker) DEX interface for the Kairos testnet, built with modern React and TypeScript. This application provides a complete DeFi experience for trading, liquidity provision, and position management on the KAIA blockchain.

## 🚀 Features

### Core Trading

- **Token Swaps** - Execute token swaps with real-time price quotes using Uniswap Smart Order Router
- **Advanced Routing** - Multi-hop routing for optimal swap paths
- **Price Impact Warnings** - Visual indicators for high slippage trades
- **Slippage & Deadline Settings** - Customizable transaction parameters
- **Expert Mode** - Bypass warnings for advanced users
- **Swap History** - Track your transaction history

### Liquidity Provision

- **Create Pools** - Initialize new Uniswap V3 pools for any token pair
- **Add Liquidity** - Provide liquidity with flexible price range selection
- **Full Range & Custom Ranges** - Choose between full range or concentrated liquidity
- **Price Range Selector** - Interactive UI for setting liquidity ranges
- **Pool Selection** - Easy pool discovery and selection

### Position Management

- **NFT Positions** - View all your Uniswap V3 liquidity positions as NFTs
- **Position Analytics** - Detailed metrics including fees earned, impermanent loss, and ROI
- **Collect Fees** - Claim accumulated fees from your positions
- **Position Details** - Comprehensive view of each position's performance
- **Token Balances** - Track token balances across positions

### Pool Discovery

- **Pool Explorer** - Browse all available pools on the protocol
- **Filter & Sort** - Advanced filtering by volume, TVL, fees, and more
- **Pool Analytics** - Real-time statistics and historical data
- **Pool Details** - Deep dive into individual pool metrics
- **Token Information** - View token details and metadata

### Additional Features

- **Wrap/Unwrap** - Convert between native KAIA and WKAIA
- **Analytics Dashboard** - Protocol-wide statistics and insights
- **Transaction History** - Complete history of all your interactions
- **Dark/Light Theme** - Beautiful theme switching with system preference detection
- **Responsive Design** - Mobile-first design that works on all devices

### Wallet Integration

- **Multi-Wallet Support** - MetaMask, WalletConnect, Coinbase Wallet, and Kaia Wallet
- **Account Management** - Seamless wallet connection and switching
- **Network Configuration** - Automatic Kairos testnet configuration
- **Connection Monitoring** - Real-time wallet connection status tracking
- **Chain Switching** - Easy network switching with user-friendly modals

## 🛠️ Tech Stack

### Core Framework

- **Vite 5** - Lightning-fast build tool and dev server
- **React 18** - Modern UI library with concurrent features
- **TypeScript 5** - Full type safety throughout the application
- **React Router 6** - Client-side routing with code splitting

### Blockchain Integration

- **wagmi v2** - React hooks for Ethereum (KAIA) interactions
- **viem v2** - TypeScript-first Ethereum library
- **Uniswap V3 SDK** - Core Uniswap protocol integration
- **Uniswap Smart Order Router** - Advanced routing for optimal swaps

### State Management & Data Fetching

- **TanStack Query (React Query) v5** - Server state management with caching
- **Zustand** - Lightweight client state management
- **The Graph** - Decentralized indexing for subgraph queries

### Styling & UI

- **Tailwind CSS 3** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library
- **React Toastify** - Toast notifications
- **Recharts** - Charting library for analytics

### Development Tools

- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Node Polyfills** - Browser compatibility for Node.js modules

## 📋 Prerequisites

- **Node.js** 18 or higher
- **npm** or **yarn** package manager
- A Web3 wallet (MetaMask, Kaia Wallet, or WalletConnect-compatible wallet)
- Testnet KAIA tokens for transactions (get from [Kairos Faucet](https://kairos.kaiascan.io))

## 🔧 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ui
   ```
2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```
3. **Configure environment variables** (optional)

   Copy the example environment file and customize as needed:

   ```bash
   cp env.example .env.local
   ```

   All environment variables have sensible defaults, so you only need to set them if you want to override the defaults. See [`env.example`](env.example) for a complete list of available environment variables with descriptions.

## 🚦 Development

Start the development server:

```bash
npm run dev
# or
yarn dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## 🏗️ Build

Build the application for production:

```bash
npm run build
```

The optimized build output will be in the `dist/` directory. To preview the production build locally:

```bash
npm run preview
```

## 📁 Project Structure

```
/ui
├── src/                      # Main source code
│   ├── app/                  # App-level components
│   │   ├── layout/          # Layout components (Header, Footer, Navigation)
│   │   ├── pages/           # Page components (route handlers)
│   │   │   ├── Home.tsx     # Swap page (/)
│   │   │   ├── Pools.tsx    # Pools listing (/pools)
│   │   │   ├── PoolDetail.tsx # Pool details (/pools/:address)
│   │   │   ├── Positions.tsx # Positions listing (/positions)
│   │   │   ├── PositionDetail.tsx # Position details (/positions/:tokenId)
│   │   │   ├── AddLiquidity.tsx # Add liquidity page (/add-liquidity)
│   │   │   ├── Explore.tsx  # Analytics/explore page (/explore)
│   │   │   ├── Settings.tsx  # Settings page (/settings)
│   │   │   └── Wrap.tsx     # Wrap/unwrap page (/wrap)
│   │   └── providers/       # App providers (wagmi, react-query, theme)
│   ├── features/            # Feature-based modules
│   │   ├── swap/           # Swap feature (components, hooks, services, types)
│   │   ├── pools/          # Pools feature
│   │   ├── positions/      # Positions feature
│   │   ├── liquidity/     # Liquidity provision feature
│   │   └── wallet/        # Wallet integration feature
│   ├── shared/            # Shared utilities and components
│   │   ├── api/           # API clients (GraphQL, etc.)
│   │   ├── components/    # Reusable UI components
│   │   ├── config/        # Shared configuration
│   │   ├── constants/     # Shared constants
│   │   ├── hooks/         # Shared React hooks
│   │   ├── types/         # Shared TypeScript types
│   │   └── utils/         # Utility functions
│   ├── App.tsx            # Root component with routing
│   ├── main.tsx           # Application entry point
│   └── globals.css        # Global styles and CSS variables
├── components/            # Legacy components (being migrated to features/)
├── hooks/                # Legacy hooks (being migrated to features/)
├── types/                # Legacy types (being migrated to features/)
├── config/               # Configuration files
│   ├── env.ts            # Environment variable configuration
│   ├── wagmi.ts          # Wagmi configuration
│   ├── contracts.ts      # Contract addresses and ABIs
│   └── theme.ts          # Theme configuration
├── lib/                  # Utility libraries
│   ├── calculations.ts   # Math and calculation utilities
│   ├── formatters.ts    # Number and date formatting
│   ├── graphql.ts       # GraphQL client setup
│   ├── router-instance.ts # Smart Order Router setup
│   ├── swap-utils.ts    # Swap-related utilities
│   └── utils.ts         # General utilities
├── abis/                 # Contract ABIs
│   ├── Factory.ts
│   ├── Pool.ts
│   ├── PositionManager.ts
│   ├── QuoterV2.ts
│   ├── SwapRouter02.ts
│   └── WKAIA.ts
├── services/             # Service layer (legacy, being migrated)
├── contexts/             # React contexts (legacy, being migrated)
├── public/               # Static assets
├── dist/                 # Build output (generated)
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## 🔗 Contract Addresses

Default contract addresses for Kairos testnet:

| Contract                             | Address                                        |
| ------------------------------------ | ---------------------------------------------- |
| **V3CoreFactory**              | `0xb522cF1A5579c0EAe37Da6797aeBcE1bac2D4a29` |
| **SwapRouter02**               | `0xd28909Ef8bd258DCeFD8B5A380ff55f92eD8ae4b` |
| **NonfungiblePositionManager** | `0x9546E23b2642334E7B82027B09e5c6c8E808F4E3` |
| **QuoterV2**                   | `0x56a4BD4a66785Af030A2003254E93f111892BfB5` |
| **Multicall2**                 | `0x2A2aDD27F8C70f6161C9F29ea06D4e171E55C680` |
| **TickLens**                   | `0x56C8DAB2fFf78D49a76B897828E7c58896bA8b87` |
| **V3Migrator**                 | `0xDab424Aba37f24A94f568Df345634d4B66830ebB` |
| **V3Staker**                   | `0xc3cF7B37E5020f718aceE1f4e1b12bC7b1C6CE4B` |
| **WKAIA (Wrapped Native)**     | `0x043c471bee060e00a56ccd02c0ca286808a5a436` |

All contract addresses can be overridden via environment variables using the `VITE_` prefix (e.g., `VITE_V3_CORE_FACTORY`).

## 🌐 Network Configuration

### Kairos Testnet

- **Chain ID**: `1001`
- **Network Name**: `Kairos Testnet`
- **RPC URL**: `https://public-en-kairos.node.kaia.io`
- **Block Explorer**: `https://kairos.kaiascan.io`
- **Native Currency**: KAIA (18 decimals)

The application automatically configures your wallet to connect to Kairos testnet when you connect.

## 🎨 Theming

The application supports both light and dark themes with automatic system preference detection. Theme colors are based on the KAIA brand:

- **Primary Color**: KAIA Green (`#BFF009` / `#ACD808`)
- **Background**: Adaptive light/dark backgrounds
- **Text**: High contrast text colors for accessibility

## 🔍 Key Features Explained

### Smart Order Routing

The application uses Uniswap's Smart Order Router to find optimal swap paths, potentially splitting trades across multiple pools for better prices.

### Concentrated Liquidity

Uniswap V3 allows liquidity providers to concentrate their capital within custom price ranges, enabling more capital efficiency.

### Position NFTs

Each liquidity position is represented as an NFT (ERC-721), allowing for easy transfer and management of positions.

### Subgraph Integration

The application queries The Graph subgraph for efficient data fetching, including pool statistics, position data, and historical information.

## 🐛 Troubleshooting

### Wallet Connection Issues

- Ensure your wallet is connected to Kairos testnet (Chain ID: 1001)
- Try disconnecting and reconnecting your wallet
- Clear browser cache and reload

### Transaction Failures

- Check that you have sufficient KAIA for gas fees
- Verify you have enough token balance for the transaction
- Check slippage tolerance settings if swaps are failing

### Build Issues

- Ensure you're using Node.js 18+
- Delete `node_modules` and reinstall dependencies
- Clear Vite cache: `rm -rf node_modules/.vite`

## 📝 License

MIT

## 👥 Contributing

Contributions are welcome! Please ensure your code follows the existing patterns and includes appropriate TypeScript types.

## 🔗 Resources

- [Uniswap V3 Documentation](https://docs.uniswap.org/)
- [KAIA Documentation](https://docs.kaia.io/)
- [Kairos Testnet Explorer](https://kairos.kaiascan.io)
- [The Graph Documentation](https://thegraph.com/docs/)

---

Built with ❤️ for the KAIA ecosystem
