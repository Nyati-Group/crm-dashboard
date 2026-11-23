'use client';

import { useEffect, useRef, useState } from 'react';
import { formatExact, formatValue, type ValueKind } from '@/lib/format';

/** True when the user asked the OS for reduced motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Becomes true the first time the element scrolls into view (and stays true). */
export function useInView<T extends Element>(rootMargin = '0px 0px -8% 0px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);
  return [ref, inView] as const;
}

/** Recharts animation props shared by every chart (off for reduced motion). */
export function useChartAnimation() {
  const reduced = useReducedMotion();
  return (i = 0) => ({
    isAnimationActive: !reduced,
    animationBegin: i * 140,
    animationDuration: 900,
    animationEasing: 'ease-out' as const,
  });
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** A figure that counts up from zero when it first comes into view. Exact amount on hover. */
export function CountUp({ value, kind, className, duration = 1100 }: { value: number; kind: ValueKind; className?: string; duration?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!inView || reduced) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, value, duration]);
  // integers (units, area) count in whole steps
  const display = kind === 'units' || kind === 'area' || kind === 'rate' ? Math.round(shown) : shown;
  const exact = formatExact(kind, value);
  const final = formatValue(kind, value);
  return (
    <span ref={ref} className={className} title={exact !== final ? exact : undefined}>
      {shown === value ? final : formatValue(kind, display)}
    </span>
  );
}
