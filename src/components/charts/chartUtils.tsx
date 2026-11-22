'use client';

import { formatExact, formatIndianNumber, formatINRAxis, formatPct, type ValueKind } from '@/lib/format';

export const AXIS = {
  tick: { fill: 'rgb(var(--muted))', fontSize: 11 },
  line: { stroke: 'rgb(var(--axis))' },
  grid: 'rgb(var(--grid))',
};

/**
 * "Nice" axis: about `count` evenly spaced round ticks (1 / 2 / 2.5 / 5 × 10^n) that always include 0,
 * with headroom above the largest value for its label. Integer-only for unit counts.
 */
export function niceScale(values: (number | null | undefined)[], opts: { integer?: boolean; count?: number; headroom?: number } = {}) {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const pad = 1 + (opts.headroom ?? 0.12);
  let lo = Math.min(0, ...nums) * (nums.some((v) => v < 0) ? pad : 1);
  let hi = Math.max(0, ...nums) * pad;
  if (hi === lo) hi = lo + 1;
  const target = (hi - lo) / Math.max(2, (opts.count ?? 5) - 1);
  const mag = 10 ** Math.floor(Math.log10(target));
  let step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= target) ?? 10 * mag;
  if (opts.integer) step = Math.max(1, Math.ceil(step));
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1e6; v += step) ticks.push(Number(v.toPrecision(12)));
  return { domain: [lo, hi] as [number, number], ticks };
}

export function axisFormat(kind: ValueKind) {
  return (n: number) => {
    if (!Number.isFinite(n)) return '';
    switch (kind) {
      case 'inr':
        return formatINRAxis(n);
      case 'pct':
        return formatPct(n);
      case 'rate':
        return `₹${formatIndianNumber(n)}`;
      default: {
        const abs = Math.abs(n);
        if (abs >= 1e5) return `${n < 0 ? '−' : ''}${String(Number((abs / 1e5).toFixed(1)))}L`;
        return formatIndianNumber(n);
      }
    }
  };
}

interface LabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: unknown;
  index?: number;
}

/**
 * Value label at the bar's data end, never wrapped or clipped by the bar width.
 * `text` maps the raw value (or index) to the label string.
 */
export function tipLabel(orientation: 'vertical' | 'horizontal', text: (value: unknown, index: number) => string) {
  function TipLabel(p: LabelProps) {
    const x = Number(p.x ?? 0);
    const y = Number(p.y ?? 0);
    const w = Number(p.width ?? 0);
    const h = Number(p.height ?? 0);
    const t = text(p.value, p.index ?? 0);
    if (!t) return null;
    if (orientation === 'horizontal') {
      const end = Math.max(x, x + w);
      return (
        <text x={end + 6} y={y + h / 2} dominantBaseline="central" fontSize={11} fill="rgb(var(--ink-2))">
          {t}
        </text>
      );
    }
    const top = Math.min(y, y + h);
    return (
      <text x={x + w / 2} y={top - 6} textAnchor="middle" fontSize={11} fill="rgb(var(--ink-2))">
        {t}
      </text>
    );
  }
  return TipLabel;
}

export interface TooltipRow {
  color: string;
  label: string;
  value: number | null;
  note?: string;
}

export function TooltipBox({ title, rows, kind, footer }: { title: string; rows: TooltipRow[]; kind: ValueKind; footer?: string }) {
  return (
    <div className="min-w-[180px] rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-ink2">
              <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="tabular font-medium text-ink">
              {r.value === null ? 'n/a' : formatExact(kind, r.value)}
              {r.note ? <span className="ml-1 font-normal text-muted">{r.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-1 border-t border-line pt-1 text-muted">{footer}</p>}
    </div>
  );
}
