"use client";

import { Wallet, LogOut, Copy, ExternalLink, ChevronDown, Check, Menu, X, AlertCircle, RefreshCw } from "lucide-react";
import { formatAddress, formatBalance } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { BLOCK_EXPLORER_URL, CHAIN_NAME } from "@/config/env";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useConnect } from "wagmi";
import { showToast } from "@/lib/showToast";

// Connect Wallet Modal Component
function ConnectWalletModal({ 
  isOpen, 
  onClose, 
  connectors, 
  onConnect,
  isConnecting
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  connectors: any[];
  onConnect: (connector: any) => Promise<void>;
  isConnecting: boolean;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getConnectorName = (connector: any) => {
    if (connector.name.toLowerCase().includes("metamask")) return "MetaMask";
    if (connector.name.toLowerCase().includes("walletconnect")) return "WalletConnect";
    if (connector.name.toLowerCase().includes("coinbase")) return "Coinbase Wallet";
    return connector.name;
  };

  const getConnectorIcon = (connector: any) => {
    const name = connector.name.toLowerCase();
    if (name.includes("metamask")) return "🦊";
    if (name.includes("walletconnect")) return "🔗";
    if (name.includes("coinbase")) return "🔵";
    return "💼";
  };

  // Filter out duplicate connectors based on normalized name
  const uniqueConnectors = connectors.filter((connector, index, self) => {
    const normalizedName = getConnectorName(connector);
    return index === self.findIndex((c) => getConnectorName(c) === normalizedName);
  });

  const handleConnect = async (connector: any) => {
    try {
      setConnectingId(connector.id);
      await onConnect(connector);
      onClose();
    } catch (error) {
      console.error("Connection error:", error);
      // Error is handled by the hook and will show toast
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center backdrop-blur-sm bg-black/60 animate-fade-in">
      <div
        ref={modalRef}
        className="mx-4 w-full max-w-md bg-white rounded-2xl border shadow-2xl dark:bg-input-bg border-border animate-scale-in"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-text-primary">Connect Wallet</h2>
            <button
              onClick={onClose}
              disabled={isConnecting}
              className="flex justify-center items-center w-8 h-8 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-bg text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mb-6 text-sm text-text-secondary">
            Connect your wallet to continue. By connecting, you agree to our Terms of Service.
          </p>

          <div className="space-y-2">
            {uniqueConnectors.map((connector) => {
              const isConnectingThis = connectingId === connector.id || (isConnecting && !connectingId);
              return (
                <button
                  key={connector.uid}
                  onClick={() => handleConnect(connector)}
                  disabled={isConnectingThis}
                  className="w-full flex items-center space-x-4 px-4 py-4 bg-gray-50 dark:bg-input-bg hover:bg-gray-100 dark:hover:bg-bg rounded-xl transition-all duration-200 border border-border hover:border-[color:var(--border-hover)] group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex justify-center items-center w-10 h-10 text-2xl bg-gray-200 rounded-lg transition-transform dark:bg-bg group-hover:scale-110">
                    {getConnectorIcon(connector)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-text-primary">{getConnectorName(connector)}</div>
                    <div className="text-xs text-text-secondary">
                      {isConnectingThis ? "Connecting..." : (
                        <>
                          {connector.name.toLowerCase().includes("metamask") && "Connect using MetaMask browser extension"}
                          {connector.name.toLowerCase().includes("walletconnect") && "Connect using WalletConnect"}
                          {connector.name.toLowerCase().includes("coinbase") && "Connect using Coinbase Wallet"}
                        </>
                      )}
                    </div>
                  </div>
                  {isConnectingThis ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-text-secondary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-text-secondary rotate-[-90deg] group-hover:text-text-primary transition-colors" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-6 mt-6 border-t border-border">
            <p className="text-xs text-center text-text-secondary">
              New to Ethereum?{" "}
              <a
                href="https://ethereum.org/en/wallets/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-primary hover:opacity-80"
              >
                Learn more about wallets
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const navItems = [
  { href: '/', label: 'Trade' },
  { href: '/explore', label: 'Explore' },
  { href: '/pools', label: 'Pool' },
  { href: '/positions', label: 'Portfolio' },
];

export function Header() {
  const {
    isConnected,
    isConnecting,
    isReconnecting,
    address,
    isCorrectChain,
    balance,
    error,
    connect,
    disconnect,
    switchChain,
    retryConnection,
  } = useWalletConnection();
  
  const { connectors } = useConnect();
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const userInitiatedConnectionRef = useRef(false);
  const previousConnectedRef = useRef(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Track connection state changes and show success toast only for user-initiated connections
  useEffect(() => {
    if (!mounted) return;

    // If we just became connected and it was a user-initiated connection
    if (isConnected && !previousConnectedRef.current && userInitiatedConnectionRef.current) {
      // Small delay to ensure the connection is fully established and address is available
      setTimeout(() => {
        if (address) {
          showToast({
            type: "success",
            title: "Wallet connected successfully",
            description: `Connected: ${formatAddress(address)}`,
            autoClose: 3000,
          });
        } else {
          showToast({
            type: "success",
            title: "Wallet connected successfully",
            autoClose: 3000,
          });
        }
        userInitiatedConnectionRef.current = false;
      }, 300);
    }

    // Update previous state
    previousConnectedRef.current = isConnected;

    // Reset flag if connection fails or is disconnected
    if (!isConnected && !isConnecting) {
      userInitiatedConnectionRef.current = false;
    }
  }, [isConnected, isConnecting, mounted, address]);

  // Show error toasts
  useEffect(() => {
    if (error && mounted) {
      showToast({
        type: "error",
        title: "Wallet Connection Error",
        description: error.message || "Failed to connect wallet",
        autoClose: 5000,
      });
      // Reset flag on error
      userInitiatedConnectionRef.current = false;
    }
  }, [error, mounted]);

  // Show reconnecting status (only for auto-reconnects, not user-initiated)
  useEffect(() => {
    if (isReconnecting && mounted && !userInitiatedConnectionRef.current) {
      showToast({
        type: "info",
        title: "Reconnecting to wallet...",
        autoClose: 3000,
      });
    }
  }, [isReconnecting, mounted]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
        setShowWalletMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast({
        type: "success",
        title: "Address copied to clipboard",
        autoClose: 2000,
      });
    }
  };

  const handleConnect = async (connector: any) => {
    try {
      // Mark as user-initiated connection
      userInitiatedConnectionRef.current = true;
      // The success toast will be shown when isConnected becomes true
      await connect(connector);
    } catch (err) {
      // Reset flag on error
      userInitiatedConnectionRef.current = false;
      // Error is already handled by the hook and will show toast
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowWalletMenu(false);
      showToast({
        type: "info",
        title: "Wallet disconnected",
        description: "You have been disconnected from the wallet",
        autoClose: 2000,
      });
    } catch (err) {
      // Error is already handled by the hook
    }
  };

  const handleSwitchChain = async () => {
    try {
      await switchChain();
      showToast({
        type: "success",
        title: "Chain switched successfully",
        description: `Switched to ${CHAIN_NAME}`,
        autoClose: 3000,
      });
    } catch (err) {
      // Error is already handled by the hook
    }
  };

  const explorerUrl = `${BLOCK_EXPLORER_URL}/account/${address}`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-bg">
      <div className="container px-4 mx-auto sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex overflow-hidden justify-center items-center w-8 h-8 rounded-lg">
              <img 
                src="/icon.png" 
                alt="Kairos DEX" 
                width={32}
                height={32}
                className="object-contain w-full h-full"
                loading="eager"
              />
            </div>
            <span className="text-xl font-semibold text-text-primary">Kairos DEX</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-1 md:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-gray-100 text-text-primary dark:bg-input-bg"
                      : "text-text-secondary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-input-bg"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-2">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex justify-center items-center w-10 h-10 rounded-lg transition-colors md:hidden hover:bg-gray-100 dark:hover:bg-input-bg"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-text-secondary" />
              ) : (
                <Menu className="w-5 h-5 text-text-secondary" />
              )}
            </button>

            {/* Connect Wallet Button */}
            {mounted && isConnected ? (
              <div className="relative" ref={walletMenuRef}>
                <button
                  onClick={() => setShowWalletMenu(!showWalletMenu)}
                  className={cn(
                    "flex items-center px-4 py-2 space-x-2 font-medium rounded-lg transition-colors hover:opacity-90",
                    isCorrectChain 
                      ? "bg-primary text-bg" 
                      : "bg-warning text-bg"
                  )}
                >
                  <Wallet className="w-4 h-4" />
                  <span className="hidden sm:inline">{formatAddress(address || "")}</span>
                  {!isCorrectChain && (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    showWalletMenu && "rotate-180"
                  )} />
                </button>

                {/* Wallet Menu */}
                {showWalletMenu && (
                  <div className="overflow-hidden absolute right-0 z-50 mt-2 w-72 bg-white rounded-2xl border shadow-lg dark:bg-input-bg border-border animate-fade-in">
                    <div className="p-4 border-b border-border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold tracking-wide uppercase text-text-secondary">
                          {isReconnecting ? "Reconnecting..." : "Connected"}
                        </span>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          isReconnecting ? "animate-pulse bg-warning" : "bg-success"
                        )} />
                      </div>
                      <div className="px-3 py-2 font-mono text-sm break-all bg-gray-50 rounded-lg border text-text-primary dark:bg-bg border-border">
                        {address}
                      </div>
                      {!isCorrectChain && (
                        <div className="p-3 mt-3 rounded-lg border bg-warning/10 border-warning/20">
                          <div className="flex items-center mb-2 space-x-2 text-sm font-medium text-warning">
                            <AlertCircle className="w-4 h-4" />
                            <span>Wrong Network</span>
                          </div>
                          <button
                            onClick={handleSwitchChain}
                            className="px-3 py-2 w-full text-sm font-medium rounded-lg transition-opacity bg-warning text-bg hover:opacity-90"
                          >
                            Switch to {CHAIN_NAME}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-2">
                      <button
                        onClick={handleCopy}
                        className="flex justify-between items-center px-4 py-3 w-full text-sm rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-bg text-text-primary"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex justify-center items-center w-8 h-8 bg-gray-100 rounded-lg dark:bg-bg">
                            <Copy className="w-4 h-4" />
                          </div>
                          <span className="font-medium">{copied ? "Copied!" : "Copy Address"}</span>
                        </div>
                        {copied && <Check className="w-4 h-4 text-success" />}
                      </button>

                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center px-4 py-3 space-x-3 w-full text-sm rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-bg text-text-primary"
                      >
                        <div className="flex justify-center items-center w-8 h-8 bg-gray-100 rounded-lg dark:bg-bg">
                          <ExternalLink className="w-4 h-4" />
                        </div>
                        <span className="font-medium">View on Explorer</span>
                      </a>

                      {balance !== undefined && (
                        <div className="px-4 py-3 text-sm">
                          <div className="mb-1 text-xs text-text-secondary">Balance</div>
                          <div className="font-semibold text-text-primary">
                            {formatBalance(Number(balance) / 1e18, 4)} KAIA
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="px-4 py-3 mb-2">
                          <div className="p-3 rounded-lg border bg-error/10 border-error/20">
                            <div className="flex items-center mb-2 space-x-2 text-xs text-error">
                              <AlertCircle className="w-4 h-4" />
                              <span className="font-medium">Connection Error</span>
                            </div>
                            <p className="mb-2 text-xs text-text-secondary">{error.message}</p>
                            <button
                              onClick={retryConnection}
                              className="flex justify-center items-center px-3 py-2 space-x-2 w-full text-xs font-medium rounded-lg transition-opacity bg-error text-bg hover:opacity-90"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Retry Connection</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="my-2 border-t border-border" />

                      <button
                        onClick={handleDisconnect}
                        disabled={isReconnecting}
                        className="flex items-center px-4 py-3 space-x-3 w-full text-sm rounded-xl transition-colors text-error hover:opacity-80 disabled:opacity-50"
                      >
                        <div className="flex justify-center items-center w-8 h-8 rounded-lg bg-error/20">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <span className="font-medium">Disconnect</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : mounted ? (
              <button
                onClick={() => setShowConnectModal(true)}
                disabled={isConnecting || isReconnecting}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 bg-primary text-bg rounded-lg hover:opacity-90 transition-colors font-medium",
                  (isConnecting || isReconnecting) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isConnecting || isReconnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Connecting...</span>
                    <span className="sm:hidden">Connecting...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    <span className="hidden sm:inline">Connect Wallet</span>
                    <span className="sm:hidden">Connect</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center px-4 py-2 space-x-2 font-medium rounded-lg opacity-50 bg-primary text-bg">
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="py-4 space-y-1 border-t md:hidden border-border">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-gray-100 text-text-primary dark:bg-input-bg"
                      : "text-text-secondary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-input-bg"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect Wallet Modal */}
      {mounted && (
        <ConnectWalletModal
          isOpen={showConnectModal}
          onClose={() => setShowConnectModal(false)}
          connectors={[...connectors]}
          onConnect={handleConnect}
          isConnecting={isConnecting}
        />
      )}
    </header>
  );
}
