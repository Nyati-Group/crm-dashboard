'use client';

import clsx from 'clsx';
import { formatExact, formatPct, formatSigned, formatValue, type ValueKind } from '@/lib/format';
import { STATUS_LABEL, achievementRatio, statusFromRatio, type Status } from '@/lib/metrics';

export const STATUS_FILL: Record<Status, string> = {
  good: 'rgb(var(--good))',
  warning: 'rgb(var(--warn))',
  critical: 'rgb(var(--bad))',
  unknown: 'rgb(var(--neutral))',
};
const STATUS_MARK: Record<Status, string> = { good: '▲', warning: '●', critical: '▼', unknown: '' };
const STATUS_TEXT: Record<Status, string> = { good: 'text-goodInk', warning: 'text-warnInk', critical: 'text-badInk', unknown: 'text-muted' };

export interface BulletItem {
  label: string;
  kind: ValueKind;
  target: number | null;
  actual: number | null;
  /** the sheet's own % when present; otherwise actual ÷ target */
  ratio?: number | null;
}

export interface BulletGroup {
  title: string;
  sub?: string;
  items: BulletItem[];
}

/**
 * Bullet chart: every "target vs achieved" comparison on one shared 0–N% scale.
 * The bar is the achieved figure as a share of its target, the dark tick is the target (100%),
 * bar colour + symbol give the status. Figures sit beside each bar; hover shows the exact amounts.
 */
export function Bullets({ groups, ariaLabel }: { groups: BulletGroup[]; ariaLabel: string }) {
  const rows = groups.flatMap((g) => g.items.map((i) => ({ ...i, r: i.ratio ?? achievementRatio(i.actual, i.target) })));
  const maxR = Math.max(1.25, ...rows.map((r) => r.r ?? 0));
  const span = Math.min(2.5, Math.ceil((maxR * 1.04) / 0.25) * 0.25);
  const pos = (r: number) => `${(Math.max(0, Math.min(span, r)) / span) * 100}%`;
  const ticks = [0, 0.5, 1, 1.5, 2, 2.5].filter((t) => t <= span);
  let n = 0;
  // One grid for the whole chart (rows and the scale are subgrids of it), so every bar has exactly
  // the same width and start, and the % scale underneath lines up with the bars whatever the
  // screen width, zoom or length of the figures.
  return (
    <div role="img" aria-label={ariaLabel} className="grid grid-cols-[minmax(80px,128px)_minmax(96px,1fr)_auto] gap-x-3">
      {groups.map((g, gi) => (
        <div key={g.title} className={clsx('col-span-3 grid grid-cols-subgrid', gi > 0 && 'mt-5')}>
          <div className="col-span-3 mb-2 flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink2">{g.title}</p>
            {g.sub && <p className="text-[11px] text-muted">{g.sub}</p>}
          </div>
          <ul className="col-span-3 grid grid-cols-subgrid gap-y-2.5">
            {g.items.map((it) => {
              const r = it.ratio ?? achievementRatio(it.actual, it.target);
              const status = statusFromRatio(r);
              const delay = n++ * 90;
              const variance = it.actual !== null && it.target !== null ? it.actual - it.target : null;
              return (
                <li key={it.label} className="group relative col-span-3 grid grid-cols-subgrid items-center">
                  <span className="line-clamp-2 text-sm leading-tight text-ink2" title={it.label}>
                    {it.label}
                  </span>
                  <div className="relative h-3.5 rounded-full bg-[rgb(var(--grid))]">
                    {/* 50% steps as faint guides */}
                    {ticks.slice(1).map((t) => (
                      <span key={t} aria-hidden className="absolute top-0 h-full w-px bg-surface/80" style={{ left: pos(t) }} />
                    ))}
                    <div
                      className="animate-grow absolute left-0 top-0 h-full rounded-full transition-[filter] group-hover:brightness-110"
                      style={{ width: r === null ? 0 : pos(r), background: STATUS_FILL[status], animationDelay: `${delay}ms` }}
                    />
                    <span aria-hidden className="absolute -top-1 h-[22px] w-[3px] -translate-x-1/2 rounded-full bg-ink" style={{ left: pos(1) }} />
                  </div>
                  <span className="flex items-center justify-end gap-2 text-right text-xs tabular">
                    {/* achieved over target, so the figures stay narrow and the bars stay long */}
                    <span className="leading-tight">
                      <span className="block whitespace-nowrap font-semibold text-ink">{it.actual === null ? '—' : formatValue(it.kind, it.actual)}</span>
                      <span className="block whitespace-nowrap text-[11px] text-muted">of {it.target === null ? '—' : formatValue(it.kind, it.target)}</span>
                    </span>
                    <span className={clsx('w-12 shrink-0 font-semibold', STATUS_TEXT[status])}>
                      {r === null ? '—' : `${formatPct(r)}`}
                      <span aria-hidden className="ml-0.5 text-[9px]">
                        {STATUS_MARK[status]}
                      </span>
                    </span>
                  </span>
                  {/* hover card */}
                  <div className="pointer-events-none absolute left-[128px] top-6 z-20 hidden min-w-[220px] rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-xl group-hover:block">
                    <p className="mb-1 font-semibold text-ink">
                      {g.title} · {it.label}
                    </p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 tabular">
                      <dt className="text-muted">Target</dt>
                      <dd className="text-right text-ink">{it.target === null ? 'n/a' : formatExact(it.kind, it.target)}</dd>
                      <dt className="text-muted">Achieved</dt>
                      <dd className="text-right text-ink">{it.actual === null ? 'n/a' : formatExact(it.kind, it.actual)}</dd>
                      <dt className="text-muted">Variance</dt>
                      <dd className="text-right text-ink">{variance === null ? 'n/a' : formatSigned(it.kind, variance)}</dd>
                      <dt className="text-muted">Achieved</dt>
                      <dd className={clsx('text-right font-semibold', STATUS_TEXT[status])}>{r === null ? 'n/a' : formatPct(r, 1)}</dd>
                    </dl>
                    <p className="mt-1 border-t border-line pt-1 text-muted">{STATUS_LABEL[status]}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {/* shared scale: same column as the bars */}
      <div className="col-span-3 mt-3 grid grid-cols-subgrid text-[10px] text-muted">
        <span />
        <div className="relative h-3">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 tabular" style={{ left: pos(t) }}>
              {formatPct(t)}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}

export function BulletLegend() {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink2">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-3 w-[3px] rounded-full bg-ink" /> Target (100%)
      </span>
      {(['good', 'warning', 'critical'] as const).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_FILL[s] }} />
          {STATUS_MARK[s]} {s === 'good' ? '≥ 100%' : s === 'warning' ? '80–99%' : '< 80%'}
        </span>
      ))}
    </span>
  );
}
