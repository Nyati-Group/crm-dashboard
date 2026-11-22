'use client';

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatExact } from '@/lib/format';
import { AXIS, axisFormat, niceScale } from './chartUtils';

export interface WaterfallStep {
  name: string;
  /** [low, high] of the floating bar */
  range: [number, number];
  value: number;
  color: string;
  label: string;
  note?: string;
  /** draw a dashed connector from this bar's end level to the next bar */
  connectTo?: number;
}

/**
 * Bridge chart: Total sold value | Due -> Collected (step down) -> Outstanding (result).
 * Floating bars with dashed connectors; a result below zero is an Advance (collected ahead of milestone).
 */
export function Waterfall({ steps, ariaLabel, height = 300 }: { steps: WaterfallStep[]; ariaLabel: string; height?: number }) {
  const scale = niceScale(steps.flatMap((s) => s.range), { headroom: 0.12 });
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={steps} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barCategoryGap="26%">
          <CartesianGrid stroke={AXIS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ ...AXIS.tick, fill: 'rgb(var(--ink-2))' }} axisLine={false} tickLine={false} interval={0} />
          <YAxis type="number" domain={scale.domain} ticks={scale.ticks} tickFormatter={axisFormat('inr')} tick={AXIS.tick} axisLine={false} tickLine={false} width={68} />
          <ReferenceLine y={0} stroke="rgb(var(--axis))" />
          {steps.map((s, i) =>
            s.connectTo !== undefined && steps[i + 1] ? (
              <ReferenceLine
                key={`c${i}`}
                segment={[
                  { x: s.name, y: s.connectTo },
                  { x: steps[i + 1].name, y: s.connectTo },
                ]}
                stroke="rgb(var(--muted))"
                strokeDasharray="4 3"
                ifOverflow="extendDomain"
              />
            ) : null,
          )}
          <Tooltip
            cursor={{ fill: 'rgb(var(--grid))', opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const s = payload[0].payload as WaterfallStep;
              return (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-ink">{s.name}</p>
                  <p className="tabular text-ink">{formatExact('inr', s.value)}</p>
                  {s.note && <p className="mt-1 max-w-[220px] text-muted">{s.note}</p>}
                </div>
              );
            }}
          />
          <Bar
            dataKey="range"
            maxBarSize={64}
            radius={3}
            isAnimationActive={false}
            label={(p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) => {
              const s = steps[p.index ?? 0];
              if (!s) return <g />;
              const y = Number(p.y);
              const h = Number(p.height);
              return (
                <text x={Number(p.x) + Number(p.width) / 2} y={Math.min(y, y + h) - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill="rgb(var(--ink))">
                  {s.label}
                </text>
              );
            }}
          >
            {steps.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
