'use client';

import { TriangleAlert } from 'lucide-react';

export default function DashError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex gap-3">
        <TriangleAlert aria-hidden className="h-6 w-6 shrink-0 text-badInk" />
        <div>
          <h2 className="text-lg font-semibold">Something went wrong while showing this page</h2>
          <p className="mt-1 text-sm text-ink2">Please try again in a moment.</p>
          {error.digest && <p className="mt-1 font-mono text-xs text-muted">Reference: {error.digest}</p>}
          <button type="button" onClick={reset} className="mt-4 rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface2">
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
