'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, Droplets, Layers, BarChart3, Settings, Repeat, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Swap', icon: ArrowLeftRight },
  { href: '/wrap', label: 'Wrap', icon: Repeat },
  { href: '/pools', label: 'Pools', icon: Droplets },
  { href: '/positions', label: 'Positions', icon: Layers },
  { href: '/explore', label: 'Explore', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="sticky top-16 z-40 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/60 dark:bg-uniswap-dark/60 backdrop-blur-xl backdrop-saturate-150">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center justify-center space-x-1 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center space-x-2 px-5 py-3 text-sm font-medium transition-all duration-200 rounded-xl group',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                {/* Active Background */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-50 via-primary-100/50 to-primary-50 dark:from-primary-900/30 dark:via-primary-800/20 dark:to-primary-900/30 rounded-xl border border-primary-200/50 dark:border-primary-700/30" />
                )}
                
                {/* Hover Background */}
                {!isActive && (
                  <div className="absolute inset-0 bg-gray-100/50 dark:bg-uniswap-dark-700/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                )}

                {/* Content */}
                <div className="relative z-10 flex items-center space-x-2">
                  <Icon className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    isActive && "scale-110"
                  )} />
                  <span className="font-semibold">{item.label}</span>
                </div>

                {/* Active Indicator Dot */}
                {isActive && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-500 animate-pulse" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-between w-full py-3 text-gray-700 dark:text-gray-300"
          >
            <span className="font-semibold text-sm">
              {navItems.find(item => 
                pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))
              )?.label || 'Menu'}
            </span>
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="pb-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-800/20 text-primary-600 dark:text-primary-400 border border-primary-200/50 dark:border-primary-700/30'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-uniswap-dark-700/30'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-primary-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

