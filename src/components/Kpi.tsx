import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatPct, formatValue, type ValueKind } from '@/lib/format';
import { STATUS_LABEL, statusFromRatio, type Comparison, type Status } from '@/lib/metrics';
import type { NumCell } from '@/lib/schema';
import { Num, StatusBadge } from './ui';

const FILL: Record<Status, string> = { good: 'bg-good', warning: 'bg-warn', critical: 'bg-bad', unknown: 'bg-neutral' };

/** Meter: share of target achieved, capped at the track; a tick marks 100%. */
function Meter({ ratio, status }: { ratio: number | null; status: Status }) {
  // The track spans 0–125% so over-achievement stays visible; the tick sits at 100%.
  const span = 1.25;
  const width = ratio === null ? 0 : Math.max(0, Math.min(span, ratio)) / span;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-brand/10" aria-hidden>
      <div className={clsx('h-full rounded-full', FILL[status])} style={{ width: `${width * 100}%` }} />
      <div className="absolute -top-1 h-3.5 w-px bg-ink2/70" style={{ left: `${(1 / span) * 100}%` }} />
    </div>
  );
}

function Delta({ value, kind }: { value: number | null; kind: ValueKind }) {
  if (value === null) return <span className="text-muted">—</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 font-semibold', value > 0 ? 'text-goodInk' : value < 0 ? 'text-badInk' : 'text-ink2')}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {value > 0 ? '+' : ''}
      {formatValue(kind, value)}
    </span>
  );
}

/** KPI card: Actual (big), Budget, % of budget meter, variance with direction arrow, status icon + label. */
export function KpiCard({
  label,
  kind,
  cmp,
  budgetLabel = 'Budget',
}: {
  label: string;
  kind: ValueKind;
  cmp: Comparison;
  budgetLabel?: string;
}) {
  const ratio = cmp.sheetPct?.status === 'ok' ? cmp.sheetPct.value : cmp.computedRatio;
  const variance = cmp.sheetVariance?.status === 'ok' ? cmp.sheetVariance.value : cmp.computedVariance;
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink2">{label}</p>
        <StatusBadge status={cmp.status} label={SHORT[cmp.status]} />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-tight text-ink">
          <Num cell={cmp.achieved} kind={kind} />
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {budgetLabel} <Num cell={cmp.target} kind={kind} className="font-medium text-ink2" />
        </p>
      </div>
      <Meter ratio={ratio} status={cmp.status} />
      <div className="flex items-center justify-between text-xs">
        <Delta value={variance} kind={kind} />
        <span className="font-semibold tabular text-ink">{ratio === null ? '—' : `${formatPct(ratio)} of ${budgetLabel.toLowerCase()}`}</span>
      </div>
    </div>
  );
}

const SHORT: Record<Status, string> = { good: 'On track', warning: 'Slightly behind', critical: 'Behind', unknown: STATUS_LABEL.unknown };

/** Average-rate card: rates are compared, never summed. */
export function RateCard({ label, budget, actual }: { label: string; budget: NumCell | undefined; actual: NumCell | undefined }) {
  const b = budget?.status === 'ok' ? budget.value! : null;
  const a = actual?.status === 'ok' ? actual.value! : null;
  const diff = a !== null && b !== null ? a - b : null;
  const ratio = a !== null && b ? a / b : null;
  const status: Status = statusFromRatio(ratio);
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink2">{label}</p>
        <StatusBadge status={status} label={status === 'good' ? 'Above budget' : status === 'unknown' ? STATUS_LABEL.unknown : 'Below budget'} />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-tight">
          <Num cell={actual} kind="rate" />
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Budget rate <Num cell={budget} kind="rate" className="font-medium text-ink2" />
        </p>
      </div>
      <Meter ratio={ratio} status={status} />
      <div className="flex items-center justify-between text-xs">
        <Delta value={diff} kind="rate" />
        <span className="font-semibold tabular text-ink">{ratio === null ? '—' : `${formatPct(ratio)} of budget`}</span>
      </div>
    </div>
  );
}

/** Plain figure tile (no target), e.g. Sold / Registered / Outstanding. */
export function StatTile({ label, children, sub, tone }: { label: string; children: React.ReactNode; sub?: React.ReactNode; tone?: 'brand' | 'good' | 'bad' }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={clsx('mt-1 text-2xl font-semibold tabular', tone === 'good' ? 'text-goodInk' : tone === 'bad' ? 'text-badInk' : 'text-ink')}>{children}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
