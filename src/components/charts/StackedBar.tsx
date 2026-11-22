'use client';

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatValue, type ValueKind } from '@/lib/format';
import { AXIS, TooltipBox, axisFormat, niceScale } from './chartUtils';
import type { SeriesDef } from './BarCompare';

/**
 * Horizontal stacked bars (one per category). Segments are separated by a 2px surface gap.
 * `totalKey` adds the whole (e.g. Sold) at the bar end and in the tooltip.
 */
export function StackedBar({
  data,
  series,
  kind,
  totalLabel,
  height,
  ariaLabel,
}: {
  data: { name: string; values: Record<string, number | null>; total: number | null }[];
  series: SeriesDef[];
  kind: ValueKind;
  totalLabel: string;
  height?: number;
  ariaLabel: string;
}) {
  const rows = data.map((d) => ({ name: d.name, ...d.values, __total: d.total }));
  const h = height ?? Math.max(120, data.length * 56 + 40);
  const scale = niceScale(data.map((d) => d.total ?? Object.values(d.values).reduce<number>((s, v) => s + (v ?? 0), 0)), { integer: kind === 'units', headroom: 0.3 });
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 90, bottom: 4, left: 4 }} barCategoryGap="30%">
          <CartesianGrid stroke={AXIS.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={scale.domain} ticks={scale.ticks} tickFormatter={axisFormat(kind)} tick={AXIS.tick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={110} tick={{ ...AXIS.tick, fill: 'rgb(var(--ink-2))' }} axisLine={AXIS.line} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgb(var(--grid))', opacity: 0.6 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, unknown>;
              const total = row.__total as number | null;
              return (
                <TooltipBox
                  title={String(label)}
                  kind={kind}
                  rows={[
                    ...series.map((s) => {
                      const v = (row[s.key] as number | null) ?? null;
                      return {
                        color: s.color,
                        label: s.label,
                        value: v,
                        note: v !== null && total ? `(${Math.round((v / total) * 100)}%)` : undefined,
                      };
                    }),
                    { color: 'transparent', label: totalLabel, value: total },
                  ]}
                />
              );
            }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="a"
              fill={s.color}
              maxBarSize={34}
              stroke="rgb(var(--surface))"
              strokeWidth={2}
              radius={i === series.length - 1 ? [0, 4, 4, 0] : 0}
              isAnimationActive={false}
            >
              {i === series.length - 1 && (
                <LabelList
                  dataKey="__total"
                  position="right"
                  formatter={(v: unknown) => (typeof v === 'number' ? `${totalLabel} ${formatValue(kind, v)}` : '')}
                  style={{ fill: 'rgb(var(--ink))', fontSize: 11, fontWeight: 600 }}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
