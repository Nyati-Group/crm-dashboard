/**
 * Loads the real sample files end-to-end (adapter -> parser -> quality) and checks known values.
 * The REAL workbook test runs only when data/Nyati_Sales_Collection_FY2026-27.xlsx is present.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { XlsxAdapter } from '@/lib/data/adapters/xlsx';
import { loadWithAdapter } from '@/lib/data/loader';
import { parseWorkbook } from '@/lib/data/parse';
import type { LoadResult } from '@/lib/data/types';
import { annualBlock, visibleQuarterBlocks } from '@/lib/selectors';
import { SRC, cleanWorkbook, toRaw } from './helpers';

const REAL = 'data/Nyati_Sales_Collection_FY2026-27.xlsx';
const TEST = 'data/Nyati_Sales_Collection_FY2026-27_SCALED_x0.8_TEST.xlsx';
const BROKEN = 'data/fixtures/BROKEN_missing_column_TEST.xlsx';

async function load(location: string, reconcile = false): Promise<LoadResult> {
  return loadWithAdapter(new XlsxAdapter({ id: path.basename(location), label: location, kind: 'xlsx', location }), new Date(), { reconcile });
}

function overview(r: LoadResult) {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${r.status}: ${JSON.stringify(r)}`);
  const ds = r.dataset;
  const q = visibleQuarterBlocks(ds);
  const fy = annualBlock(ds)!;
  return { ds, quality: r.quality, q, fy };
}

function commonAssertions(r: LoadResult) {
  const { ds, quality, q, fy } = overview(r);
  // quarter KPIs (units are unscaled in the TEST file)
  expect(q).toHaveLength(1);
  expect(q[0].rows.budget!.metrics.units.value).toBe(40);
  expect(q[0].rows.actual!.metrics.units.value).toBe(49);
  expect(q[0].rows.pct!.metrics.units.value).toBe(1.2);
  // annual
  expect(fy.rows.actual!.metrics.units.value).toBe(18);
  expect(fy.rows.budget!.metrics.units).toMatchObject({ status: 'needs_clarification', raw: '1,03', value: null });
  expect(fy.rows.budget!.metrics.value).toMatchObject({ status: 'needs_clarification', raw: '1,52', value: null });
  expect(ds.meta.fiscalYear).toBe('FY 2026-27');
  expect(ds.meta.asOn).toBe('2026-07-01');
  expect(ds.meta.projects).toEqual(['Nyati Elenor']);
  // the second Apr-Jun block is hidden on the Overview but listed
  expect(quality.hiddenBlocks.map((b) => b.section)).toEqual(['Apr-Jun 2026 (Block 2)']);
  // the known source problems from the brief are all flagged
  const failing = quality.checks.filter((c) => c.status === 'fail');
  const has = (pred: (c: (typeof failing)[number]) => boolean) => expect(failing.some(pred)).toBe(true);
  has((c) => c.rule === 'total-row' && c.tab === '3a_Registration' && /4,296/.test(c.message));
  has((c) => c.rule === 'total-column' && /978/.test(c.message) && /256/.test(c.message));
  has((c) => c.rule === 'pct-ratio' && c.subject === 'Nyati Elenor · Units %');
  has((c) => c.rule === 'non-numeric' && c.cells.includes('1_Sales_Collection!C10'));
  has((c) => c.rule === 'non-numeric' && c.cells.includes('1_Sales_Collection!D10'));
  has((c) => c.rule === 'zero-block');
  has((c) => c.rule === 'annual-vs-quarter' && /Units/.test(c.subject));
  return { ds, quality };
}

describe('TEST workbook (x0.8)', () => {
  it.runIf(existsSync(TEST))('loads, flags as TEST, and matches known KPIs', async () => {
    const { ds } = commonAssertions(await load(TEST));
    expect(ds.meta.isTest).toBe(true);
    expect(ds.meta.testNotice.join(' ')).toMatch(/NOT THE COMPANY'S ACTUAL FIGURES/);
    const fy = annualBlock(ds)!;
    // ₹244.43 Cr real x 0.8 = ₹195.544 Cr
    expect(fy.rows.actual!.metrics.collection.value).toBe(1955440000);
    expect(visibleQuarterBlocks(ds)[0].rows.budget!.metrics.value.value).toBe(176000000);
  });
});

describe('REAL workbook', () => {
  it.runIf(existsSync(REAL))('loads and matches known KPIs (annual collection ₹244.43 Cr)', async () => {
    const { ds } = commonAssertions(await load(REAL));
    expect(ds.meta.isTest).toBe(false);
    expect(annualBlock(ds)!.rows.actual!.metrics.collection.value).toBe(2444300000);
  });
});

describe('broken workbook', () => {
  it.runIf(existsSync(BROKEN))('returns schema errors that name the missing tab and column', async () => {
    const r = await load(BROKEN);
    expect(r.status).toBe('schema_error');
    if (r.status !== 'schema_error') return;
    expect(r.errors.some((e) => e.tab === '2_Project_Sales' && e.column === 'Achieved Units')).toBe(true);
    expect(r.errors.some((e) => e.tab === '7_Collection_Summary' && /missing/.test(e.message))).toBe(true);
  });

  it('reports a missing file as unavailable, not as zeros', async () => {
    const r = await load('data/does-not-exist.xlsx');
    expect(r.status).toBe('unavailable');
  });

  it('reports a renamed parameter row', () => {
    const t = cleanWorkbook();
    t['5_Project_Summary'][5] = ['Total Sold till date', 8, 2, 10];
    const r = parseWorkbook(toRaw(t), SRC);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatchObject({ tab: '5_Project_Summary', row: 'Total Sold up to date' });
  });

  it('matches tabs case-insensitively (the Google Sheet uses "1_sales_collection")', () => {
    const t = cleanWorkbook();
    const lower = Object.fromEntries(Object.entries(t).map(([k, v]) => [k.toLowerCase(), v]));
    expect(parseWorkbook(toRaw(lower), SRC).ok).toBe(true);
  });
});

describe('automatic clean-up (what the dashboard shows)', () => {
  it.runIf(existsSync(TEST))('leaves no inconsistencies in the TEST workbook', async () => {
    const r = await load(TEST, true);
    if (r.status !== 'ok') throw new Error(r.status);
    const bad = r.quality.checks.filter((c) => c.status === 'fail' && c.severity !== 'info');
    expect(bad.map((c) => `${c.subject}: ${c.message}`)).toEqual([]);
    const ds = r.dataset;
    const [q] = visibleQuarterBlocks(ds);
    const fy = annualBlock(ds)!;
    expect(ds.salesBlocks.some((b) => b.allZero)).toBe(false);
    // inputs kept, derived figures recomputed
    expect(q.rows.actual!.metrics.units.value).toBe(49);
    expect(q.rows.pct!.metrics.units.value).toBeCloseTo(49 / 40);
    expect(q.rows.variance!.metrics.area.value).toBe(63562 - 95742);
    // truncated "1,03" / "1,52" repaired; annual achieved >= the quarter
    expect(fy.rows.budget!.metrics.units.value).toBe(103);
    expect(fy.rows.budget!.metrics.value.value).toBe(1520000000);
    expect(fy.rows.actual!.metrics.units.value).toBe(49);
    // TOTAL row = sum of the project rows
    const total = ds.registration.find((x) => x.isTotal)!;
    expect(total.registered.value).toBe(54);
    expect(total.sold.value).toBe(106);
  });
});