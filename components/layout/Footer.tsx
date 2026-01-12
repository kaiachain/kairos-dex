'use client';

import Link from 'next/link';
import {
  CONTRACT_V3_CORE_FACTORY,
  CONTRACT_SWAP_ROUTER_02,
  CONTRACT_NONFUNGIBLE_POSITION_MANAGER,
  CHAIN_NAME,
  APP_NAME,
  BLOCK_EXPLORER_URL,
} from '@/config/env';
import { formatAddress } from '@/lib/utils';
import { ExternalLink, Copy, Check, Building2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CopyableAddressProps {
  address: string;
  label: string;
  explorerUrl?: string;
}

function CopyableAddress({ address, label, explorerUrl }: CopyableAddressProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex items-center justify-between p-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors border border-gray-700">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400 mb-1 font-medium">{label}</div>
        <div className="font-mono text-xs text-white truncate">{formatAddress(address)}</div>
      </div>
      <div className="flex items-center space-x-1 ml-2">
        {explorerUrl && (
          <a
            href={`${explorerUrl}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-gray-600 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
          </a>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-gray-600 transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-800 bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Brand Section */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">U</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                {APP_NAME}
              </h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Decentralized exchange protocol on {CHAIN_NAME}
            </p>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Network Active</span>
            </div>
          </div>

          {/* Contracts Section */}
          <div>
            <h4 className="font-semibold text-white mb-4 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-pink-500" />
              <span>Contracts</span>
            </h4>
            <div className="space-y-2">
              <CopyableAddress
                address={CONTRACT_V3_CORE_FACTORY}
                label="Factory"
                explorerUrl={BLOCK_EXPLORER_URL}
              />
              <CopyableAddress
                address={CONTRACT_SWAP_ROUTER_02}
                label="Router"
                explorerUrl={BLOCK_EXPLORER_URL}
              />
              <CopyableAddress
                address={CONTRACT_NONFUNGIBLE_POSITION_MANAGER}
                label="Position Manager"
                explorerUrl={BLOCK_EXPLORER_URL}
              />
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div className="text-sm text-gray-400">
              <p className="font-medium">
                © {new Date().getFullYear()} {APP_NAME}
              </p>
              <p className="text-xs mt-1">Built on {CHAIN_NAME}</p>
            </div>
            <div className="flex items-center space-x-6 text-xs text-gray-500">
              <Link href="#" className="hover:text-pink-400 transition-colors">
                Terms
              </Link>
              <Link href="#" className="hover:text-pink-400 transition-colors">
                Privacy
              </Link>
              <Link href="#" className="hover:text-pink-400 transition-colors">
                Security
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

