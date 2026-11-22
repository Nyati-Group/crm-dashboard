import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nyati Sales Dashboard',
  description: 'Sales, registration, collection and outstanding vs budget - Nyati Group',
  icons: { icon: '/nyati-logo.jpg' },
};

// Applies the saved theme before first paint (no light/dark flash).
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
