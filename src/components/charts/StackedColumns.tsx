'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatValue, type ValueKind } from '@/lib/format';
import { useChartAnimation } from '../motion';
import type { SeriesDef } from './BarCompare';
import { AXIS, TooltipBox, axisFormat, niceScale } from './chartUtils';

/**
 * Stacked columns: one column per category, series stacked in a fixed order with a thin surface
 * gap between parts. The column total sits above each column; hover lists every part.
 */
export function StackedColumns({
  data,
  series,
  kind,
  ariaLabel,
  height = 280,
}: {
  data: { name: string; values: Record<string, number | null> }[];
  series: SeriesDef[];
  kind: ValueKind;
  ariaLabel: string;
  height?: number;
}) {
  const anim = useChartAnimation();
  const rows = data.map((d) => ({
    name: d.name,
    ...Object.fromEntries(series.map((s) => [s.key, d.values[s.key] ?? 0])),
    __total: series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0),
  }));
  const scale = niceScale(rows.map((r) => r.__total), { integer: kind === 'units', headroom: 0.14 });
  const last = series.length - 1;

  // total label above the top part of each column
  const totalLabel = (p: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => {
    const r = rows[p.index ?? 0];
    if (!r || !r.__total) return null;
    return (
      <text x={Number(p.x ?? 0) + Number(p.width ?? 0) / 2} y={Number(p.y ?? 0) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="rgb(var(--ink-2))">
        {formatValue(kind, r.__total)}
      </text>
    );
  };

  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid stroke={AXIS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ ...AXIS.tick, fill: 'rgb(var(--ink-2))' }} axisLine={AXIS.line} tickLine={false} interval={0} />
          <YAxis type="number" domain={scale.domain} ticks={scale.ticks} tickFormatter={axisFormat(kind)} tick={AXIS.tick} axisLine={false} tickLine={false} width={68} />
          <Tooltip
            cursor={{ fill: 'rgb(var(--grid))', opacity: 0.5 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, number>;
              return (
                <TooltipBox
                  title={String(label)}
                  kind={kind}
                  footer={`Total ${formatValue(kind, row.__total)}`}
                  rows={series.map((s) => ({ color: s.color, label: s.label, value: row[s.key] ?? null }))}
                />
              );
            }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="stack"
              fill={s.color}
              stroke="rgb(var(--surface))"
              strokeWidth={1}
              maxBarSize={56}
              radius={i === last ? [4, 4, 0, 0] : 0}
              {...anim(i)}
              label={i === last ? totalLabel : false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
