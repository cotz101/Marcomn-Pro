import { Inter } from 'next/font/google';
import './globals.css';
import '../src/index.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'MarComn — Where professionals connect & build',
  description: 'MarComn is a community-driven networking platform for maritime professionals.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
