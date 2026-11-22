/**
 * Display formatting only. Nothing here changes a stored value; it only renders it.
 * Money is whole INR, shown as ₹ Cr / Lakh (1 Cr = 1,00,00,000; 1 Lakh = 1,00,000)
 * with the full Indian-grouped rupee amount available for hover.
 */

export const MINUS = '−';
const CRORE = 1e7;
const LAKH = 1e5;

export type ValueKind = 'units' | 'inr' | 'area' | 'rate' | 'pct' | 'number';

/** 12345678 -> "1,23,45,678" (Indian digit grouping). */
export function formatIndianNumber(n: number, decimals = 0): string {
  const fixed = Math.abs(n).toFixed(decimals);
  // "-0" after rounding is shown as "0"
  const sign = n < 0 && Number(fixed) !== 0 ? MINUS : '';
  const [int, dec] = fixed.split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${sign}${grouped}${dec ? `.${dec}` : ''}`;
}

/** Full rupee amount: 176000000 -> "₹17,60,00,000". */
export function formatINRFull(n: number): string {
  const sign = n < 0 ? MINUS : '';
  const abs = Math.abs(n);
  return `${sign}₹${formatIndianNumber(abs, Number.isInteger(abs) ? 0 : 2)}`;
}

/** Compact rupees: 220000000 -> "₹22.00 Cr", 1250000 -> "₹12.50 Lakh", 45000 -> "₹45,000". */
export function formatINR(n: number, decimals = 2): string {
  const sign = n < 0 ? MINUS : '';
  const abs = Math.abs(n);
  if (abs >= CRORE) return `${sign}₹${(abs / CRORE).toFixed(decimals)} Cr`;
  if (abs >= LAKH) return `${sign}₹${(abs / LAKH).toFixed(decimals)} Lakh`;
  return formatINRFull(n);
}

/** Axis ticks: short, clean - "₹0", "₹50 Cr", "₹2.5 Cr", "₹40 L". */
export function formatINRAxis(n: number): string {
  const sign = n < 0 ? MINUS : '';
  const abs = Math.abs(n);
  const trim = (x: number) => String(Number(x.toFixed(1)));
  if (abs === 0) return '₹0';
  if (abs >= CRORE) return `${sign}₹${trim(abs / CRORE)} Cr`;
  if (abs >= LAKH) return `${sign}₹${trim(abs / LAKH)} L`;
  return `${sign}₹${formatIndianNumber(abs)}`;
}

/** Ratio -> percent text. 1.2 -> "120%", 0.665 -> "67%". Over 100% is valid. */
export function formatPct(ratio: number, digits = 0): string {
  const v = ratio * 100;
  const s = Math.abs(v).toFixed(digits);
  return `${v < 0 && Number(s) !== 0 ? MINUS : ''}${s}%`;
}

export function formatUnits(n: number): string {
  return formatIndianNumber(n, Number.isInteger(n) ? 0 : 2);
}

export function formatArea(n: number): string {
  return `${formatIndianNumber(n, Number.isInteger(n) ? 0 : 2)} sq.ft.`;
}

export function formatRate(n: number): string {
  const sign = n < 0 ? MINUS : '';
  return `${sign}₹${formatIndianNumber(Math.abs(n), Number.isInteger(n) ? 0 : 2)}/sq.ft.`;
}

export function formatValue(kind: ValueKind, n: number): string {
  switch (kind) {
    case 'inr':
      return formatINR(n);
    case 'pct':
      return formatPct(n);
    case 'area':
      return formatArea(n);
    case 'rate':
      return formatRate(n);
    case 'units':
      return formatUnits(n);
    default:
      return formatIndianNumber(n, Number.isInteger(n) ? 0 : 2);
  }
}

/** Exact value for hover/tooltips: full rupees for money, everything else unchanged. */
export function formatExact(kind: ValueKind, n: number): string {
  if (kind === 'inr') return formatINRFull(n);
  if (kind === 'pct') return `${formatPct(n, 2)} (stored ${n})`;
  return formatValue(kind, n);
}

/** Signed variance: "+9", "−32,180 sq.ft.", "+₹10.40 Cr". */
export function formatSigned(kind: ValueKind, n: number): string {
  if (n > 0) return `+${formatValue(kind, n)}`;
  return formatValue(kind, n);
}

/** "2026-07-01" -> "1 Jul 2026" */
export function formatDateISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}
