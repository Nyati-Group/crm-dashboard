'use client';

import { RotateCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

/** Error page for anything outside the dashboard layout (e.g. the sign-in page). */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div role="alert" className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
        <TriangleAlert aria-hidden className="mx-auto h-8 w-8 text-badInk" />
        <h1 className="mt-3 text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted">Please check your connection and try again. If it keeps happening, contact the dashboard admin.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--header))] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <RotateCw aria-hidden className="h-4 w-4" /> Try again
          </button>
          <Link href="/" className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface2">
            Go to the Overview
          </Link>
        </div>
      </div>
    </main>
  );
}
