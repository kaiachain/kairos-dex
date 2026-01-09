"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { Wallet, LogOut, Copy, ExternalLink } from "lucide-react";
import { formatAddress, formatNumber, formatBalance } from "@/lib/utils";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { BLOCK_EXPLORER_URL } from "@/config/env";

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering wallet-dependent UI after mount
  useEffect(() => {
    setMounted(true);
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
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-uniswap-dark sticky top-0 z-50 backdrop-blur-sm bg-opacity-80 dark:bg-opacity-95">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">U</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
              Uniswap
            </h1>
          </div>
          <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-md font-medium border border-yellow-200 dark:border-yellow-800">
            TESTNET
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {mounted && isConnected && balance && (
            <div className="hidden md:flex items-center space-x-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Balance:</span>
              <span className="font-medium">
                {formatBalance(balance.formatted, 2)} {balance.symbol}
              </span>
            </div>
          )}

          {mounted && isConnected ? (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-md hover:shadow-lg font-medium"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {formatAddress(address || "")}
                </span>
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-uniswap-dark-800 rounded-2xl shadow-uniswap-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Connected Wallet
                    </div>
                    <div className="font-mono text-sm break-all text-gray-900 dark:text-gray-100">{address}</div>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={handleCopy}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-uniswap-dark-700 rounded-xl transition-colors text-gray-700 dark:text-gray-300"
                    >
                      <Copy className="w-4 h-4" />
                      <span>{copied ? "Copied!" : "Copy Address"}</span>
                    </button>

                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-uniswap-dark-700 rounded-xl transition-colors text-gray-700 dark:text-gray-300"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View on Explorer</span>
                    </a>

                    <button
                      onClick={() => {
                        disconnect();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-uniswap-dark-700 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : mounted ? (
            <div className="flex items-center space-x-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-md hover:shadow-lg font-medium"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Connect Wallet</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-medium">
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
