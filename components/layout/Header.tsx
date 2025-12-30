"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { Wallet, LogOut, Copy, ExternalLink } from "lucide-react";
import { formatAddress, formatNumber } from "@/lib/utils";
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
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold">Uniswap V3</h1>
          <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
            TESTNET
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {mounted && isConnected && balance && (
            <div className="hidden md:flex items-center space-x-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Balance:</span>
              <span className="font-medium">
                {formatNumber(balance.formatted, 4)} {balance.symbol}
              </span>
            </div>
          )}

          {mounted && isConnected ? (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {formatAddress(address || "")}
                </span>
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Connected Wallet
                    </div>
                    <div className="font-mono text-sm break-all">{address}</div>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={handleCopy}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      <span>{copied ? "Copied!" : "Copy Address"}</span>
                    </button>

                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View on Explorer</span>
                    </a>

                    <button
                      onClick={() => {
                        disconnect();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
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
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Connect Wallet</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg">
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
