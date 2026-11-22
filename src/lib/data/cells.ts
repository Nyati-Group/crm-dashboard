import type { NumCell, RawValue, TextCell } from '../schema';

/** Normalise a header / label for matching: case, curly quotes, dashes, whitespace. */
export function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
    .toLowerCase();
}

/** Text for display: same as the sheet, only whitespace trimmed and dashes/quotes made consistent. */
export function cleanText(s: unknown): string {
  return String(s ?? '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function colLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function cellRef(tab: string, colIndex: number, rowNumber: number): string {
  return `${tab}!${colLetter(colIndex)}${rowNumber}`;
}

const PLAIN_NUMBER = /^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/;
const PLAIN_PERCENT = /^[-+]?\d+(\.\d+)?%$/;
/** Indian grouping: 17,60,00,000 / 1,20,000 / 45,000 (last group 3 digits, then groups of 2). */
const INDIAN_GROUPED = /^[-+]?(\d{1,2},)?(\d{2},)*\d{1,2},\d{3}(\.\d+)?$/;
/** International grouping: 176,000,000 */
const INTL_GROUPED = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/;

/** True when text is a correctly digit-grouped number. "1,03" / "1,52" are NOT (last group must be 3 digits). */
export function isGroupedNumber(t: string): boolean {
  return INDIAN_GROUPED.test(t) || INTL_GROUPED.test(t);
}

/**
 * Read a numeric cell WITHOUT changing the figure:
 *  - real numbers pass through unchanged
 *  - text that is a plain number ("250"), or a correctly grouped number in Indian or
 *    international format ("17,60,00,000", "₹ 17,60,00,000"), is read as that exact number
 *    and marked `fromText` so the Data Quality page can list it
 *  - text that is a plain percentage ("120%", CSV exports) is read as the ratio 1.2
 *  - anything else (e.g. "1,03", "1,52", "TBD") is 'needs_clarification' and has NO value,
 *    so it is excluded from every total and comparison.
 */
export function toNumCell(raw: RawValue | undefined, ref: string): NumCell {
  const r: RawValue = raw === undefined ? null : raw;
  if (r === null) return { status: 'empty', value: null, raw: null, ref };
  if (typeof r === 'number') {
    return Number.isFinite(r)
      ? { status: 'ok', value: r, raw: r, ref }
      : { status: 'needs_clarification', value: null, raw: r, ref };
  }
  if (typeof r === 'boolean' || r instanceof Date) {
    return { status: 'needs_clarification', value: null, raw: r, ref };
  }
  const t = r.replace(/^₹\s*/, '').replace(/−/g, '-').trim();
  if (t === '') return { status: 'empty', value: null, raw: r, ref };
  if (PLAIN_NUMBER.test(t)) return { status: 'ok', value: Number(t), raw: r, ref, fromText: true };
  if (isGroupedNumber(t)) return { status: 'ok', value: Number(t.replace(/,/g, '')), raw: r, ref, fromText: true };
  if (PLAIN_PERCENT.test(t)) return { status: 'ok', value: Number(t.slice(0, -1)) / 100, raw: r, ref, fromText: true };
  return { status: 'needs_clarification', value: null, raw: r, ref };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toTextCell(raw: RawValue | undefined, ref: string): TextCell {
  const r: RawValue = raw === undefined ? null : raw;
  if (r === null) return { text: null, raw: null, ref };
  if (r instanceof Date) {
    // Dates are shown dd/mm/yyyy, the format the company sheet uses.
    return { text: `${pad(r.getUTCDate())}/${pad(r.getUTCMonth() + 1)}/${r.getUTCFullYear()}`, raw: r, ref };
  }
  const t = cleanText(r);
  return { text: t === '' ? null : t, raw: r, ref };
}

/** Is this numeric cell usable in a calculation? */
export function ok(c: NumCell | undefined | null): c is NumCell & { value: number } {
  return !!c && c.status === 'ok' && c.value !== null;
}

export function val(c: NumCell | undefined | null): number | null {
  return ok(c) ? c.value : null;
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Parse "As on 1st July 2026" (or "as on 01/07/2026") out of a header. Returns ISO yyyy-mm-dd. */
export function parseAsOn(text: string): { iso: string; label: string } | null {
  const m = /as on\s+(.+)$/i.exec(cleanText(text));
  if (!m) return null;
  const label = m[1].trim();
  const words = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/.exec(label);
  if (words) {
    const month = MONTHS.findIndex((mm) => mm.startsWith(words[2].toLowerCase().slice(0, 3)));
    if (month >= 0) return { iso: `${words[3]}-${pad(month + 1)}-${pad(Number(words[1]))}`, label };
  }
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(label);
  if (dmy) return { iso: `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`, label };
  return null;
}
