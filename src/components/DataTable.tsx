'use client';

import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatExact, formatValue, type ValueKind } from '@/lib/format';

export interface DTColumn {
  key: string;
  label: string;
  kind: ValueKind | 'text';
  signed?: boolean;
}

export interface DTCell {
  /** numeric value when usable, else null */
  value: number | null;
  /** exactly what the sheet holds (used for CSV export and hover) */
  raw: string | number | boolean | null;
  status: 'ok' | 'empty' | 'needs_clarification' | 'text';
  ref?: string;
  warn?: string;
}

export interface DTRow {
  id: string;
  cells: Record<string, DTCell>;
}

/** Sortable, searchable table with CSV export of the source values (unchanged). */
export function DataTable({ columns, rows, filename, caption }: { columns: DTColumn[]; rows: DTRow[]; filename: string; caption: string }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q
      ? rows.filter((r) => columns.some((c) => String(r.cells[c.key]?.raw ?? '').toLowerCase().includes(q)))
      : rows.slice();
    if (sort) {
      out = out.sort((a, b) => {
        const ca = a.cells[sort.key];
        const cb = b.cells[sort.key];
        const va = ca?.value ?? (ca?.status === 'text' ? String(ca.raw ?? '') : null);
        const vb = cb?.value ?? (cb?.status === 'text' ? String(cb.raw ?? '') : null);
        if (va === null) return 1; // blanks / unclear always last
        if (vb === null) return -1;
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      });
    }
    return out;
  }, [rows, columns, query, sort]);

  function toggle(key: string) {
    setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  }

  function exportCsv() {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [columns.map((c) => esc(c.label)).join(','), ...visible.map((r) => columns.map((c) => esc(r.cells[c.key]?.raw)).join(','))];
    const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search</span>
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-56 rounded-md border border-line bg-surface py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand2 focus:ring-2 focus:ring-brand2/30"
          />
        </label>
        <span className="text-xs text-muted">
          {visible.length} of {rows.length} row{rows.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface2"
        >
          <Download aria-hidden className="h-4 w-4" />
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              {columns.map((c, i) => {
                const active = sort?.key === c.key;
                const Icon = !active ? ArrowUpDown : sort!.dir === 1 ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'}
                    className={clsx('py-2 pr-3 font-medium', i > 0 && 'text-right')}
                  >
                    <button type="button" onClick={() => toggle(c.key)} className={clsx('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')}>
                      {c.label}
                      <Icon aria-hidden className="h-3 w-3" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="tabular">
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-surface2/60">
                {columns.map((c, i) => (
                  <td key={c.key} className={clsx('py-2 pr-3', i > 0 && 'text-right')}>
                    <CellView cell={r.cells[c.key]} col={c} />
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-sm text-muted">
                  No rows match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellView({ cell, col }: { cell: DTCell | undefined; col: DTColumn }) {
  if (!cell || cell.status === 'empty') return <span className="text-muted">—</span>;
  if (cell.status === 'needs_clarification') {
    return (
      <span className="rounded bg-warn/15 px-1.5 py-0.5 text-xs font-medium text-warnInk" title={`${cell.ref}: "${String(cell.raw)}" is not a complete number`}>
        Needs clarification ({String(cell.raw)})
      </span>
    );
  }
  if (col.kind === 'text' || cell.value === null) return <span>{String(cell.raw ?? '')}</span>;
  const text = formatValue(col.kind, cell.value);
  return (
    <span className="inline-flex items-center gap-1" title={[formatExact(col.kind, cell.value)].filter(Boolean).join(' · ')}>
      {cell.warn && <TriangleAlert aria-label="Data issue" className="h-3.5 w-3.5 text-warnInk" />}
      {col.signed && cell.value > 0 ? '+' : ''}
      {text}
    </span>
  );
}
