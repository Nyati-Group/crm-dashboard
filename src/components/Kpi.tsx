import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatValue, type ValueKind } from '@/lib/format';
import { STATUS_LABEL, statusFromRatio, type Comparison, type Status } from '@/lib/metrics';
import type { NumCell } from '@/lib/schema';
import { Ring } from './charts/Ring';
import { CountUp } from './motion';
import { Num, StatusBadge } from './ui';

function Delta({ value, kind }: { value: number | null; kind: ValueKind }) {
  if (value === null) return <span className="text-muted">—</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 font-semibold tabular', value > 0 ? 'text-goodInk' : value < 0 ? 'text-badInk' : 'text-ink2')}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {value > 0 ? '+' : ''}
      {formatValue(kind, value)}
    </span>
  );
}

function CardFrame({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="card-hover animate-rise relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-brand2 to-s3" />
      {children}
    </div>
  );
}

function Head({ label, icon, status, statusLabel }: { label: string; icon?: React.ReactNode; status: Status; statusLabel: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-medium text-ink2">
        {icon && <span className="rounded-lg bg-brand/10 p-1.5 text-brand [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        {label}
      </p>
      <StatusBadge status={status} label={statusLabel} />
    </div>
  );
}

function BigFigure({ cell, kind }: { cell: NumCell | undefined; kind: ValueKind }) {
  return (
    <p className="text-[26px] font-bold leading-tight tracking-tight text-ink tabular">
      {cell?.status === 'ok' && cell.value !== null ? <CountUp value={cell.value} kind={kind} /> : <Num cell={cell} kind={kind} />}
    </p>
  );
}

/** Ring (achieved as % of target) beside the target and the gap to it. */
function Gauge({ ratio, status, target, kind, variance, label }: { ratio: number | null; status: Status; target: NumCell | undefined; kind: ValueKind; variance: number | null; label: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <Ring ratio={ratio} status={status} label={`${label}: ${ratio === null ? 'no figure' : `${Math.round(ratio * 100)}% of target`}`} />
      <dl className="min-w-0 space-y-1.5 text-xs">
        <div>
          <dt className="text-muted">Target</dt>
          <dd className="text-sm font-semibold text-ink">
            <Num cell={target} kind={kind} />
          </dd>
        </div>
        <div>
          <dt className="text-muted">{variance !== null && variance >= 0 ? 'Ahead of target' : 'Short of target'}</dt>
          <dd className="text-sm">
            <Delta value={variance} kind={kind} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** KPI card: achieved (big), then a ring of achieved vs target, the target and the variance. */
export function KpiCard({ label, kind, cmp, icon, delay }: { label: string; kind: ValueKind; cmp: Comparison; icon?: React.ReactNode; delay?: number }) {
  const ratio = cmp.sheetPct?.status === 'ok' ? cmp.sheetPct.value : cmp.computedRatio;
  const variance = cmp.sheetVariance?.status === 'ok' ? cmp.sheetVariance.value : cmp.computedVariance;
  return (
    <CardFrame delay={delay}>
      <Head label={label} icon={icon} status={cmp.status} statusLabel={SHORT[cmp.status]} />
      <BigFigure cell={cmp.achieved} kind={kind} />
      <Gauge ratio={ratio} status={cmp.status} target={cmp.target} kind={kind} variance={variance} label={label} />
    </CardFrame>
  );
}

const SHORT: Record<Status, string> = { good: 'On track', warning: 'Slightly behind', critical: 'Behind', unknown: STATUS_LABEL.unknown };

/** Average-rate card: rates are compared, never summed. */
export function RateCard({ label, target, actual, icon, delay }: { label: string; target: NumCell | undefined; actual: NumCell | undefined; icon?: React.ReactNode; delay?: number }) {
  const t = target?.status === 'ok' ? target.value! : null;
  const a = actual?.status === 'ok' ? actual.value! : null;
  const diff = a !== null && t !== null ? a - t : null;
  const ratio = a !== null && t ? a / t : null;
  const status: Status = statusFromRatio(ratio);
  return (
    <CardFrame delay={delay}>
      <Head label={label} icon={icon} status={status} statusLabel={status === 'good' ? 'Above target' : status === 'unknown' ? STATUS_LABEL.unknown : 'Below target'} />
      <BigFigure cell={actual} kind="rate" />
      <Gauge ratio={ratio} status={status} target={target} kind="rate" variance={diff} label={label} />
    </CardFrame>
  );
}
