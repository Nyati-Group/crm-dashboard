/** Business thresholds - change here, never in components. */
export const STATUS_THRESHOLDS = {
  /** ratio >= good -> on/above target (green) */
  good: 1.0,
  /** good > ratio >= warning -> close (amber); below -> red */
  warning: 0.8,
} as const;

/** A sheet "% Achieved" may differ from Achieved / Target by up to this (1 percentage point) before it is flagged. */
export const PCT_TOLERANCE = 0.01;

/** Sums and variances may differ by this many units of the value (rounding in the source). */
export const ABS_TOLERANCE = 0.5;

export function cacheTtlMs(): number {
  const s = Number(process.env.CACHE_TTL_SECONDS ?? 60);
  return (Number.isFinite(s) && s >= 0 ? s : 60) * 1000;
}
