'use client';

import clsx from 'clsx';
import { BarChart3, Table2 } from 'lucide-react';
import { useState } from 'react';
import { useInView } from './motion';

/**
 * A chart with its table-view twin (every value is reachable without hover or colour),
 * a legend row, and an optional badge. The chart mounts when the card scrolls into view,
 * so its entrance animation plays when it is actually seen.
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
  minHeight = 240,
  delay = 0,
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
  /** reserved height before the chart mounts (avoids layout jump) */
  minHeight?: number;
  /** entrance delay in ms, to stagger cards in a row */
  delay?: number;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <section
      id={id}
      className={clsx('card-hover animate-rise flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span aria-hidden className="h-4 w-1 rounded-full bg-gradient-to-b from-brand2 to-brand" />
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 pl-3 text-xs text-muted">{subtitle}</p>}
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
      {legend && view === 'chart' && <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">{legend}</div>}
      <div ref={ref} className="min-w-0 flex-1" style={inView ? undefined : { minHeight }}>
        {view === 'chart' || !table ? inView && chart : <div className="animate-fade overflow-x-auto">{table}</div>}
      </div>
      {footer && <div className="mt-3 border-t border-line/70 pt-2 text-xs text-muted">{footer}</div>}
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
