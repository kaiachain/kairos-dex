import type { Metadata } from 'next';
import { Manrope, Red_Hat_Display } from 'next/font/google';
import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
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
  title: 'Kairos DEX - Kairos Testnet',
  description: 'Kairos DEX AMM interface for Kairos testnet',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-64x64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
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

