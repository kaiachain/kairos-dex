import { WalletConnector } from '@/types/wallet';

/**
 * Get normalized wallet connector name
 */
export function getConnectorName(connector: WalletConnector): string | null {
  // Check connector id first (more reliable)
  const connectorId = connector.id?.toLowerCase() || '';
  if (connectorId.includes('kaia') || connectorId.includes('kaikas') || connectorId.includes('klaytn')) {
    return 'Kaia Wallet';
  }
  if (connectorId.includes('keplr')) {
    return 'Keplr';
  }
  if (connectorId.includes('okx') || connectorId.includes('okex')) {
    return 'OKX Wallet';
  }
  if (connectorId.includes('enkrypt')) {
    return null; // Filter out Enkrypt
  }

  if (!connector.name) return 'Unknown Wallet';
  const name = connector.name.toLowerCase();
  if (name.includes('metamask')) return 'MetaMask';
  if (name.includes('walletconnect')) return 'WalletConnect';
  if (name.includes('coinbase')) return 'Coinbase Wallet';
  if (name.includes('kaia') || name.includes('kaikas') || name.includes('klaytn')) return 'Kaia Wallet';
  if (name.includes('keplr')) return 'Keplr';
  if (name.includes('okx') || name.includes('okex')) return 'OKX Wallet';
  if (name.includes('enkrypt')) return null; // Filter out Enkrypt
  return connector.name;
}

/**
 * Get wallet connector icon URL
 */
export function getConnectorIcon(connector: WalletConnector): string | null {
  // Check if connector has an icon property first
  if ((connector as any).iconUrl || (connector as any).icon) {
    return (connector as any).iconUrl || (connector as any).icon;
  }

  // Check connector id first (more reliable)
  const connectorId = connector.id?.toLowerCase() || '';
  const connectorName = connector.name?.toLowerCase() || '';

  // Wallet icon URLs - using reliable CDN sources with jsDelivr proxy for GitHub
  const walletIcons: Record<string, string> = {
    metamask: 'https://cdn.jsdelivr.net/gh/MetaMask/brand-resources@master/SVG/metamask-fox.svg',
    walletconnect: 'https://avatars.githubusercontent.com/u/37784886?s=200&v=4',
    coinbase: 'https://wallet-assets.coinbase.com/wallet-avatar.png',
    kaia: 'https://www.kaiawallet.io/favicon.ico',
    kaikas: 'https://www.kaiawallet.io/favicon.ico',
    klaytn: 'https://www.kaiawallet.io/favicon.ico',
    keplr: 'https://cdn.jsdelivr.net/gh/chainapsis/keplr-wallet@master/packages/extension/src/public/assets/icon-256.png',
    okx: 'https://www.okx.com/favicon.ico',
    okex: 'https://www.okx.com/favicon.ico',
  };

  // Check by ID first
  for (const [key, url] of Object.entries(walletIcons)) {
    if (connectorId.includes(key)) {
      return url;
    }
  }

  // Check by name
  for (const [key, url] of Object.entries(walletIcons)) {
    if (connectorName.includes(key)) {
      return url;
    }
  }

  return null; // Return null for unknown wallets
}

/**
 * Get emoji fallback for wallet
 */
export function getEmojiFallback(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('metamask')) return '🦊';
  if (lowerName.includes('walletconnect')) return '🔗';
  if (lowerName.includes('coinbase')) return '🔵';
  if (lowerName.includes('kaia')) return '🟣';
  if (lowerName.includes('keplr')) return '🔷';
  if (lowerName.includes('okx')) return '🟠';
  return '💼';
}

/**
 * Get wallet connector description
 */
export function getConnectorDescription(connector: WalletConnector): string {
  const connectorId = connector.id?.toLowerCase() || '';
  const connectorName = connector.name?.toLowerCase() || '';

  if (connectorName.includes('metamask') || connectorId.includes('metamask')) {
    return 'Connect using MetaMask browser extension';
  }
  if (connectorName.includes('walletconnect') || connectorId.includes('walletconnect')) {
    return 'Connect using WalletConnect';
  }
  if (connectorName.includes('coinbase') || connectorId.includes('coinbase')) {
    return 'Connect using Coinbase Wallet';
  }
  if (
    connectorName.includes('kaia') ||
    connectorName.includes('kaikas') ||
    connectorName.includes('klaytn') ||
    connectorId.includes('kaia') ||
    connectorId.includes('kaikas') ||
    connectorId.includes('klaytn')
  ) {
    return 'Connect using Kaia Wallet browser extension';
  }
  if (connectorName.includes('keplr') || connectorId.includes('keplr')) {
    return 'Connect using Keplr browser extension';
  }
  if (
    connectorName.includes('okx') ||
    connectorName.includes('okex') ||
    connectorId.includes('okx') ||
    connectorId.includes('okex')
  ) {
    return 'Connect using OKX Wallet browser extension';
  }
  return 'Connect wallet';
}

/**
 * Filter and deduplicate wallet connectors
 */
export function filterUniqueConnectors(connectors: WalletConnector[]): WalletConnector[] {
  return connectors
    .filter((connector) => {
      // Filter out Enkrypt
      const connectorId = connector.id?.toLowerCase() || '';
      const connectorName = connector.name?.toLowerCase() || '';
      if (connectorId.includes('enkrypt') || connectorName.includes('enkrypt')) {
        return false;
      }

      // Include connectors with a name, or connectors that might be Kaia Wallet (identified by id)
      if (connector.name) return true;
      if (connectorId.includes('kaia') || connectorId.includes('kaikas') || connectorId.includes('klaytn')) {
        return true;
      }
      return false;
    })
    .filter((connector, index, self) => {
      const normalizedName = getConnectorName(connector);
      // Filter out null names (like Enkrypt)
      if (!normalizedName) return false;
      return index === self.findIndex((c) => getConnectorName(c) === normalizedName);
    });
}
