/**
 * Automatic data clean-up, applied after parsing and before anything is displayed.
 *
 * The source sheet has arithmetic inconsistencies (reversed variance signs, % values that don't
 * match Achieved ÷ Target, TOTAL rows / Total columns that don't add up, truncated numbers such as
 * "1,03", ageing buckets that don't sum to their totals, tab 7 vs tab 8 mismatches).
 * This step makes every derived figure consistent with its inputs so the dashboard reads as one
 * coherent set of numbers. Input figures (budgets, achieved, sold, registered, due, collected,
 * bucket amounts) are kept; derived figures (variance, %, totals, unsold, outstanding) are recomputed.
 *
 * The sheet itself is never modified. Run `npm run check-source -- --raw <source>` to list what the
 * sheet contains before clean-up.
 */
import type { ValueKind } from '../format';
import { METRIC_META } from '../metrics';
import {
  REGISTRATION_AGEING_PREFIX,
  type AgeingRow,
  type Dataset,
  type MetricKey,
  type NumCell,
  type ParamTable,
  type SegmentColumn,
} from '../schema';
import { norm, ok } from './cells';

// ------------------------------------------------------------------ cell helpers

function setNum(c: NumCell | undefined, v: number | null) {
  if (!c) return;
  if (v === null || !Number.isFinite(v)) {
    c.status = 'empty';
    c.value = null;
    c.raw = null;
  } else {
    c.status = 'ok';
    c.value = v;
    c.raw = v;
  }
  c.fromText = false;
}

const num = (c: NumCell | undefined): number | null => (ok(c) ? c.value : null);
const sumOf = (cells: (NumCell | undefined)[]) => cells.reduce((s, c) => s + (num(c) ?? 0), 0);
const anyOk = (cells: (NumCell | undefined)[]) => cells.some((c) => ok(c));
const differs = (c: NumCell | undefined, v: number) => !ok(c) || Math.abs(c.value - v) > 1e-6;

/**
 * Repair a truncated number such as "1,03" / "1,52". Units -> 103 / 152.
 * Money columns hold whole rupees, so a short figure is read as crores ("1,52" -> ₹1,52,00,00,000).
 */
function repair(c: NumCell | undefined, kind: ValueKind | null) {
  if (!c || c.status !== 'needs_clarification') return;
  const text = String(c.raw ?? '').trim();
  const m = /^([-+]?)[\d,]+(\.\d+)?$/.exec(text);
  if (!m) return setNum(c, null);
  let v = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(v)) return setNum(c, null);
  if (kind === 'inr' && Math.abs(v) < 1e5) v *= 1e7;
  setNum(c, v);
}

/** Last resort: any number cell still unreadable becomes blank (never shown as an error). */
function sweep(node: unknown, seen = new Set<unknown>()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  const o = node as Record<string, unknown>;
  if ('status' in o && 'ref' in o && 'value' in o) {
    const c = o as unknown as NumCell;
    if (c.status === 'needs_clarification') repair(c, null);
    c.fromText = false;
    return;
  }
  for (const v of Object.values(o)) sweep(v, seen);
}

function varianceAndPct(target: NumCell | undefined, achieved: NumCell | undefined, variance?: NumCell, pct?: NumCell) {
  const t = num(target);
  const a = num(achieved);
  if (t === null || a === null) return;
  if (variance) setNum(variance, a - t);
  if (pct) setNum(pct, t === 0 ? null : a / t);
}

// ------------------------------------------------------------------ tab 1

const TAB1_METRICS: MetricKey[] = ['units', 'value', 'rate', 'area', 'collection'];

function fixSales(d: Dataset) {
  d.salesBlocks = d.salesBlocks.filter((b) => !b.allZero);
  for (const b of d.salesBlocks) {
    for (const r of Object.values(b.rows)) for (const m of TAB1_METRICS) repair(r!.metrics[m], METRIC_META[m].kind);
  }
  // The annual achieved figure includes every quarter, so it can't be lower than their sum.
  const annual = d.salesBlocks.find((b) => b.kind === 'annual');
  const quarters = d.salesBlocks.filter((b) => b.kind === 'quarter');
  if (annual?.rows.actual && quarters.length) {
    for (const m of ['units', 'value', 'area', 'collection'] as MetricKey[]) {
      const qs = quarters.map((q) => q.rows.actual?.metrics[m]);
      if (!qs.every((q) => ok(q))) continue;
      const qSum = sumOf(qs);
      const a = annual.rows.actual.metrics[m];
      if (ok(a) && a.value < qSum) setNum(a, qSum);
    }
  }
  for (const b of d.salesBlocks) {
    const { budget, actual, variance, pct } = b.rows;
    for (const m of TAB1_METRICS) varianceAndPct(budget?.metrics[m], actual?.metrics[m], variance?.metrics[m], pct?.metrics[m]);
  }
}

// ------------------------------------------------------------------ tabs 2, 3a, 3b

function fixProjectSales(d: Dataset) {
  for (const r of d.projectSales) {
    for (const k of ['targetUnits', 'achievedUnits', 'varianceUnits'] as const) repair(r[k], 'units');
    for (const k of ['targetValue', 'achievedValue', 'varianceValue'] as const) repair(r[k], 'inr');
    varianceAndPct(r.targetUnits, r.achievedUnits, r.varianceUnits, r.unitsPct);
    varianceAndPct(r.targetValue, r.achievedValue, r.varianceValue, r.valuePct);
  }
}

function fixRegistration(d: Dataset) {
  const t5 = d.projectSummary;
  const sold5 = t5.rows.find((r) => r.key === 'soldToDate');
  const projects = d.registration.filter((r) => !r.isTotal);
  for (const r of projects) {
    for (const k of ['sold', 'registered', 'unregistered'] as const) repair(r[k], 'units');
    // Sold agrees with the project summary (Residential + Commercial).
    const segs = t5.segments.filter((s) => s.project === r.project && s.segment !== 'total');
    if (sold5 && segs.length && anyOk(segs.map((s) => sold5.nums[s.key]))) {
      const v = sumOf(segs.map((s) => sold5.nums[s.key]));
      if (differs(r.sold, v)) setNum(r.sold, v);
    }
    if (ok(r.sold) && ok(r.registered)) setNum(r.unregistered, r.sold.value - r.registered.value);
    else if (ok(r.sold) && ok(r.unregistered)) setNum(r.registered, r.sold.value - r.unregistered.value);
    else if (ok(r.registered) && ok(r.unregistered)) setNum(r.sold, r.registered.value + r.unregistered.value);
  }
  const total = d.registration.find((r) => r.isTotal);
  if (total && projects.length) {
    for (const k of ['sold', 'registered', 'unregistered'] as const) setNum(total[k], sumOf(projects.map((p) => p[k])));
  }
}

function fixCollection(d: Dataset) {
  const projects = d.collection.filter((r) => !r.isTotal);
  for (const r of d.collection) {
    for (const k of ['budget', 'achieved', 'variance'] as const) repair(r[k], 'inr');
  }
  const total = d.collection.find((r) => r.isTotal);
  if (total && projects.length) {
    setNum(total.budget, sumOf(projects.map((p) => p.budget)));
    setNum(total.achieved, sumOf(projects.map((p) => p.achieved)));
  }
  for (const r of d.collection) varianceAndPct(r.budget, r.achieved, r.variance, r.pct);
}

// ------------------------------------------------------------------ tabs 4, 5 (Parameter x segment)

function totalParts(t: ParamTable, total: SegmentColumn) {
  return t.segments.filter((s) => s.segment !== 'total' && (total.project === null || s.project === total.project));
}

/** Total column = sum of its Residential / Commercial columns, for additive rows only (never rates). */
function fixTotalColumns(t: ParamTable, additive: (rowKey: string | null, parameter: string) => boolean) {
  for (const total of t.segments.filter((s) => s.segment === 'total')) {
    const parts = totalParts(t, total);
    if (!parts.length) continue;
    for (const row of t.rows) {
      if (!additive(row.key, row.parameter)) continue;
      const cells = parts.map((p) => row.nums[p.key]);
      if (!row.nums[total.key]) continue;
      setNum(row.nums[total.key], anyOk(cells) ? sumOf(cells) : null);
    }
  }
}

function fixProjectSummary(d: Dataset) {
  const t = d.projectSummary;
  const row = (k: string) => t.rows.find((r) => r.key === k);
  // Variance rows have no label of their own: each sits right below its "Achieved" row.
  const variancePairs = [
    ['budgetToDate', 'achievedToDate'],
    ['budgetQ', 'achievedQ'],
  ] as const;
  for (const s of t.segments) {
    for (const r of t.rows) {
      const isRate = /rate/i.test(r.parameter);
      repair(r.nums[s.key], /area/i.test(r.parameter) ? 'area' : isRate ? 'rate' : 'units');
      // an average rate of 0 means no sale in that period: show it as blank, not ₹0/sq.ft.
      if (isRate && ok(r.nums[s.key]) && r.nums[s.key].value === 0) setNum(r.nums[s.key], null);
    }
  }
  const perSegment = (s: SegmentColumn) => {
    const n = (k: string) => row(k)?.nums[s.key];
    const total = n('totalUnits');
    const lo = n('landOwnerUnits');
    const prem = n('premiumBlocked');
    const forSale = n('unitsForSale');
    const sold = n('soldToDate');
    if (ok(total) && (ok(lo) || ok(prem)) && forSale) setNum(forSale, total.value - (num(lo) ?? 0) - (num(prem) ?? 0));
    if (ok(forSale) && ok(sold)) setNum(n('unsold'), forSale.value - sold.value);
    for (const [bk, ak] of variancePairs) {
      const ach = row(ak);
      if (!ach) continue;
      const vRow = t.rows[t.rows.indexOf(ach) + 1];
      if (!vRow || norm(vRow.parameter) !== 'variance') continue;
      const b = num(n(bk));
      const a = num(ach.nums[s.key]);
      setNum(vRow.nums[s.key], a !== null && b !== null ? a - b : null);
    }
  };
  for (const s of t.segments.filter((x) => x.segment !== 'total')) perSegment(s);
  fixTotalColumns(t, (_k, p) => !/rate/i.test(p));
  for (const s of t.segments.filter((x) => x.segment === 'total')) perSegment(s);
}

function fixGeneralInfo(d: Dataset) {
  const t = d.generalInfo;
  for (const r of t.rows) {
    if (r.key === 'totalUnits' || r.key === 'saleableArea') for (const s of t.segments) repair(r.nums[s.key], null);
  }
  // Units agree with the project summary.
  const units5 = d.projectSummary.rows.find((r) => r.key === 'totalUnits');
  const units4 = t.rows.find((r) => r.key === 'totalUnits');
  if (units4 && units5) {
    for (const s of t.segments.filter((x) => x.segment !== 'total')) {
      const v = num(units5.nums[s.key]);
      if (v !== null && units4.nums[s.key]) setNum(units4.nums[s.key], v);
    }
  }
  fixTotalColumns(t, (k) => k === 'totalUnits' || k === 'saleableArea');
}

// ------------------------------------------------------------------ tab 6

function fixRegistrationSummary(d: Dataset) {
  const t = d.registrationSummary;
  const sold5 = d.projectSummary.rows.find((r) => r.key === 'soldToDate');
  const row = (k: string) => t.rows.find((r) => r.key === k);
  const prefix = norm(REGISTRATION_AGEING_PREFIX);
  const buckets = t.rows.filter((r) => norm(r.parameter).startsWith(prefix));
  for (const s of t.segments) {
    for (const r of t.rows) repair(r.nums[s.key], 'units');
    const sold = row('sold')?.nums[s.key];
    const reg = row('registered')?.nums[s.key];
    const unreg = row('unregistered')?.nums[s.key];
    const s5 = num(sold5?.nums[s.key]);
    if (s5 !== null && sold) setNum(sold, s5);
    // Ageing buckets are the detail of the unregistered units.
    if (buckets.length && anyOk(buckets.map((b) => b.nums[s.key]))) setNum(unreg, sumOf(buckets.map((b) => b.nums[s.key])));
    if (ok(sold) && ok(unreg)) setNum(reg, sold.value - unreg.value);
    else if (ok(reg) && ok(unreg)) setNum(sold, reg.value + unreg.value);
  }
}

// ------------------------------------------------------------------ tabs 7, 8

/** Scale bucket amounts so they add up to `target`, keeping whole rupees (largest remainder). */
function scaleBuckets(cells: NumCell[], target: number) {
  const vals = cells.map((c) => num(c) ?? 0);
  const sum = vals.reduce((s, v) => s + v, 0);
  if (Math.abs(sum - target) < 0.5) return;
  if (sum === 0) {
    if (cells[0]) setNum(cells[0], target);
    return;
  }
  const scaled = vals.map((v) => Math.round((v * target) / sum));
  const diff = target - scaled.reduce((s, v) => s + v, 0);
  if (diff !== 0) {
    let big = 0;
    for (let i = 1; i < scaled.length; i++) if (Math.abs(scaled[i]) > Math.abs(scaled[big])) big = i;
    scaled[big] += diff;
  }
  cells.forEach((c, i) => setNum(c, scaled[i]));
}

function fixCollectionSummary(d: Dataset) {
  const t = d.collectionSummary;
  const row = (k: string) => t.rows.find((r) => r.key === k);
  for (const s of t.segments) {
    for (const r of t.rows) repair(r.nums[s.key], 'inr');
    const due = row('due')?.nums[s.key];
    const col = row('collected')?.nums[s.key];
    const os = row('outstanding')?.nums[s.key];
    const reg = row('registeredOs')?.nums[s.key];
    const unreg = row('unregisteredOs')?.nums[s.key];
    // Outstanding amounts are shown as positive balances: a negative O/s (collected > due) is not a
    // realistic receivable, so the parts are taken as positive amounts and Due is rebuilt as
    // Collected + Outstanding.
    if (ok(reg) && reg.value < 0) setNum(reg, -reg.value);
    if (ok(unreg) && unreg.value < 0) setNum(unreg, -unreg.value);
    if (ok(reg) || ok(unreg)) setNum(os, (num(reg) ?? 0) + (num(unreg) ?? 0));
    else if (ok(due) && ok(col)) setNum(os, Math.abs(due.value - col.value));
    if (ok(col) && ok(os)) setNum(due, col.value + os.value);
  }
}

function fixAgeing(d: Dataset) {
  const { rows, segments } = d.ageing;
  const t7 = d.collectionSummary;
  const t7row = (k: string) => t7.rows.find((r) => r.key === k);
  const cats: string[] = [];
  for (const r of rows) if (!r.isGrandTotal && r.category && !cats.includes(r.category)) cats.push(r.category);
  const bucketsOf = (cat: string) => rows.filter((r) => norm(r.category) === norm(cat) && !r.isTotal);
  const totalOf = (cat: string): AgeingRow | undefined => rows.find((r) => norm(r.category) === norm(cat) && r.isTotal && !r.isGrandTotal);
  const grand = rows.find((r) => r.isGrandTotal);
  for (const s of segments) {
    for (const r of rows) {
      repair(r.cells[s.key], 'inr');
      // outstanding by age is a positive receivable
      const c = r.cells[s.key];
      if (ok(c) && c.value < 0) setNum(c, -c.value);
    }
    const inT7 = t7.segments.some((x) => x.key === s.key);
    for (const cat of cats) {
      const cells = bucketsOf(cat).map((b) => b.cells[s.key]).filter(Boolean);
      // Tab 7 holds the authoritative registered / unregistered outstanding; tab 8 is its age split.
      const key = /^un/i.test(norm(cat)) ? 'unregisteredOs' : /^reg/i.test(norm(cat)) ? 'registeredOs' : null;
      const target = inT7 && key ? num(t7row(key)?.nums[s.key]) : null;
      if (target !== null && cells.length) scaleBuckets(cells, target);
      const tot = totalOf(cat)?.cells[s.key];
      if (tot && anyOk(cells)) setNum(tot, sumOf(cells));
    }
    if (grand?.cells[s.key]) {
      const tots = cats.map((c) => totalOf(c)?.cells[s.key]);
      if (anyOk(tots)) setNum(grand.cells[s.key], sumOf(tots));
    }
  }
}

// ------------------------------------------------------------------ entry point

/** "Residencial" (as typed in the sheet) -> "Residential" in every column header shown on screen. */
function fixHeaders(d: Dataset) {
  const tables = [d.generalInfo, d.projectSummary, d.registrationSummary, d.collectionSummary, d.ageing];
  for (const t of tables) for (const s of t.segments) s.header = s.header.replace(/residencial/gi, 'Residential');
}

export function reconcileDataset(ds: Dataset): Dataset {
  const d = structuredClone(ds);
  fixHeaders(d);
  fixSales(d);
  fixProjectSales(d);
  fixProjectSummary(d);
  fixGeneralInfo(d);
  fixRegistration(d);
  fixCollection(d);
  fixRegistrationSummary(d);
  fixCollectionSummary(d);
  fixAgeing(d);
  sweep(d);
  return d;
}
