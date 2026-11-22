'use client';

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatValue, type ValueKind } from '@/lib/format';
import type { SeriesDef } from './BarCompare';
import { AXIS, TooltipBox, axisFormat, niceScale } from './chartUtils';

/**
 * Stacked columns (one per category) with the column total labelled on top.
 * Negative parts stack below zero (e.g. advances), positives above.
 */
export function StackedColumns({
  data,
  series,
  kind,
  height = 280,
  ariaLabel,
}: {
  data: { name: string; values: Record<string, number | null> }[];
  series: SeriesDef[];
  kind: ValueKind;
  height?: number;
  ariaLabel: string;
}) {
  const rows = data.map((d) => {
    const vals = series.map((s) => d.values[s.key] ?? 0);
    const pos = vals.filter((v) => v > 0).reduce((a, b) => a + b, 0);
    const neg = vals.filter((v) => v < 0).reduce((a, b) => a + b, 0);
    return { name: d.name, ...d.values, __total: vals.reduce((a, b) => a + b, 0), __pos: pos, __neg: neg };
  });
  const scale = niceScale(rows.flatMap((r) => [r.__pos, r.__neg]), { integer: kind === 'units', headroom: 0.16 });
  const hasNegative = rows.some((r) => r.__neg < 0);
  const last = series.length - 1;
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} stackOffset="sign" margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid stroke={AXIS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ ...AXIS.tick, fill: 'rgb(var(--ink-2))' }} axisLine={AXIS.line} tickLine={false} interval={0} />
          <YAxis type="number" domain={scale.domain} ticks={scale.ticks} tickFormatter={axisFormat(kind)} tick={AXIS.tick} axisLine={false} tickLine={false} width={68} />
          {hasNegative && <ReferenceLine y={0} stroke="rgb(var(--axis))" />}
          <Tooltip
            cursor={{ fill: 'rgb(var(--grid))', opacity: 0.5 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, number | null>;
              return (
                <TooltipBox
                  title={String(label)}
                  kind={kind}
                  rows={[
                    ...series.map((s) => ({ color: s.color, label: s.label, value: row[s.key] ?? null })),
                    { color: 'transparent', label: 'Total', value: row.__total ?? null },
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
              maxBarSize={56}
              stroke="rgb(var(--surface))"
              strokeWidth={1}
              isAnimationActive={false}
              label={(p: { x?: number | string; width?: number | string; index?: number }) => {
                const r = rows[p.index ?? 0];
                if (!r || (r.__pos === 0 && r.__neg === 0)) return <g />;
                // draw the total once per column, from the last part that has a value
                const lastWithValue = series.reduce((acc, ss, j) => ((r as Record<string, unknown>)[ss.key] ? j : acc), -1);
                if (i !== lastWithValue) return <g />;
                return <TotalLabel x={Number(p.x) + Number(p.width) / 2} row={r} kind={kind} domain={scale.domain} height={height} />;
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Places the total above the positive stack (or below the negative one) using the axis scale. */
function TotalLabel({
  x,
  row,
  kind,
  domain,
  height,
}: {
  x: number;
  row: { __total: number; __pos: number; __neg: number };
  kind: ValueKind;
  domain: [number, number];
  height: number;
}) {
  // plot area: top margin 20, bottom ≈ 30 (x-axis)
  const top = 20;
  const bottom = height - 30;
  const yOf = (v: number) => top + ((domain[1] - v) / (domain[1] - domain[0])) * (bottom - top);
  const up = row.__pos > 0;
  const y = up ? yOf(row.__pos) - 7 : yOf(row.__neg) + 14;
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={11} fontWeight={600} fill="rgb(var(--ink))">
      {formatValue(kind, row.__total)}
    </text>
  );
}
