import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, CircleHelp, Info, XCircle } from 'lucide-react';
import { formatExact, formatValue, type ValueKind } from '@/lib/format';
import { STATUS_LABEL, type Status } from '@/lib/metrics';
import type { NumCell } from '@/lib/schema';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={clsx('rounded-xl border border-line bg-surface shadow-sm', className)}>{children}</section>;
}

/** A numeric figure: compact display (₹ Cr / Lakh), exact amount on hover. Blank -> "—". */
export function Num({
  cell,
  kind,
  signed,
  className,
}: {
  cell: NumCell | undefined | null;
  kind: ValueKind;
  signed?: boolean;
  className?: string;
}) {
  if (!cell || cell.status !== 'ok' || cell.value === null) return <span className={clsx('text-muted', className)}>—</span>;
  return <Value kind={kind} value={cell.value} signed={signed} className={className} />;
}

export function Value({ kind, value, signed, className }: { kind: ValueKind; value: number; signed?: boolean; className?: string }) {
  const text = formatValue(kind, value);
  const shown = signed && value > 0 ? `+${text}` : text;
  const exact = formatExact(kind, value);
  return (
    <span className={clsx(exact !== text && 'exact-hover', className)} title={exact !== text ? exact : undefined}>
      {shown}
    </span>
  );
}

const STATUS_STYLE: Record<Status, { cls: string; Icon: typeof CheckCircle2 }> = {
  good: { cls: 'bg-good/10 text-goodInk ring-good/30', Icon: CheckCircle2 },
  warning: { cls: 'bg-warn/15 text-warnInk ring-warn/40', Icon: AlertTriangle },
  critical: { cls: 'bg-bad/10 text-badInk ring-bad/30', Icon: XCircle },
  unknown: { cls: 'bg-surface2 text-muted ring-line', Icon: CircleHelp },
};

/** Status is never colour alone: icon + text label. */
export function StatusBadge({ status, label, className }: { status: Status; label?: string; className?: string }) {
  const { cls, Icon } = STATUS_STYLE[status];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1', cls, className)}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface2/60 px-4 py-8 text-center">
      <Info aria-hidden className="h-5 w-5 text-muted" />
      <p className="text-sm font-medium text-ink2">{title}</p>
      {children && <div className="max-w-md text-xs text-muted">{children}</div>}
    </div>
  );
}

export function SectionHeading({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-2 first:mt-0">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Legend swatch + label (identity is never colour alone - the label is always present). */
export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink2">
      <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

export const SERIES = {
  actual: 'rgb(var(--series-1))',
  budget: 'rgb(var(--series-2))',
  third: 'rgb(var(--series-3))',
  neutral: 'rgb(var(--neutral))',
  critical: 'rgb(var(--bad))',
};
