'use client';

import {
  CONTRACT_V3_CORE_FACTORY,
  CONTRACT_SWAP_ROUTER_02,
  CONTRACT_NONFUNGIBLE_POSITION_MANAGER,
  CHAIN_NAME,
  BLOCK_EXPLORER_URL,
} from '@/config/env';
import { ExternalLink, Copy, Check, Building2, Factory, Route, Layers } from 'lucide-react';
import { useState } from 'react';

interface ContractLinkProps {
  address: string;
  label: string;
  icon: React.ReactNode;
  explorerUrl?: string;
}

function ContractLink({ address, label, icon, explorerUrl }: ContractLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex items-center gap-2 px-3 py-2 bg-white dark:bg-card rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200">
      <div className="w-5 h-5 text-primary flex-shrink-0">
        {icon}
      </div>
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <div className="flex items-center gap-1 shrink-0 ml-auto">
        {explorerUrl && (
          <a
            href={`${explorerUrl}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-bg transition-colors text-text-secondary hover:text-primary"
            onClick={(e) => e.stopPropagation()}
            aria-label={`View ${label} on explorer`}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-bg transition-colors text-text-secondary hover:text-primary"
          aria-label={`Copy ${label} address`}
        >
          {copied ? (
            <Check className="w-4 h-4 text-success" />
          ) : (
            <Copy className="w-4 h-4" />
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
          Kairos DEX
        </h3>
      </div>
      <p className="text-xs text-text-secondary">
        Powered by Uniswap V3 protocol on {CHAIN_NAME}
      </p>
    </div>
  );
}

function ContractsSection() {
  const contracts = [
    { address: CONTRACT_V3_CORE_FACTORY, label: 'Factory', icon: <Factory className="w-5 h-5" /> },
    { address: CONTRACT_SWAP_ROUTER_02, label: 'Router', icon: <Route className="w-5 h-5" /> },
    { address: CONTRACT_NONFUNGIBLE_POSITION_MANAGER, label: 'Position Manager', icon: <Layers className="w-5 h-5" /> },
  ];

  return (
    <div>
      <div className="flex items-center space-x-2 mb-3">
        <Building2 className="w-8 h-8 rounded bg-primary/10 dark:bg-primary/20 p-1.5 text-primary" />
        <h4 className="text-base font-bold text-text-primary">
          Contracts
        </h4>
      </div>
      <div className="flex flex-row flex-wrap gap-2">
        {contracts.map((contract) => (
          <ContractLink
            key={contract.label}
            address={contract.address}
            label={contract.label}
            icon={contract.icon}
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

