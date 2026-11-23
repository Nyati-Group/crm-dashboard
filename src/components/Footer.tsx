'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Site footer. The year is taken from the viewer's clock, so it never goes stale on a cached page.
 * Hidden on the AI Copilot, whose chat fills the screen down to its input box.
 */
export function Footer({ className = '' }: { className?: string }) {
  const path = usePathname();
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  if (path?.startsWith('/copilot')) return null;
  return (
    <footer className={`text-center text-xs text-muted ${className}`}>
      © <span suppressHydrationWarning>{year ?? new Date().getFullYear()}</span> Nyati Group. All rights reserved.
    </footer>
  );
}
