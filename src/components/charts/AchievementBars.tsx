'use client';

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPct } from '@/lib/format';
import { STATUS_LABEL, statusFromRatio, type Status } from '@/lib/metrics';
import { AXIS } from './chartUtils';

export const STATUS_FILL: Record<Status, string> = {
  good: 'rgb(var(--good))',
  warning: 'rgb(var(--warn))',
  critical: 'rgb(var(--bad))',
  unknown: 'rgb(var(--neutral))',
};
const STATUS_MARK: Record<Status, string> = { good: '▲', warning: '●', critical: '▼', unknown: '' };

/**
 * "% of target achieved" bars on one 0–N% axis with a dashed 100% target line.
 * Bar colour = status, and the label repeats it as a symbol (▲ on/above, ● slightly behind, ▼ behind).
 */
export function AchievementBars({
  items,
  ariaLabel,
  height,
}: {
  items: { label: string; ratio: number | null; detail?: string }[];
  ariaLabel: string;
  height?: number;
}) {
  const rows = items.map((i) => ({ name: i.label, v: i.ratio, detail: i.detail, status: statusFromRatio(i.ratio) }));
  const maxR = Math.max(1, ...rows.map((r) => r.v ?? 0));
  const top = Math.ceil((maxR * 1.18) / 0.25) * 0.25;
  const step = top > 2 ? 0.5 : 0.25;
  const ticks: number[] = [];
  for (let t = 0; t <= top + 1e-9; t += step) ticks.push(Number(t.toFixed(2)));
  const h = height ?? Math.max(180, rows.length * 46 + 50);
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={rows} layout="vertical" margin={{ top: 18, right: 20, bottom: 0, left: 0 }} barCategoryGap="32%">
          <CartesianGrid stroke={AXIS.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, top]} ticks={ticks} tickFormatter={(v: number) => formatPct(v)} tick={AXIS.tick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={92} tick={{ ...AXIS.tick, fill: 'rgb(var(--ink-2))' }} axisLine={AXIS.line} tickLine={false} />
          <ReferenceLine
            x={1}
            stroke="rgb(var(--ink-2))"
            strokeDasharray="4 3"
            label={{ value: 'Target 100%', position: 'top', fill: 'rgb(var(--muted))', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'rgb(var(--grid))', opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof rows)[number];
              return (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-ink">{r.name}</p>
                  <p className="tabular text-ink">{r.v === null ? 'n/a' : `${formatPct(r.v, 1)} of target`}</p>
                  {r.detail && <p className="text-muted">{r.detail}</p>}
                  <p className="text-muted">{STATUS_LABEL[r.status]}</p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="v"
            maxBarSize={22}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            background={{ fill: 'rgb(var(--grid))', radius: 4 }}
            label={(p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) => {
              const r = rows[p.index ?? 0];
              if (!r || r.v === null) return <g />;
              return (
                <text
                  x={Number(p.x) + Number(p.width) + 6}
                  y={Number(p.y) + Number(p.height) / 2}
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={600}
                  fill="rgb(var(--ink))"
                >
                  {formatPct(r.v)} {STATUS_MARK[r.status]}
                </text>
              );
            }}
          >
            {rows.map((r, i) => (
              <Cell key={i} fill={STATUS_FILL[r.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusLegend() {
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink2">
      {(['good', 'warning', 'critical'] as const).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_FILL[s] }} />
          {STATUS_MARK[s]} {s === 'good' ? '≥ 100%' : s === 'warning' ? '80–99%' : '< 80%'}
        </span>
      ))}
    </span>
  );
}
