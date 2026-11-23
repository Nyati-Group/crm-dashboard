'use client';

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatValue, type ValueKind } from '@/lib/format';
import { useChartAnimation } from '../motion';
import { AXIS, TooltipBox, axisFormat, niceScale } from './chartUtils';

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

export interface BarRow {
  name: string;
  values: Record<string, number | null>;
  /** per-row colour override for a single-series chart (e.g. highlight the >120 days bucket) */
  color?: string;
  /** extra text appended to the category label, e.g. "⚠" */
  flag?: string;
  footer?: string;
}

/**
 * Clustered column (default) or bar chart on ONE value axis with round "nice" ticks.
 * Value labels sit at the bar ends; 4px rounded data-ends, 2px gap between bars of a cluster.
 */
export function BarCompare({
  data,
  series,
  kind,
  orientation = 'vertical',
  height = 260,
  labels = 'auto',
  ariaLabel,
  categoryWidth = 110,
  compact = false,
}: {
  /** small multiple: no value axis or grid, the value labels carry the figures */
  compact?: boolean;
  data: BarRow[];
  series: SeriesDef[];
  kind: ValueKind;
  orientation?: 'vertical' | 'horizontal';
  height?: number;
  labels?: 'auto' | 'none' | 'all';
  ariaLabel: string;
  /** width of the category axis for horizontal bars */
  categoryWidth?: number;
}) {
  const anim = useChartAnimation();
  const rows = data.map((d) => ({ name: d.flag ? `${d.name} ${d.flag}` : d.name, ...d.values, __color: d.color, __footer: d.footer }));
  const showLabels = labels === 'all' || (labels === 'auto' && data.length * series.length <= 14);
  const horizontal = orientation === 'horizontal';
  const all = data.flatMap((d) => Object.values(d.values));
  const hasNegative = all.some((v) => v !== null && v < 0);
  const scale = niceScale(all, { integer: kind === 'units', headroom: horizontal ? 0.28 : 0.14 });
  const fmt = axisFormat(kind);
  const valueAxis = { type: 'number' as const, domain: scale.domain, ticks: scale.ticks, tickFormatter: fmt, tick: AXIS.tick, tickLine: false, allowDataOverflow: false };

  const label = (p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: unknown }) => {
    if (typeof p.value !== 'number') return null;
    const x = Number(p.x ?? 0);
    const y = Number(p.y ?? 0);
    const w = Number(p.width ?? 0);
    const h = Number(p.height ?? 0);
    const text = formatValue(kind, p.value);
    if (horizontal) {
      const neg = p.value < 0;
      return (
        <text x={neg ? Math.min(x, x + w) - 6 : Math.max(x, x + w) + 6} y={y + h / 2} dominantBaseline="central" textAnchor={neg ? 'end' : 'start'} fontSize={11} fontWeight={600} fill="rgb(var(--ink-2))">
          {text}
        </text>
      );
    }
    const neg = p.value < 0;
    // vertical clusters are narrow: drop the unit suffix (the card subtitle states it)
    const short = kind === 'rate' ? text.replace(/\/sq\.ft\.$/, '') : text;
    return (
      <text x={x + w / 2} y={neg ? Math.max(y, y + h) + 14 : Math.min(y, y + h) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="rgb(var(--ink-2))">
        {short}
      </text>
    );
  };

  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 20, right: horizontal ? 16 : 8, bottom: 0, left: 0 }}
          barGap={3}
          barCategoryGap={series.length > 1 ? '22%' : '30%'}
        >
          {!compact && <CartesianGrid stroke={AXIS.grid} strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />}
          {horizontal ? (
            <>
              <XAxis {...valueAxis} axisLine={false} hide={compact} />
              <YAxis type="category" dataKey="name" width={categoryWidth} tick={{ ...AXIS.tick, fill: 'rgb(var(--ink-2))' }} axisLine={AXIS.line} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ ...AXIS.tick, fill: 'rgb(var(--ink-2))' }} axisLine={AXIS.line} tickLine={false} interval={0} />
              <YAxis {...valueAxis} axisLine={false} width={compact ? 0 : 68} hide={compact} />
            </>
          )}
          {hasNegative && <ReferenceLine {...(horizontal ? { x: 0 } : { y: 0 })} stroke="rgb(var(--axis))" />}
          <Tooltip
            cursor={{ fill: 'rgb(var(--grid))', opacity: 0.5 }}
            content={({ active, payload, label: l }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, unknown>;
              return (
                <TooltipBox
                  title={String(l)}
                  kind={kind}
                  footer={(row.__footer as string) || undefined}
                  rows={series.map((s) => ({
                    color: (row.__color as string) ?? s.color,
                    label: s.label,
                    value: (row[s.key] as number | null) ?? null,
                  }))}
                />
              );
            }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              maxBarSize={horizontal ? 30 : compact ? 44 : 56}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              {...anim(i)}
              label={showLabels ? label : false}
            >
              {series.length === 1 && rows.map((r, i) => <Cell key={i} fill={(r.__color as string) ?? s.color} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
