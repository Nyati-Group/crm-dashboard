'use client';

import clsx from 'clsx';
import { RefreshCw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { refreshDataAction } from '@/app/actions';

interface Option {
  id: string;
  label: string;
  status: 'ok' | 'schema_error' | 'unavailable';
  fiscalYear: string | null;
  isTest: boolean;
}

export interface FilterBarProps {
  options: Option[];
  fyOptions: string[];
  projects: string[];
  canSwitchSource: boolean;
  filters: { sourceId: string; fy: string | null; seg: string; project: string | null };
  asOn: string | null;
  loadedAt: string | null;
  /** pages whose source tabs are not split by segment say so next to the filter */
  segmentNote?: string;
}

const SEGMENT_OPTIONS = [
  { value: 'all', label: 'All segments' },
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'total', label: 'Total' },
];

const selectCls =
  'rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand2 focus:ring-2 focus:ring-brand2/30';

export function FilterBar(p: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function set(changes: Record<string, string | null>) {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '' || (k === 'seg' && v === 'all')) q.delete(k);
      else q.set(k, v);
    }
    start(() => router.push(`${pathname}${q.toString() ? `?${q}` : ''}`));
  }

  function refresh() {
    start(async () => {
      await refreshDataAction();
      router.refresh();
    });
  }

  const loaded = p.loadedAt ? new Date(p.loadedAt) : null;

  return (
    <div
      className={clsx(
        'mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface px-3 py-3 shadow-sm transition-opacity',
        pending && 'opacity-60',
      )}
      aria-busy={pending}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">Financial year</span>
        <select
          className={selectCls}
          value={p.filters.fy ?? ''}
          onChange={(e) => set({ fy: e.target.value || null, ds: null })}
          disabled={p.fyOptions.length === 0}
        >
          {p.fyOptions.length === 0 && <option value="">—</option>}
          {p.fyOptions.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      {p.canSwitchSource && p.options.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Data source</span>
          <select className={clsx(selectCls, 'max-w-[18rem]')} value={p.filters.sourceId} onChange={(e) => set({ ds: e.target.value, fy: null })}>
            {p.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
                {o.status === 'unavailable' ? ' (not found)' : o.status === 'schema_error' ? ' (format error)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">Project segment</span>
        <select className={selectCls} value={p.filters.seg} onChange={(e) => set({ seg: e.target.value })}>
          {SEGMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {p.projects.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Project</span>
          <select className={selectCls} value={p.filters.project ?? ''} onChange={(e) => set({ project: e.target.value || null })}>
            <option value="">All projects</option>
            {p.projects.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="ml-auto flex flex-wrap items-end gap-3">
        <div className="text-right text-xs leading-snug">
          <p className="text-muted">Data as on</p>
          <p className="font-semibold text-ink">{p.asOn ?? 'Not stated in sheet'}</p>
          {loaded && (
            <p className="text-muted" title={loaded.toISOString()}>
              Loaded {loaded.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface2 disabled:opacity-60"
        >
          <RefreshCw aria-hidden className={clsx('h-4 w-4', pending && 'animate-spin')} />
          Refresh
        </button>
      </div>
      {p.segmentNote && <p className="w-full text-xs text-muted">{p.segmentNote}</p>}
    </div>
  );
}
