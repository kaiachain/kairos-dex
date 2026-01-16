import React from "react";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CHAIN_NAME } from "@/config/env";
import { Link, useLocation } from "react-router-dom";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useConnect } from "wagmi";
import { showToast } from "@/lib/showToast";
import { ConnectWalletModal } from "@/components/wallet/ConnectWalletModal";
import { WalletMenu } from "@/components/wallet/WalletMenu";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useWalletMenu } from "@/hooks/useWalletMenu";
import { useConnectionToasts } from "@/hooks/useConnectionToasts";
import { WalletConnector } from "@/types/wallet";

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
  const location = useLocation();
  const pathname = location.pathname;
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  
  const {
    showWalletMenu,
    copied,
    walletMenuRef,
    toggleWalletMenu,
    closeWalletMenu,
    handleCopy: handleCopyAddress,
  } = useWalletMenu();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Debug: Log connectors to help identify Kaia Wallet
  useEffect(() => {
    if (connectors.length > 0) {
      console.log("Available connectors:", connectors.map(c => ({ 
        id: c.id, 
        name: c.name, 
        uid: c.uid 
      })));
    }
  }, [connectors]);

  // Handle connection toasts
  const { markUserInitiated, resetUserInitiated } = useConnectionToasts({
    isConnected,
    isConnecting,
    isReconnecting,
    address,
    isCorrectChain,
    balance,
    error,
    mounted,
  });

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      handleCopyAddress();
      showToast({
        type: "success",
        title: "Address copied to clipboard",
        autoClose: 2000,
      });
    }
  };

  const handleConnect = async (connector: WalletConnector) => {
    try {
      markUserInitiated();
      await connect(connector);
    } catch (err) {
      resetUserInitiated();
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      closeWalletMenu();
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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-bg">
      <div className="container px-4 mx-auto sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="flex overflow-hidden justify-center items-center w-8 h-8 rounded-lg">
              <img 
                src="/icon.png" 
                alt="Kairos DEX" 
                width={32}
                height={32}
                className="object-contain w-full h-full"
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
                  to={item.href}
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

            {/* Wallet Button and Menu */}
            {mounted && isConnected ? (
              <div className="relative" ref={walletMenuRef}>
                <WalletButton
                  isConnected={isConnected}
                  isConnecting={isConnecting}
                  isReconnecting={isReconnecting}
                  address={address}
                  isCorrectChain={isCorrectChain}
                  showWalletMenu={showWalletMenu}
                  mounted={mounted}
                  onClick={toggleWalletMenu}
                  onConnectClick={() => setShowConnectModal(true)}
                />
                <WalletMenu
                  isOpen={showWalletMenu}
                  onClose={closeWalletMenu}
                  address={address}
                  balance={balance}
                  isCorrectChain={isCorrectChain}
                  isReconnecting={isReconnecting}
                  error={error}
                  onCopy={handleCopy}
                  onDisconnect={handleDisconnect}
                  onSwitchChain={handleSwitchChain}
                  onRetryConnection={retryConnection}
                  copied={copied}
                />
              </div>
            ) : (
              <WalletButton
                isConnected={isConnected}
                isConnecting={isConnecting}
                isReconnecting={isReconnecting}
                address={address}
                isCorrectChain={isCorrectChain}
                showWalletMenu={false}
                mounted={mounted}
                onClick={() => {}}
                onConnectClick={() => setShowConnectModal(true)}
              />
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
                  to={item.href}
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
          connectors={connectors as WalletConnector[]}
          onConnect={handleConnect}
          isConnecting={isConnecting}
        />
      )}
    </header>
  );
}
