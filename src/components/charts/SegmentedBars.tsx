'use client';

import { formatExact, formatPct, formatValue, type ValueKind } from '@/lib/format';
import type { SeriesDef } from './BarCompare';

export interface SegmentedRow {
  label: string;
  sub?: string;
  values: Record<string, number | null>;
}

/**
 * One 100% bar per row (part-to-whole), parts in a fixed series order with a 2px surface gap.
 * The row total sits at the right; parts wide enough carry their own value; hover shows value and share.
 */
export function SegmentedBars({ rows, series, kind, ariaLabel }: { rows: SegmentedRow[]; series: SeriesDef[]; kind: ValueKind; ariaLabel: string }) {
  let n = 0;
  return (
    <div role="img" aria-label={ariaLabel} className="space-y-5">
      {rows.map((row) => {
        const parts = series.map((s) => ({ s, v: row.values[s.key] ?? 0 })).filter((p) => p.v > 0);
        const total = parts.reduce((a, p) => a + p.v, 0);
        return (
          <div key={row.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-ink">
                {row.label}
                {row.sub && <span className="ml-2 text-xs font-normal text-muted">{row.sub}</span>}
              </p>
              <p className="text-sm font-semibold tabular text-ink">
                {formatValue(kind, total)} <span className="text-xs font-normal text-muted">total</span>
              </p>
            </div>
            {total === 0 ? (
              <div className="h-10 rounded-lg bg-[rgb(var(--grid))]" />
            ) : (
              <div className="flex h-10 w-full gap-[2px]">
                {parts.map((p, i) => {
                  const share = p.v / total;
                  const delay = n++ * 110;
                  return (
                    <div
                      key={p.s.key}
                      className="group relative h-full"
                      style={{ flexGrow: p.v, flexBasis: 0, minWidth: 6 }}
                    >
                      <div
                        className="animate-grow flex h-full w-full items-center justify-center overflow-hidden text-xs font-semibold text-white transition-[filter] group-hover:brightness-110"
                        style={{
                          background: p.s.color,
                          animationDelay: `${delay}ms`,
                          borderRadius: `${i === 0 ? 8 : 3}px ${i === parts.length - 1 ? 8 : 3}px ${i === parts.length - 1 ? 8 : 3}px ${i === 0 ? 8 : 3}px`,
                        }}
                      >
                        {share >= 0.08 ? formatValue(kind, p.v) : ''}
                      </div>
                      <div className="pointer-events-none absolute bottom-12 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-xl group-hover:block">
                        <p className="font-semibold text-ink">
                          {row.label} · {p.s.label}
                        </p>
                        <p className="tabular text-ink">
                          {formatExact(kind, p.v)} <span className="text-muted">({formatPct(share, 1)} of {formatValue(kind, total)})</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
