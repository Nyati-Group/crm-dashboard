import { FileWarning, SearchX } from 'lucide-react';
import type { PageContext } from '@/lib/page-context';
import { Card } from './ui';

/** Shown instead of a page when the selected source is missing or doesn't match the sheet contract. Never zeros. */
export function DataProblem({ ctx }: { ctx: PageContext }) {
  const r = ctx.selected;
  if (!r) {
    return (
      <Card className="p-6">
        <div className="flex gap-3">
          <SearchX aria-hidden className="h-6 w-6 shrink-0 text-badInk" />
          <div>
            <h2 className="text-lg font-semibold">No data source is configured</h2>
            <p className="mt-1 text-sm text-ink2">
              Put the workbook in the <code>data/</code> folder, or set <code>DATA_SOURCES</code> in <code>.env.local</code> (see README).
            </p>
          </div>
        </div>
      </Card>
    );
  }
  if (r.status === 'unavailable') {
    return (
      <Card className="p-6">
        <div className="flex gap-3">
          <SearchX aria-hidden className="h-6 w-6 shrink-0 text-badInk" />
          <div>
            <h2 className="text-lg font-semibold">Data source not available</h2>
            <p className="mt-1 text-sm text-ink2">
              <strong>{r.source.label}</strong>: {r.message}
            </p>
            <p className="mt-2 text-sm text-muted">Nothing is shown rather than showing empty or zero figures. Choose another source above, or fix the source and press Refresh.</p>
          </div>
        </div>
      </Card>
    );
  }
  if (r.status !== 'schema_error') return null;
  return (
    <Card className="p-6">
      <div className="flex gap-3">
        <FileWarning aria-hidden className="h-6 w-6 shrink-0 text-badInk" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">The data source does not match the expected sheet format</h2>
          <p className="mt-1 text-sm text-ink2">
            <strong>{r.source.label}</strong> is missing {r.errors.length === 1 ? 'a tab, column or row' : `${r.errors.length} tabs, columns or rows`} that
            the dashboard relies on. No figures are shown until this is fixed, so nothing is shown as zero by mistake.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Tab</th>
                  <th className="py-2 pr-4 font-medium">Column / row</th>
                  <th className="py-2 font-medium">Problem</th>
                </tr>
              </thead>
              <tbody>
                {r.errors.map((e, i) => (
                  <tr key={i} className="border-b border-line/60 align-top">
                    <td className="py-2 pr-4 font-mono text-xs">{e.tab}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{e.column ?? e.row ?? '—'}</td>
                    <td className="py-2 text-ink2">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted">
            Restore the original tab / column names in the sheet (they are the contract listed in the README), then press Refresh.
          </p>
        </div>
      </div>
    </Card>
  );
}
