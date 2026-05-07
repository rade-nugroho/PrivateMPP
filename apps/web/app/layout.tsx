import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrivateMPP',
  description: 'Private agent payments — PER + HTTP 402 / mppx (devnet-first scaffold)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0a', color: '#fafafa' }}>{children}</body>
    </html>
  );
}
