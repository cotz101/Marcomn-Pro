import { Inter } from 'next/font/google';
import './globals.css';
import '../src/index.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'MarComn — Where professionals connect & build',
  description: 'MarComn is a community-driven networking platform for maritime professionals.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MarComn',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>{children}</body>
    </html>
  );
}
