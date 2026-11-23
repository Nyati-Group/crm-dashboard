'use client';

import clsx from 'clsx';
import { formatPct } from '@/lib/format';
import type { Status } from '@/lib/metrics';
import { useInView, useReducedMotion } from '../motion';

const STROKE: Record<Status, string> = { good: 'text-good', warning: 'text-warn', critical: 'text-bad', unknown: 'text-neutral' };

/**
 * Radial gauge: achieved as a share of target. The first lap is 0–100%;
 * anything above 100% draws a second, lighter lap on top so over-achievement stays visible.
 * Sweeps in when it first scrolls into view.
 */
export function Ring({ ratio, status, size = 72, label }: { ratio: number | null; status: Status; size?: number; label: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const reduced = useReducedMotion();
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const lap1 = ratio === null ? 0 : Math.max(0, Math.min(1, ratio));
  const lap2 = ratio === null ? 0 : Math.max(0, Math.min(1, ratio - 1));
  const on = inView || reduced;
  const arc = (share: number, delay: number) => ({
    strokeDasharray: c,
    strokeDashoffset: on ? c * (1 - share) : c,
    transition: reduced ? 'none' : `stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1) ${delay}ms`,
  });
  return (
    <div ref={ref} className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-[rgb(var(--grid))]" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke="currentColor" className={STROKE[status]} style={arc(lap1, 200)} />
        {lap2 > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke="currentColor" className={clsx(STROKE[status], 'opacity-45')} style={arc(lap2, 1100)} />
        )}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[15px] font-bold tabular text-ink">{ratio === null ? '—' : formatPct(ratio)}</span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted">of target</span>
      </span>
    </div>
  );
}
