'use client';

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
    <div className="group flex items-center gap-2 p-2 bg-gray-50 dark:bg-input-bg rounded-md hover:bg-gray-100 dark:hover:bg-bg transition-colors border border-border">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium text-text-secondary">{label}</span>
        </div>
        <div className="font-mono text-xs text-text-primary truncate">{formatAddress(address)}</div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {explorerUrl && (
          <a
            href={`${explorerUrl}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-bg transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3 text-text-secondary" />
          </a>
        )}
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-bg transition-colors"
        >
          {copied ? (
            <Check className="w-3 h-3 text-success" />
          ) : (
            <Copy className="w-3 h-3 text-text-secondary" />
          )}
        </button>
      </div>
    </div>
  );
}

function FooterContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {children}
    </div>
  );
}

function BrandSection() {
  return (
    <div>
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-6 h-6 rounded flex items-center justify-center overflow-hidden">
          <img 
            src="/icon.png" 
            alt="Kairos DEX" 
            width={24}
            height={24}
            className="w-full h-full object-contain"
            loading="eager"
          />
        </div>
        <h3 className="text-base font-bold text-text-primary">
          {APP_NAME}
        </h3>
      </div>
      <p className="text-xs text-text-secondary">
        Decentralized exchange protocol on {CHAIN_NAME}
      </p>
    </div>
  );
}

function ContractsSection() {
  const contracts = [
    { address: CONTRACT_V3_CORE_FACTORY, label: 'Factory' },
    { address: CONTRACT_SWAP_ROUTER_02, label: 'Router' },
    { address: CONTRACT_NONFUNGIBLE_POSITION_MANAGER, label: 'Position Manager' },
  ];

  return (
    <div>
      <div className="flex items-center space-x-2 mb-2">
        <Building2 className="w-6 h-6 rounded bg-primary/10 dark:bg-primary/20 p-1.5 text-primary" />
        <h4 className="text-base font-bold text-text-primary">
          Contracts
        </h4>
      </div>
      <div className="flex flex-col gap-1.5">
        {contracts.map((contract) => (
          <CopyableAddress
            key={contract.label}
            address={contract.address}
            label={contract.label}
            explorerUrl={BLOCK_EXPLORER_URL}
          />
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-bg">
      <FooterContainer>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BrandSection />
          <ContractsSection />
        </div>
      </FooterContainer>
    </footer>
  );
}

