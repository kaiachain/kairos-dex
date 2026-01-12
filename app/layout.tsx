import type { Metadata } from 'next';
import { Manrope, Red_Hat_Display } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Load Manrope font (primary font)
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

// Load Red Hat Display font (for headings/special elements)
const redHatDisplay = Red_Hat_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-red-hat-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Uniswap V3 DEX - Kairos Testnet',
  description: 'Uniswap V3 AMM DEX interface for Kairos testnet',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${redHatDisplay.variable} dark`}>
      <body className={manrope.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

