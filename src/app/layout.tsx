import type { Metadata, Viewport } from 'next';
import './globals.css';

// Icons come from the file conventions in this folder: favicon.ico, icon.png, apple-icon.png.
export const metadata: Metadata = {
  title: { default: 'Nyati Sales Dashboard', template: '%s · Nyati Sales Dashboard' },
  description: 'Nyati Group sales dashboard: units sold, sales value, collection, registration and outstanding against target, with project timelines and an AI copilot.',
  applicationName: 'Nyati Sales Dashboard',
  // private company dashboard: keep it out of search engines
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // light theme only
  colorScheme: 'light',
  themeColor: '#1e3f8a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen overflow-x-clip">{children}</body>
    </html>
  );
}
