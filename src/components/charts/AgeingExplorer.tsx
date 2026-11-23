'use client';

import clsx from 'clsx';
import { useState } from 'react';
import type { ValueKind } from '@/lib/format';
import type { SeriesDef } from './BarCompare';
import { StackedColumns } from './StackedColumns';

export interface AgeingOption {
  id: string;
  label: string;
  data: { name: string; values: Record<string, number | null> }[];
}

/**
 * Ageing buckets as stacked columns, with a segment switch (e.g. All / Residential / Commercial)
 * so one chart covers every segment instead of one chart per segment.
 */
export function AgeingExplorer({
  options,
  series,
  kind,
  ariaLabel,
  height = 280,
}: {
  options: AgeingOption[];
  series: SeriesDef[];
  kind: ValueKind;
  ariaLabel: string;
  height?: number;
}) {
  const [id, setId] = useState(options[0]?.id);
  const current = options.find((o) => o.id === id) ?? options[0];
  if (!current) return null;
  return (
    <div>
      {options.length > 1 && (
        <div role="tablist" aria-label="Segment" className="mb-2 inline-flex rounded-lg bg-surface2 p-0.5 ring-1 ring-line">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={o.id === current.id}
              onClick={() => setId(o.id)}
              className={clsx(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                o.id === current.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <StackedColumns key={current.id} ariaLabel={`${ariaLabel}, ${current.label}`} kind={kind} height={height} series={series} data={current.data} />
    </div>
  );
}
