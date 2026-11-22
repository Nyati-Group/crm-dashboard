'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatExact, formatValue, type ValueKind } from '@/lib/format';

/** Part-to-whole donut (2–4 parts) with the whole in the centre and a value + % legend beside it. */
export function Donut({
  parts,
  centerLabel,
  centerValue,
  kind,
  ariaLabel,
  size = 200,
}: {
  parts: { label: string; value: number | null; color: string }[];
  centerLabel: string;
  centerValue: number | null;
  kind: ValueKind;
  ariaLabel: string;
  size?: number;
}) {
  const usable = parts.filter((p) => p.value !== null && p.value > 0) as { label: string; value: number; color: string }[];
  const sum = usable.reduce((s, p) => s + p.value, 0);
  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={usable}
              dataKey="value"
              nameKey="label"
              innerRadius="64%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={usable.length > 1 ? 2 : 0}
              stroke="rgb(var(--surface))"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {usable.map((p) => (
                <Cell key={p.label} fill={p.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof usable)[number];
                return (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                    <p className="font-semibold text-ink">{p.label}</p>
                    <p className="tabular text-ink">
                      {formatExact(kind, p.value)} ({Math.round((p.value / sum) * 100)}%)
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular text-ink">{centerValue === null ? '—' : formatValue(kind, centerValue)}</span>
          <span className="text-xs text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3 border-b border-line/60 pb-2 last:border-0">
            <span className="inline-flex items-center gap-2 text-ink2">
              <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="tabular font-semibold text-ink">
              {p.value === null ? '—' : formatValue(kind, p.value)}
              {p.value !== null && sum > 0 && <span className="ml-1.5 font-normal text-muted">{Math.round((p.value / sum) * 100)}%</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
