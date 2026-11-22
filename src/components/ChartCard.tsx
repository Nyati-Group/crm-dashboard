'use client';

import clsx from 'clsx';
import { BarChart3, Table2 } from 'lucide-react';
import { useState } from 'react';

/**
 * A chart with its table-view twin (every value is reachable without hover or colour),
 * a legend row, and an optional badge.
 */
export function ChartCard({
  title,
  subtitle,
  badge,
  legend,
  chart,
  table,
  footer,
  className,
  id,
}: {
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  legend?: React.ReactNode;
  chart: React.ReactNode;
  table?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section id={id} className={clsx('flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-sm', className)}>
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {table && (
            <div role="group" aria-label="View" className="inline-flex rounded-md border border-line p-0.5">
              <button
                type="button"
                onClick={() => setView('chart')}
                aria-pressed={view === 'chart'}
                title="Chart view"
                className={clsx('rounded p-1', view === 'chart' ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink')}
              >
                <BarChart3 aria-hidden className="h-3.5 w-3.5" />
                <span className="sr-only">Chart view</span>
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                aria-pressed={view === 'table'}
                title="Table view"
                className={clsx('rounded p-1', view === 'table' ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink')}
              >
                <Table2 aria-hidden className="h-3.5 w-3.5" />
                <span className="sr-only">Table view</span>
              </button>
            </div>
          )}
        </div>
      </header>
      {legend && view === 'chart' && <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1">{legend}</div>}
      <div className="min-w-0 flex-1">{view === 'chart' || !table ? chart : <div className="overflow-x-auto">{table}</div>}</div>
      {footer && <div className="mt-2 text-xs text-muted">{footer}</div>}
    </section>
  );
}

export function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-line text-xs text-muted">
        <tr>
          {head.map((h, i) => (
            <th key={i} className={clsx('py-1.5 pr-3 font-medium', i > 0 && 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular">
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line/50 last:border-0">
            {r.map((c, j) => (
              <td key={j} className={clsx('py-1.5 pr-3', j > 0 && 'text-right')}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
