/**
 * Data-quality checks. They only REPORT: no rule changes, rounds or "corrects" a source figure.
 * Each rule is a pure function (Dataset -> Check[]) so it can be unit-tested on its own.
 */
import { ABS_TOLERANCE, PCT_TOLERANCE } from '../config';
import { norm, ok } from '../data/cells';
import { formatExact, formatPct, formatValue, type ValueKind } from '../format';
import { METRIC_META } from '../metrics';
import {
  ageingBuckets,
  ageingCategories,
  ageingGrandTotal,
  ageingTotal,
  paramRow,
  projectSegments,
  quarterBlocks,
  annualBlock,
  registrationAgeingRows,
} from '../selectors';
import { SEGMENT_LABEL, TAB, type Dataset, type MetricKey, type NumCell, type ParamTable, type SegmentColumn } from '../schema';
import type { ChartId, Check, CheckStatus, RuleId, Severity } from './types';

type NewCheck = Omit<Check, 'id'>;
const fmt = (kind: ValueKind, n: number) => formatValue(kind, n);
/** Format two values that differ; if the compact forms look identical (₹56.30 Cr vs ₹56.30 Cr), show exact amounts. */
function fmtPair(kind: ValueKind, a: number, b: number): [string, string, (n: number) => string] {
  const f = fmt(kind, a) === fmt(kind, b) ? (n: number) => formatExact(kind, n) : (n: number) => fmt(kind, n);
  return [f(a), f(b), f];
}
/** End a sentence with exactly one period ("sq.ft." already has one). */
const end = (s: string) => (s.endsWith('.') ? s : `${s}.`);
const near = (a: number, b: number, tol = ABS_TOLERANCE) => Math.abs(a - b) <= tol;
const rawText = (c: NumCell) => (c.raw === null ? 'blank' : `"${String(c.raw)}"`);

function mk(
  rule: RuleId,
  status: CheckStatus,
  severity: Severity,
  tab: string,
  subject: string,
  message: string,
  cells: (NumCell | string | undefined)[],
  affects: ChartId[],
): NewCheck {
  return {
    rule,
    status,
    severity,
    tab,
    subject,
    message,
    cells: cells.filter(Boolean).map((c) => (typeof c === 'string' ? c : (c as NumCell).ref)),
    affects,
  };
}

function segLabel(s: SegmentColumn) {
  return s.project ? `${s.project} (${SEGMENT_LABEL[s.segment]})` : SEGMENT_LABEL[s.segment];
}

/** Why a comparison can't run: the first input that is not a usable number. */
function blocker(cells: Record<string, NumCell | undefined>): string | null {
  for (const [name, c] of Object.entries(cells)) {
    if (!c || c.status === 'empty') return `${name} is blank${c ? ` (${c.ref})` : ''}`;
    if (c.status === 'needs_clarification') return `${name} needs clarification (${c.ref} = ${rawText(c)})`;
  }
  return null;
}

// ------------------------------------------------------------------ generic comparisons

interface CmpArgs {
  tab: string;
  subject: string;
  kind: ValueKind;
  target: NumCell | undefined;
  achieved: NumCell | undefined;
  affects: ChartId[];
}

export function checkVariance(a: CmpArgs & { sheet: NumCell | undefined }): NewCheck | null {
  const { sheet } = a;
  if (!sheet || sheet.status === 'empty') return null; // nothing stated, nothing to check
  if (sheet.status === 'needs_clarification') return null; // reported by the non-numeric rule
  const why = blocker({ Budget: a.target, Achieved: a.achieved });
  if (why) {
    return mk('variance', 'skipped', 'info', a.tab, a.subject, `Can't check the variance: ${why}.`, [sheet, a.target, a.achieved], a.affects);
  }
  const t = a.target!.value!;
  const ach = a.achieved!.value!;
  const expected = ach - t;
  const s = sheet.value!;
  if (near(s, expected)) {
    return mk('variance', 'pass', 'info', a.tab, a.subject, end(`Variance ${fmt(a.kind, s)} = ${fmt(a.kind, ach)} − ${fmt(a.kind, t)}`), [sheet], a.affects);
  }
  if (expected !== 0 && near(s, -expected)) {
    return mk(
      'variance',
      'fail',
      'warning',
      a.tab,
      a.subject,
      `Sign reversed: the sheet shows ${fmt(a.kind, s)}, but Achieved − Budget = ${fmt(a.kind, ach)} − ${fmt(a.kind, t)} = ${fmt(a.kind, expected)}. The sheet appears to use Budget − Achieved.`,
      [sheet, a.target, a.achieved],
      a.affects,
    );
  }
  const [sTxt, eTxt, f] = fmtPair(a.kind, s, expected);
  return mk(
    'variance',
    'fail',
    'warning',
    a.tab,
    a.subject,
    end(`The sheet shows ${sTxt}, but Achieved − Budget = ${f(ach)} − ${f(t)} = ${eTxt}`),
    [sheet, a.target, a.achieved],
    a.affects,
  );
}

export function checkPct(a: CmpArgs & { sheet: NumCell | undefined }): NewCheck | null {
  const { sheet } = a;
  if (!sheet || sheet.status === 'empty' || sheet.status === 'needs_clarification') return null;
  const why = blocker({ Target: a.target, Achieved: a.achieved });
  if (why) {
    return mk('pct-ratio', 'skipped', 'info', a.tab, a.subject, `Can't check ${formatPct(sheet.value!)}: ${why}.`, [sheet, a.target, a.achieved], a.affects);
  }
  const t = a.target!.value!;
  const ach = a.achieved!.value!;
  if (t === 0) {
    return mk('pct-ratio', 'skipped', 'info', a.tab, a.subject, `Can't check ${formatPct(sheet.value!)}: the target is 0.`, [sheet, a.target], a.affects);
  }
  const ratio = ach / t;
  const s = sheet.value!;
  if (Math.abs(s - ratio) <= PCT_TOLERANCE + 1e-9) {
    return mk('pct-ratio', 'pass', 'info', a.tab, a.subject, `${formatPct(s)} matches ${fmt(a.kind, ach)} ÷ ${fmt(a.kind, t)} = ${formatPct(ratio, 1)}.`, [sheet], a.affects);
  }
  return mk(
    'pct-ratio',
    'fail',
    'warning',
    a.tab,
    a.subject,
    `The sheet shows ${formatPct(s)}, but Achieved ÷ Target = ${fmt(a.kind, ach)} ÷ ${fmt(a.kind, t)} = ${formatPct(ratio, 1)}.`,
    [sheet, a.target, a.achieved],
    a.affects,
  );
}

/** total == sum(parts). Blank parts count as 0 (stated in the message); unclear parts skip the check. */
export function checkSum(a: {
  rule: RuleId;
  tab: string;
  subject: string;
  kind: ValueKind;
  total: NumCell | undefined;
  parts: { label: string; cell: NumCell | undefined }[];
  affects: ChartId[];
  failSeverity?: Severity;
  note?: string;
  totalLabel?: string;
}): NewCheck | null {
  const totalLabel = a.totalLabel ?? 'Total';
  if (!a.total || a.total.status === 'needs_clarification') return null;
  const unclear = a.parts.find((p) => p.cell?.status === 'needs_clarification');
  if (a.total.status === 'empty') {
    if (a.parts.every((p) => !p.cell || p.cell.status === 'empty')) return null;
    return mk(a.rule, 'skipped', 'info', a.tab, a.subject, `Can't check: ${totalLabel} is blank (${a.total.ref}).`, [a.total], a.affects);
  }
  if (unclear) {
    return mk(a.rule, 'skipped', 'info', a.tab, a.subject, `Can't check: ${unclear.label} needs clarification (${unclear.cell!.ref} = ${rawText(unclear.cell!)}).`, [a.total, unclear.cell], a.affects);
  }
  const present = a.parts.filter((p) => ok(p.cell));
  if (present.length === 0) return null;
  const sum = present.reduce((s, p) => s + p.cell!.value!, 0);
  const blanks = a.parts.filter((p) => !ok(p.cell)).map((p) => p.label);
  const blankNote = blanks.length ? ` (${blanks.join(', ')} blank, counted as 0)` : '';
  if (near(a.total.value!, sum)) {
    const expr = present.map((p) => `${p.label} ${fmt(a.kind, p.cell!.value!)}`).join(' + ');
    return mk(a.rule, 'pass', 'info', a.tab, a.subject, end(`${totalLabel} ${fmt(a.kind, a.total.value!)} = ${expr}${blankNote}`), [a.total], a.affects);
  }
  const [totalTxt, sumTxt, f] = fmtPair(a.kind, a.total.value!, sum);
  const expr = present.map((p) => `${p.label} ${f(p.cell!.value!)}`).join(' + ');
  const rhs =
    present.length === 1
      ? `${present[0].label} is ${sumTxt}${blankNote}`
      : `${expr} = ${sumTxt}${blankNote}`;
  return mk(
    a.rule,
    'fail',
    a.failSeverity ?? 'warning',
    a.tab,
    a.subject,
    `${end(`${totalLabel} is ${totalTxt}, but ${rhs}`)}${a.note ? ` ${a.note}` : ''}`,
    [a.total, ...present.map((p) => p.cell)],
    a.affects,
  );
}

function push(out: NewCheck[], c: NewCheck | null) {
  if (c) out.push(c);
}

// ------------------------------------------------------------------ rules

const SALES_METRICS: MetricKey[] = ['units', 'value', 'area', 'collection', 'rate'];

function tab1Affects(kind: 'quarter' | 'annual'): ChartId[] {
  return ['overview.kpis', kind === 'annual' ? 'overview.annual' : 'overview.quarter'];
}

/** Variance and % rows of 1_Sales_Collection. All-zero duplicate blocks are covered by the zero-block rule instead. */
export function ruleSalesCollection(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  for (const b of ds.salesBlocks) {
    if (b.allZero) continue;
    const { budget, actual, variance, pct } = b.rows;
    for (const m of SALES_METRICS) {
      const base = {
        tab: TAB.salesCollection,
        subject: `${b.section} · ${METRIC_META[m].label}`,
        kind: METRIC_META[m].kind,
        target: budget?.metrics[m],
        achieved: actual?.metrics[m],
        affects: tab1Affects(b.kind),
      };
      push(out, checkVariance({ ...base, sheet: variance?.metrics[m] }));
      push(out, checkPct({ ...base, sheet: pct?.metrics[m] }));
    }
  }
  return out;
}

export function ruleZeroBlocks(ds: Dataset): NewCheck[] {
  return ds.salesBlocks
    .filter((b) => b.allZero)
    .map((b) => {
      const rows = Object.values(b.rows).map((r) => r!.rowNumber);
      const range = rows.length ? `rows ${Math.min(...rows)}–${Math.max(...rows)}` : 'no rows';
      return mk(
        'zero-block',
        'fail',
        'info',
        TAB.salesCollection,
        b.section,
        `Every value in this block is 0 (${range}). It looks like an unused duplicate, so it is hidden on the Overview.`,
        rows.map((r) => `${TAB.salesCollection}!A${r}`),
        ['overview.quarter'],
      );
    });
}

export function ruleAnnualVsQuarter(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const annual = annualBlock(ds);
  const quarters = quarterBlocks(ds).filter((q) => !q.allZero);
  if (!annual?.rows.actual || quarters.length === 0) return out;
  for (const m of ['units', 'value', 'area', 'collection'] as MetricKey[]) {
    const kind = METRIC_META[m].kind;
    const a = annual.rows.actual.metrics[m];
    const qs = quarters.map((q) => q.rows.actual?.metrics[m]);
    if (!ok(a) || qs.some((q) => !ok(q))) continue;
    const qSum = qs.reduce((s, q) => s + q!.value!, 0);
    const subject = `${annual.section} · ${METRIC_META[m].label}`;
    const qLabel = quarters.map((q) => q.section).join(' + ');
    if (a.value! + ABS_TOLERANCE < qSum) {
      out.push(
        mk(
          'annual-vs-quarter',
          'fail',
          'warning',
          TAB.salesCollection,
          subject,
          `Annual achieved (${fmt(kind, a.value!)}) is lower than ${qLabel} actual (${fmt(kind, qSum)}). The annual figure should include the quarter.`,
          [a, ...qs],
          ['overview.kpis', 'overview.annual'],
        ),
      );
    } else {
      out.push(mk('annual-vs-quarter', 'pass', 'info', TAB.salesCollection, subject, `Annual achieved ${fmt(kind, a.value!)} ≥ ${qLabel} actual ${fmt(kind, qSum)}.`, [a], ['overview.annual']));
    }
  }
  return out;
}

export function ruleProjectSales(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const affects: ChartId[] = ['sales.chart', 'sales.table', 'overview.health'];
  for (const r of ds.projectSales) {
    const u = { tab: TAB.projectSales, kind: 'units' as const, target: r.targetUnits, achieved: r.achievedUnits, affects };
    const v = { tab: TAB.projectSales, kind: 'inr' as const, target: r.targetValue, achieved: r.achievedValue, affects };
    push(out, checkVariance({ ...u, subject: `${r.project} · Variance Units`, sheet: r.varianceUnits }));
    push(out, checkPct({ ...u, subject: `${r.project} · Units %`, sheet: r.unitsPct }));
    push(out, checkVariance({ ...v, subject: `${r.project} · Variance Value`, sheet: r.varianceValue }));
    push(out, checkPct({ ...v, subject: `${r.project} · Value %`, sheet: r.valuePct }));
  }
  return out;
}

const TOTAL_NOTE = 'The TOTAL row probably includes projects that are not listed in this sheet.';

export function ruleRegistration(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const affects: ChartId[] = ['registration.byProject', 'overview.health'];
  for (const r of ds.registration) {
    push(
      out,
      checkSum({
        rule: 'registration-sum',
        tab: TAB.registration,
        subject: `${r.project} · Registered + Unregistered = Sold`,
        kind: 'units',
        total: r.sold,
        totalLabel: 'Sold',
        parts: [
          { label: 'Registered', cell: r.registered },
          { label: 'Unregistered', cell: r.unregistered },
        ],
        affects,
      }),
    );
  }
  const total = ds.registration.find((r) => r.isTotal);
  const projects = ds.registration.filter((r) => !r.isTotal);
  if (total) {
    for (const f of ['sold', 'registered', 'unregistered'] as const) {
      push(
        out,
        checkSum({
          rule: 'total-row',
          tab: TAB.registration,
          subject: `TOTAL row · ${f[0].toUpperCase()}${f.slice(1)}`,
          kind: 'units',
          total: total[f],
          totalLabel: 'TOTAL',
          parts: projects.map((p) => ({ label: p.project, cell: p[f] })),
          affects,
          note: TOTAL_NOTE,
        }),
      );
    }
  }
  return out;
}

export function ruleCollection(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const affects: ChartId[] = ['collection.byProject', 'overview.health'];
  for (const r of ds.collection) {
    const base = { tab: TAB.collection, kind: 'inr' as const, target: r.budget, achieved: r.achieved, affects };
    push(out, checkVariance({ ...base, subject: `${r.project} · Variance`, sheet: r.variance }));
    push(out, checkPct({ ...base, subject: `${r.project} · %`, sheet: r.pct }));
  }
  const total = ds.collection.find((r) => r.isTotal);
  const projects = ds.collection.filter((r) => !r.isTotal);
  if (total) {
    for (const f of ['budget', 'achieved', 'variance'] as const) {
      push(
        out,
        checkSum({
          rule: 'total-row',
          tab: TAB.collection,
          subject: `TOTAL row · ${f[0].toUpperCase()}${f.slice(1)}`,
          kind: 'inr',
          total: total[f],
          totalLabel: 'TOTAL',
          parts: projects.map((p) => ({ label: p.project, cell: p[f] })),
          affects,
          note: TOTAL_NOTE,
        }),
      );
    }
  }
  return out;
}

/** 3a Sold vs 5 "Total Sold up to date" (project = sum of its segments), and 6 Sold vs 5 per segment. */
export function ruleSoldCrossTab(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const t5 = ds.projectSummary;
  const sold5 = paramRow(t5, 'soldToDate');
  if (!sold5) return out;
  for (const r of ds.registration.filter((x) => !x.isTotal)) {
    const segs = projectSegments(t5.segments, r.project);
    const subject = `${r.project} · Sold (3a) vs Total Sold (5)`;
    if (segs.length === 0) {
      out.push(mk('sold-cross-tab', 'skipped', 'info', TAB.registration, subject, `"${r.project}" has no columns in ${TAB.projectSummary}.`, [r.sold], ['registration.byProject']));
      continue;
    }
    push(
      out,
      checkSum({
        rule: 'sold-cross-tab',
        tab: TAB.registration,
        subject,
        kind: 'units',
        total: r.sold,
        totalLabel: `Sold in ${TAB.registration}`,
        parts: segs.map((s) => ({ label: `${SEGMENT_LABEL[s.segment]} (${TAB.projectSummary})`, cell: sold5.nums[s.key] })),
        affects: ['registration.byProject', 'info.summary'],
      }),
    );
  }
  const sold6 = paramRow(ds.registrationSummary, 'sold');
  for (const s of ds.registrationSummary.segments) {
    const c5 = sold5.nums[s.key];
    if (!sold6 || !c5) continue;
    push(
      out,
      checkSum({
        rule: 'sold-cross-tab',
        tab: TAB.registrationSummary,
        subject: `${segLabel(s)} · Sold (6) vs Total Sold (5)`,
        kind: 'units',
        total: sold6.nums[s.key],
        totalLabel: `Total Sold Units in ${TAB.registrationSummary}`,
        parts: [{ label: `Total Sold up to date (${TAB.projectSummary})`, cell: c5 }],
        affects: ['registration.ageing', 'info.summary'],
      }),
    );
  }
  return out;
}

function totalColumnChecks(t: ParamTable, rowKeys: string[] | 'all', affects: ChartId[]): NewCheck[] {
  const out: NewCheck[] = [];
  for (const total of t.segments.filter((s) => s.segment === 'total')) {
    const parts = t.segments.filter((s) => s.segment !== 'total' && (total.project === null || s.project === total.project));
    if (parts.length === 0) continue;
    for (const row of t.rows) {
      if (rowKeys !== 'all' && (!row.key || !rowKeys.includes(row.key))) continue;
      push(
        out,
        checkSum({
          rule: 'total-column',
          tab: t.tab,
          subject: `${row.parameter} · ${total.header}`,
          kind: /area/i.test(row.parameter) ? 'area' : /rate/i.test(row.parameter) ? 'rate' : 'units',
          total: row.nums[total.key],
          totalLabel: `"${total.header}"`,
          parts: parts.map((p) => ({ label: SEGMENT_LABEL[p.segment], cell: row.nums[p.key] })),
          affects,
          note: 'The Total column probably covers projects that are not in this sheet.',
        }),
      );
    }
  }
  return out;
}

export function ruleTotalColumns(ds: Dataset): NewCheck[] {
  // Average rates are not additive, so they are never summed.
  const t5Rows = ds.projectSummary.rows.filter((r) => !/rate/i.test(r.parameter));
  return [
    ...totalColumnChecks(ds.generalInfo, ['totalUnits', 'saleableArea'], ['info.general']),
    ...totalColumnChecks({ ...ds.projectSummary, rows: t5Rows }, 'all', ['info.summary']),
  ];
}

/** Tab 5: For Sale = Total − Land Owner − Premium; Unsold = For Sale − Sold; Variance rows = Achieved − Budget. */
export function ruleSummaryArithmetic(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const t = ds.projectSummary;
  const r = (k: string) => paramRow(t, k);
  const affects: ChartId[] = ['info.summary'];
  for (const s of t.segments) {
    const n = (k: string) => r(k)?.nums[s.key];
    const subj = (x: string) => `${segLabel(s)} · ${x}`;
    const total = n('totalUnits');
    const lo = n('landOwnerUnits');
    const prem = n('premiumBlocked');
    const forSale = n('unitsForSale');
    const sold = n('soldToDate');
    const unsold = n('unsold');
    if (ok(total) && ok(forSale) && ok(lo) && ok(prem)) {
      const exp = total.value - lo.value - prem.value;
      out.push(
        near(forSale.value, exp)
          ? mk('summary-arithmetic', 'pass', 'info', t.tab, subj('Units for Sale'), `${forSale.value} = ${total.value} − ${lo.value} − ${prem.value}.`, [forSale], affects)
          : mk('summary-arithmetic', 'fail', 'warning', t.tab, subj('Units for Sale'), `Units for Sale is ${forSale.value}, but Total − Land Owner − Premium = ${total.value} − ${lo.value} − ${prem.value} = ${exp}.`, [forSale, total, lo, prem], affects),
      );
    }
    if (ok(forSale) && ok(sold) && ok(unsold)) {
      const exp = forSale.value - sold.value;
      out.push(
        near(unsold.value, exp)
          ? mk('summary-arithmetic', 'pass', 'info', t.tab, subj('Unsold Units'), `${unsold.value} = ${forSale.value} − ${sold.value}.`, [unsold], affects)
          : mk('summary-arithmetic', 'fail', 'warning', t.tab, subj('Unsold Units'), `Unsold is ${unsold.value}, but For Sale − Sold = ${forSale.value} − ${sold.value} = ${exp}.`, [unsold, forSale, sold], affects),
      );
    }
    // Variance rows are unlabeled duplicates ("Variance"), so pair each with the Budget/Achieved rows just above it.
    const pairs: [string, string, string][] = [
      ['budgetToDate', 'achievedToDate', 'Variance (up to date)'],
      ['budgetQ', 'achievedQ', 'Variance (for the Q)'],
    ];
    for (const [bk, ak, label] of pairs) {
      const ach = r(ak);
      if (!ach) continue;
      const idx = t.rows.indexOf(ach);
      const vRow = t.rows[idx + 1];
      if (!vRow || norm(vRow.parameter) !== 'variance') continue;
      push(
        out,
        checkVariance({
          tab: t.tab,
          subject: subj(label),
          kind: 'units',
          target: r(bk)?.nums[s.key],
          achieved: ach.nums[s.key],
          sheet: vRow.nums[s.key],
          affects,
        }),
      );
    }
  }
  // The variance rule id is reused above; re-label as summary arithmetic for grouping.
  return out.map((c) => (c.rule === 'variance' ? { ...c, rule: 'summary-arithmetic' as const } : c));
}

export function ruleRegistrationSummary(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const t = ds.registrationSummary;
  const buckets = registrationAgeingRows(t);
  const affects: ChartId[] = ['registration.ageing'];
  for (const s of t.segments) {
    const n = (k: string) => paramRow(t, k)?.nums[s.key];
    push(
      out,
      checkSum({
        rule: 'registration-summary',
        tab: t.tab,
        subject: `${segLabel(s)} · Registered + Unregistered = Sold`,
        kind: 'units',
        total: n('sold'),
        totalLabel: 'Total Sold Units',
        parts: [
          { label: 'Registered', cell: n('registered') },
          { label: 'Unregistered', cell: n('unregistered') },
        ],
        affects,
      }),
    );
    if (buckets.length) {
      push(
        out,
        checkSum({
          rule: 'registration-summary',
          tab: t.tab,
          subject: `${segLabel(s)} · Ageing buckets = Unregistered`,
          kind: 'units',
          total: n('unregistered'),
          totalLabel: 'Total Unregistered Units',
          parts: buckets.map((b) => ({ label: b.label, cell: b.row.nums[s.key] })),
          affects,
        }),
      );
    }
  }
  return out;
}

export function ruleOutstanding(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const t = ds.collectionSummary;
  const affects: ChartId[] = ['collection.waterfall'];
  for (const s of t.segments) {
    const n = (k: string) => paramRow(t, k)?.nums[s.key];
    const due = n('due');
    const col = n('collected');
    const os = n('outstanding');
    if (ok(due) && ok(col) && ok(os)) {
      const exp = due.value - col.value;
      out.push(
        near(os.value, exp)
          ? mk('outstanding-arithmetic', 'pass', 'info', t.tab, `${segLabel(s)} · Outstanding = Due − Collected`, `Outstanding ${fmt('inr', os.value)} = ${fmt('inr', due.value)} − ${fmt('inr', col.value)}${os.value < 0 ? ' (negative = advance collected ahead of milestone)' : ''}.`, [os], affects)
          : mk('outstanding-arithmetic', 'fail', 'warning', t.tab, `${segLabel(s)} · Outstanding = Due − Collected`, `Outstanding is ${fmt('inr', os.value)}, but Due − Collected = ${fmt('inr', due.value)} − ${fmt('inr', col.value)} = ${fmt('inr', exp)}.`, [os, due, col], affects),
      );
    }
    push(
      out,
      checkSum({
        rule: 'outstanding-arithmetic',
        tab: t.tab,
        subject: `${segLabel(s)} · Registered + Unregistered O/s = Outstanding`,
        kind: 'inr',
        total: os,
        totalLabel: 'Total Outstanding',
        parts: [
          { label: 'Registered O/s', cell: n('registeredOs') },
          { label: 'Unregistered O/s', cell: n('unregisteredOs') },
        ],
        affects,
      }),
    );
  }
  return out;
}

export function ruleOutstandingCrossTab(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const t7 = ds.collectionSummary;
  const rows = ds.ageing.rows;
  const grand = ageingGrandTotal(rows);
  const reg = ageingTotal(rows, 'Registered');
  const unreg = ageingTotal(rows, 'Unregistered');
  const affects: ChartId[] = ['collection.waterfall', 'collection.ageing'];
  for (const s of t7.segments) {
    if (!ds.ageing.segments.some((a) => a.key === s.key)) continue;
    const pairs: [string, typeof grand, string][] = [
      ['outstanding', grand, 'Grand Total'],
      ['registeredOs', reg, 'Registered Total'],
      ['unregisteredOs', unreg, 'Unregistered Total'],
    ];
    for (const [k, row8, label8] of pairs) {
      const c7 = paramRow(t7, k)?.nums[s.key];
      const c8 = row8?.cells[s.key];
      if (!c7 || !c8 || !ok(c7) || !ok(c8)) continue;
      push(
        out,
        checkSum({
          rule: 'outstanding-cross-tab',
          tab: t7.tab,
          subject: `${segLabel(s)} · ${paramRow(t7, k)!.parameter} (7) vs ${label8} (8)`,
          kind: 'inr',
          total: c7,
          totalLabel: `${paramRow(t7, k)!.parameter} in ${TAB.collectionSummary}`,
          parts: [{ label: `${label8} in ${TAB.ageing}`, cell: c8 }],
          affects,
        }),
      );
    }
  }
  return out;
}

export function ruleAgeingSums(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const { rows, segments } = ds.ageing;
  const affects: ChartId[] = ['collection.ageing'];
  const cats = ageingCategories(rows);
  for (const s of segments) {
    for (const cat of cats) {
      const total = ageingTotal(rows, cat);
      if (!total) continue;
      push(
        out,
        checkSum({
          rule: 'ageing-sum',
          tab: TAB.ageing,
          subject: `${segLabel(s)} · ${cat} buckets = ${cat} Total`,
          kind: 'inr',
          total: total.cells[s.key],
          totalLabel: `${cat} Total`,
          parts: ageingBuckets(rows, cat).map((b) => ({ label: b.bucket, cell: b.cells[s.key] })),
          affects,
        }),
      );
    }
    const grand = ageingGrandTotal(rows);
    if (grand) {
      push(
        out,
        checkSum({
          rule: 'ageing-sum',
          tab: TAB.ageing,
          subject: `${segLabel(s)} · Grand Total = category totals`,
          kind: 'inr',
          total: grand.cells[s.key],
          totalLabel: 'Grand Total',
          parts: cats.map((c) => ({ label: `${c} Total`, cell: ageingTotal(rows, c)?.cells[s.key] })),
          affects,
        }),
      );
    }
  }
  return out;
}

export function ruleSegmentCoverage(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const reference = ds.projectSummary.segments.filter((s) => s.segment !== 'total');
  const tabs: [string, SegmentColumn[], ChartId[]][] = [
    [TAB.registrationSummary, ds.registrationSummary.segments, ['registration.ageing']],
    [TAB.collectionSummary, ds.collectionSummary.segments, ['collection.waterfall']],
    [TAB.ageing, ds.ageing.segments, ['collection.ageing']],
  ];
  for (const [tab, segs, affects] of tabs) {
    for (const ref of reference) {
      if (segs.some((s) => s.key === ref.key)) continue;
      out.push(
        mk(
          'segment-coverage',
          'fail',
          'info',
          tab,
          segLabel(ref),
          `Tab "${tab}" has no "${segLabel(ref)}" column, so ${SEGMENT_LABEL[ref.segment]} figures for this tab are not in the source.`,
          [],
          affects,
        ),
      );
    }
  }
  return out;
}

/** Text cells where a number is expected ("Needs clarification"), plus numbers typed as text (info). */
export function ruleNonNumeric(ds: Dataset): NewCheck[] {
  const out: NewCheck[] = [];
  const unclear: { cell: NumCell; context: string; tab: string; affects: ChartId[] }[] = [];
  const asText: { cell: NumCell; tab: string }[] = [];
  const visit = (cell: NumCell | undefined, tab: string, context: string, affects: ChartId[]) => {
    if (!cell) return;
    if (cell.status === 'needs_clarification') unclear.push({ cell, context, tab, affects });
    else if (cell.fromText) asText.push({ cell, tab });
  };
  for (const b of ds.salesBlocks) {
    for (const r of Object.values(b.rows)) {
      for (const m of SALES_METRICS) visit(r!.metrics[m], TAB.salesCollection, `${b.section} · ${r!.parameter} · ${METRIC_META[m].label}`, tab1Affects(b.kind));
    }
  }
  for (const r of ds.projectSales) {
    for (const [k, c] of Object.entries(r)) if (typeof c === 'object' && c && 'status' in c) visit(c as NumCell, TAB.projectSales, `${r.project} · ${k}`, ['sales.chart', 'sales.table']);
  }
  for (const r of ds.registration) {
    for (const k of ['sold', 'registered', 'unregistered'] as const) visit(r[k], TAB.registration, `${r.project} · ${k}`, ['registration.byProject']);
  }
  for (const r of ds.collection) {
    for (const k of ['budget', 'achieved', 'variance', 'pct'] as const) visit(r[k], TAB.collection, `${r.project} · ${k}`, ['collection.byProject']);
  }
  const wide: [ParamTable, string[] | 'all', ChartId[]][] = [
    [ds.generalInfo, ['totalUnits', 'saleableArea'], ['info.general']],
    [ds.projectSummary, 'all', ['info.summary']],
    [ds.registrationSummary, 'all', ['registration.ageing']],
    [ds.collectionSummary, 'all', ['collection.waterfall']],
  ];
  for (const [t, keys, affects] of wide) {
    for (const row of t.rows) {
      if (keys !== 'all' && (!row.key || !keys.includes(row.key))) continue;
      for (const s of t.segments) visit(row.nums[s.key], t.tab, `${row.parameter} · ${s.header}`, affects);
    }
  }
  for (const row of ds.ageing.rows) {
    for (const s of ds.ageing.segments) visit(row.cells[s.key], TAB.ageing, `${row.category} · ${row.bucket} · ${s.header}`, ['collection.ageing']);
  }

  for (const u of unclear) {
    out.push(
      mk(
        'non-numeric',
        'fail',
        'error',
        u.tab,
        u.context,
        `Needs clarification: the cell holds ${rawText(u.cell)}, which is not a complete number (it looks truncated). It is excluded from totals and comparisons.`,
        [u.cell],
        u.affects,
      ),
    );
  }
  const byTab = new Map<string, NumCell[]>();
  for (const t of asText) byTab.set(t.tab, [...(byTab.get(t.tab) ?? []), t.cell]);
  for (const [tab, cells] of byTab) {
    const ex = cells[0];
    out.push(
      mk(
        'non-numeric',
        'fail',
        'info',
        tab,
        `${cells.length} number${cells.length === 1 ? '' : 's'} stored as text`,
        `These cells hold numbers typed as text (e.g. ${ex.ref} = ${rawText(ex)}). They were read using their digit grouping, without changing the figure. Storing them as number cells in the sheet is recommended.`,
        cells,
        [],
      ),
    );
  }
  return out;
}

export const ALL_RULES: ((ds: Dataset) => NewCheck[])[] = [
  ruleNonNumeric,
  ruleRegistration,
  ruleSoldCrossTab,
  ruleTotalColumns,
  ruleSalesCollection,
  ruleProjectSales,
  ruleCollection,
  ruleZeroBlocks,
  ruleAnnualVsQuarter,
  ruleSummaryArithmetic,
  ruleRegistrationSummary,
  ruleOutstanding,
  ruleOutstandingCrossTab,
  ruleAgeingSums,
  ruleSegmentCoverage,
];
