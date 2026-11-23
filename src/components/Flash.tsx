'use client';

import clsx from 'clsx';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/** One-off messages set by server actions in the short-lived `flash` cookie (see app/actions.ts). */
export const FLASH_COOKIE = 'flash';
const MESSAGES: Record<string, { tone: 'success' | 'info' | 'error'; text: string }> = {
  'signed-in': { tone: 'success', text: 'Signed in successfully. Welcome back!' },
  'signed-out': { tone: 'success', text: 'You have been signed out.' },
  'session-expired': { tone: 'info', text: 'Your session has ended. Please sign in again.' },
};

const TONE = {
  success: { icon: CheckCircle2, cls: 'border-good/40 text-goodInk', bar: 'bg-good' },
  info: { icon: Info, cls: 'border-brand2/40 text-brand', bar: 'bg-brand2' },
  error: { icon: TriangleAlert, cls: 'border-bad/40 text-badInk', bar: 'bg-bad' },
};

/** Toast in the top-right corner; it reads the cookie once, deletes it and hides itself after 4.5 s. */
export function Flash({ fallback }: { fallback?: keyof typeof MESSAGES }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${FLASH_COOKIE}=([^;]*)`));
    const c = m ? decodeURIComponent(m[1]) : (fallback ?? null);
    if (m) document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
    if (c && MESSAGES[c]) {
      setCode(c);
      const t = setTimeout(() => setCode(null), 4500);
      return () => clearTimeout(t);
    }
  }, [fallback]);
  if (!code) return null;
  const msg = MESSAGES[code];
  const tone = TONE[msg.tone];
  const Icon = tone.icon;
  return (
    <div
      role={msg.tone === 'error' ? 'alert' : 'status'}
      className={clsx(
        'animate-rise fixed left-4 right-4 top-4 z-[60] mx-auto flex max-w-sm items-start gap-2.5 overflow-hidden rounded-xl border bg-surface px-4 py-3 text-sm shadow-xl sm:left-auto sm:right-6 sm:top-20',
        tone.cls,
      )}
    >
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 font-medium text-ink">{msg.text}</p>
      <button type="button" onClick={() => setCode(null)} aria-label="Dismiss message" className="-m-1 rounded p-1 text-muted hover:bg-surface2 hover:text-ink">
        <X aria-hidden className="h-3.5 w-3.5" />
      </button>
      <span aria-hidden className={clsx('absolute bottom-0 left-0 h-0.5 w-full origin-left', tone.bar)} style={{ animation: 'shrink-x 4.5s linear forwards' }} />
    </div>
  );
}
