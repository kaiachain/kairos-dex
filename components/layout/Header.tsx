"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { Wallet, LogOut, Copy, ExternalLink, ChevronDown, Check, Menu, X } from "lucide-react";
import { formatAddress, formatBalance } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { BLOCK_EXPLORER_URL, CHAIN_NAME } from "@/config/env";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Connect Wallet Modal Component
function ConnectWalletModal({ 
  isOpen, 
  onClose, 
  connectors, 
  connect 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  connectors: any[];
  connect: (args: { connector: any }) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">Connect Wallet</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-400 mb-6">
            Connect your wallet to continue. By connecting, you agree to our Terms of Service.
          </p>

          <div className="space-y-2">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => {
                  connect({ connector });
                  onClose();
                }}
                className="w-full flex items-center space-x-4 px-4 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all duration-200 border border-gray-700 hover:border-gray-600 group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {getConnectorIcon(connector)}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white">{getConnectorName(connector)}</div>
                  <div className="text-xs text-gray-400">
                    {connector.name.toLowerCase().includes("metamask") && "Connect using MetaMask browser extension"}
                    {connector.name.toLowerCase().includes("walletconnect") && "Connect using WalletConnect"}
                    {connector.name.toLowerCase().includes("coinbase") && "Connect using Coinbase Wallet"}
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 rotate-[-90deg] group-hover:text-white transition-colors" />
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              New to Ethereum?{" "}
              <a
                href="https://ethereum.org/en/wallets/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-500 hover:text-pink-400 underline"
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
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const walletMenuRef = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

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
    }
  };

  const explorerUrl = `${BLOCK_EXPLORER_URL}/account/${address}`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">U</span>
            </div>
            <span className="text-xl font-semibold text-white">Uniswap</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "text-white bg-gray-800"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
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
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-800 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-400" />
              ) : (
                <Menu className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {/* Connect Wallet Button */}
            {mounted && isConnected ? (
              <div className="relative" ref={walletMenuRef}>
                <button
                  onClick={() => setShowWalletMenu(!showWalletMenu)}
                  className="flex items-center space-x-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium"
                >
                  <Wallet className="w-4 h-4" />
                  <span className="hidden sm:inline">{formatAddress(address || "")}</span>
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    showWalletMenu && "rotate-180"
                  )} />
                </button>

                {/* Wallet Menu */}
                {showWalletMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-gray-800 rounded-2xl shadow-lg border border-gray-700 overflow-hidden animate-fade-in">
                    <div className="p-4 border-b border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Connected
                        </span>
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      </div>
                      <div className="font-mono text-sm break-all text-white bg-gray-900 rounded-lg px-3 py-2 border border-gray-700">
                        {address}
                      </div>
                    </div>

                    <div className="p-2">
                      <button
                        onClick={handleCopy}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-700 rounded-xl transition-colors text-gray-300"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
                            <Copy className="w-4 h-4" />
                          </div>
                          <span className="font-medium">{copied ? "Copied!" : "Copy Address"}</span>
                        </div>
                        {copied && <Check className="w-4 h-4 text-green-500" />}
                      </button>

                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center space-x-3 px-4 py-3 text-sm hover:bg-gray-700 rounded-xl transition-colors text-gray-300"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
                          <ExternalLink className="w-4 h-4" />
                        </div>
                        <span className="font-medium">View on Explorer</span>
                      </a>

                      {balance && (
                        <div className="px-4 py-3 text-sm">
                          <div className="text-xs text-gray-400 mb-1">Balance</div>
                          <div className="font-semibold text-white">
                            {formatBalance(balance.formatted, 4)} {balance.symbol}
                          </div>
                        </div>
                      )}

                      <div className="border-t border-gray-700 my-2" />

                      <button
                        onClick={() => {
                          disconnect();
                          setShowWalletMenu(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 rounded-xl transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-900/30 flex items-center justify-center">
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
                className="flex items-center space-x-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2 px-4 py-2 bg-pink-500 text-white rounded-lg font-medium opacity-50">
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "text-white bg-gray-800"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
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
          connectors={connectors}
          connect={connect}
        />
      )}
    </header>
  );
}
