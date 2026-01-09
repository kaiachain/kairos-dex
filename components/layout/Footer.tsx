import Link from 'next/link';
import {
  CONTRACT_V3_CORE_FACTORY,
  CONTRACT_SWAP_ROUTER_02,
  CONTRACT_NONFUNGIBLE_POSITION_MANAGER,
  CHAIN_NAME,
  CHAIN_ID,
  APP_NAME,
} from '@/config/env';
import { formatAddress } from '@/lib/utils';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-uniswap-dark mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Contract Addresses</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>Factory: {formatAddress(CONTRACT_V3_CORE_FACTORY)}</div>
              <div>Router: {formatAddress(CONTRACT_SWAP_ROUTER_02)}</div>
              <div>Position Manager: {formatAddress(CONTRACT_NONFUNGIBLE_POSITION_MANAGER)}</div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Network</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div>{CHAIN_NAME}</div>
              <div>Chain ID: {CHAIN_ID}</div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Resources</h3>
            <div className="text-sm space-y-1">
              <Link href="#" className="text-primary-600 dark:text-primary-400 hover:underline">
                Documentation
              </Link>
              <br />
              <Link href="#" className="text-primary-600 dark:text-primary-400 hover:underline">
                GitHub
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>{APP_NAME} - {CHAIN_NAME}</p>
        </div>
      </div>
    </footer>
  );
}

