import { STATUS_THRESHOLDS } from './config';
import type { ValueKind } from './format';
import type { MetricKey, NumCell } from './schema';
import { val } from './data/cells';

export const METRIC_META: Record<MetricKey, { label: string; kind: ValueKind }> = {
  units: { label: 'Units', kind: 'units' },
  value: { label: 'Sales value', kind: 'inr' },
  rate: { label: 'Average rate', kind: 'rate' },
  area: { label: 'Area sold', kind: 'area' },
  collection: { label: 'Collection', kind: 'inr' },
};

/** Variance = Achieved − Budget/Target. null when either side is not a usable number. */
export function variance(achieved: number | null, target: number | null): number | null {
  if (achieved === null || target === null) return null;
  return achieved - target;
}

/** Achieved ÷ Target as a ratio (1.2 = 120%). null when target is 0 / missing. */
export function achievementRatio(achieved: number | null, target: number | null): number | null {
  if (achieved === null || target === null || target === 0) return null;
  return achieved / target;
}

export type Status = 'good' | 'warning' | 'critical' | 'unknown';

export function statusFromRatio(r: number | null): Status {
  if (r === null || !Number.isFinite(r)) return 'unknown';
  if (r >= STATUS_THRESHOLDS.good) return 'good';
  if (r >= STATUS_THRESHOLDS.warning) return 'warning';
  return 'critical';
}

export const STATUS_LABEL: Record<Status, string> = {
  good: 'On / above target',
  warning: 'Slightly behind',
  critical: 'Behind target',
  unknown: 'No status',
};

/** Negative outstanding = collected ahead of milestone = "Advance" (not an error). */
export function outstandingState(n: number | null): 'advance' | 'outstanding' | 'nil' | 'unknown' {
  if (n === null) return 'unknown';
  if (n < 0) return 'advance';
  if (n > 0) return 'outstanding';
  return 'nil';
}

export interface Comparison {
  target: NumCell;
  achieved: NumCell;
  sheetVariance?: NumCell;
  sheetPct?: NumCell;
  /** derived from the two figures - shown only as a cross-check, never replaces a sheet figure */
  computedVariance: number | null;
  computedRatio: number | null;
  /** ratio used for the status colour: the sheet's own %, else computed */
  statusRatio: number | null;
  status: Status;
}

export function compare(target: NumCell, achieved: NumCell, sheetVariance?: NumCell, sheetPct?: NumCell): Comparison {
  const t = val(target);
  const a = val(achieved);
  const computedRatio = achievementRatio(a, t);
  const statusRatio = val(sheetPct) ?? computedRatio;
  return {
    target,
    achieved,
    sheetVariance,
    sheetPct,
    computedVariance: variance(a, t),
    computedRatio,
    statusRatio,
    status: statusFromRatio(statusRatio),
  };
}
