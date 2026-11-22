import { describe, expect, it } from 'vitest';
import { runQuality } from '@/lib/quality';
import {
  ruleAgeingSums,
  ruleAnnualVsQuarter,
  ruleCollection,
  ruleNonNumeric,
  ruleOutstanding,
  ruleOutstandingCrossTab,
  ruleProjectSales,
  ruleRegistration,
  ruleRegistrationSummary,
  ruleSalesCollection,
  ruleSegmentCoverage,
  ruleSoldCrossTab,
  ruleSummaryArithmetic,
  ruleTotalColumns,
  ruleZeroBlocks,
} from '@/lib/quality/rules';
import { cleanWorkbook, parseTabs } from './helpers';

const fails = <T extends { status: string }>(checks: T[]) => checks.filter((c) => c.status === 'fail');

describe('clean workbook', () => {
  it('raises no errors or warnings', () => {
    const report = runQuality(parseTabs(cleanWorkbook()));
    const bad = report.checks.filter((c) => c.status === 'fail' && c.severity !== 'info');
    expect(bad, JSON.stringify(bad, null, 1)).toEqual([]);
    expect(report.summary.passed).toBeGreaterThan(20);
  });
});

describe('registration: Registered + Unregistered = Sold, and TOTAL row', () => {
  it('flags a project row that does not add up', () => {
    const t = cleanWorkbook();
    t['3a_Registration'][1] = ['P1', 10, 6, 3];
    const f = fails(ruleRegistration(parseTabs(t)));
    expect(f.some((c) => c.rule === 'registration-sum' && c.subject.startsWith('P1'))).toBe(true);
  });
  it('flags a TOTAL row (source: 4296 registered vs 54 in projects)', () => {
    const t = cleanWorkbook();
    t['3a_Registration'][2] = ['TOTAL', null, 4296, 225];
    const checks = ruleRegistration(parseTabs(t));
    const f = fails(checks);
    expect(f.find((c) => c.subject === 'TOTAL row · Registered')?.message).toMatch(/4,296/);
    expect(f.find((c) => c.subject === 'TOTAL row · Unregistered')).toBeTruthy();
    expect(checks.find((c) => c.subject === 'TOTAL row · Sold')?.status).toBe('skipped');
  });
});

describe('sold units across tabs', () => {
  it('flags 3a Sold that differs from tab 5 (Residential + Commercial)', () => {
    const t = cleanWorkbook();
    t['3a_Registration'][1] = ['P1', 106, 102, 4];
    const f = fails(ruleSoldCrossTab(parseTabs(t)));
    expect(f).toHaveLength(1);
    expect(f[0].message).toMatch(/106/);
  });
  it('passes when 3a Sold = Residential + Commercial', () => {
    expect(fails(ruleSoldCrossTab(parseTabs(cleanWorkbook())))).toHaveLength(0);
  });
});

describe('Total column = Residential + Commercial', () => {
  it('flags 978 vs 250 + 6', () => {
    const t = cleanWorkbook();
    t['4_Project_General_Info'][3] = ['Total Units', 250, 6, 978];
    const f = fails(ruleTotalColumns(parseTabs(t)));
    expect(f.some((c) => c.tab === '4_Project_General_Info' && /978/.test(c.message) && /256/.test(c.message))).toBe(true);
  });
  it('never sums average rates', () => {
    const t = cleanWorkbook();
    t['5_Project_Summary'][7] = ['Average Rate (Up to Date)', 100, 200, 999];
    expect(ruleTotalColumns(parseTabs(t)).some((c) => /Rate/.test(c.subject))).toBe(false);
  });
});

describe('% columns = Achieved ÷ Target', () => {
  it('flags Units % 100% when 23/30 = 76.7%', () => {
    const t = cleanWorkbook();
    t['2_Project_Sales'][1] = ['P1', 30, 23, -7, 1, 1000, 500, -500, 0.5];
    const f = fails(ruleProjectSales(parseTabs(t)));
    expect(f.find((c) => c.subject === 'P1 · Units %')?.message).toMatch(/76\.7%/);
  });
  it('accepts over-achievement (168%)', () => {
    const t = cleanWorkbook();
    t['3b_Collection'][1] = ['P1', 152, 256, 104, 1.68];
    t['3b_Collection'][2] = ['TOTAL', 152, 256, 104, 1.68];
    expect(fails(ruleCollection(parseTabs(t)))).toHaveLength(0);
  });
  it('flags a % row in tab 1', () => {
    const t = cleanWorkbook();
    t['1_Sales_Collection'][4] = ['Apr-Jun 2026 (Block 1)', '% Achieved', 1.25, 0.5, null, 0.5, 0.76];
    const f = fails(ruleSalesCollection(parseTabs(t)));
    expect(f.map((c) => c.subject)).toContain('Apr-Jun 2026 (Block 1) · Collection');
  });
});

describe('variance = Achieved − Budget', () => {
  it('detects a reversed sign', () => {
    const t = cleanWorkbook();
    t['2_Project_Sales'][1] = ['P1', 30, 24, 6, 0.8, 1000, 500, -500, 0.5];
    const f = fails(ruleProjectSales(parseTabs(t)));
    expect(f.find((c) => c.subject === 'P1 · Variance Units')?.message).toMatch(/Sign reversed/);
  });
  it('detects a plain mismatch', () => {
    const t = cleanWorkbook();
    t['2_Project_Sales'][1] = ['P1', 30, 24, -6, 0.8, 1000, 500, 384, 0.5];
    const f = fails(ruleProjectSales(parseTabs(t)));
    expect(f.find((c) => c.subject === 'P1 · Variance Value')?.message).not.toMatch(/Sign reversed/);
  });
});

describe('truncated / non-numeric cells', () => {
  it('reports "1,03" and "1,52" as needs clarification and skips dependent checks', () => {
    const t = cleanWorkbook();
    t['1_Sales_Collection'][5] = ['Annual FY 2026-27', 'Annual Budget – FY 2026-27', '1,03', '1,52', 10, 4000, 2000];
    const ds = parseTabs(t);
    const nn = ruleNonNumeric(ds).filter((c) => c.severity === 'error');
    expect(nn.map((c) => c.cells[0])).toEqual(['1_Sales_Collection!C6', '1_Sales_Collection!D6']);
    const sc = ruleSalesCollection(ds).filter((c) => c.subject.startsWith('Annual FY 2026-27 · Units'));
    expect(sc.every((c) => c.status === 'skipped')).toBe(true);
    const report = runQuality(ds);
    expect(report.needsClarification.map((n) => n.raw)).toEqual(['"1,03"', '"1,52"']);
  });
  it('lists numbers stored as text as info (they are still read)', () => {
    const t = cleanWorkbook();
    t['3b_Collection'][1] = ['P1', '1,00', '150', 50, 1.5];
    const ds = parseTabs(t);
    expect(ds.collection[0].achieved.value).toBe(150);
    const info = ruleNonNumeric(ds).find((c) => c.severity === 'info');
    expect(info?.cells).toEqual(['3b_Collection!C2']);
  });
});

describe('duplicate all-zero blocks', () => {
  it('lists them and marks them hidden', () => {
    const t = cleanWorkbook();
    t['1_Sales_Collection'].splice(5, 0,
      ['Apr-Jun 2026 (Block 2)', 'Budget- April’26 Till June’26', 0, 0, null, 0, 0],
      ['Apr-Jun 2026 (Block 2)', 'Actual - April’26 Till June’26', 0, 0, null, 0, 0],
      ['Apr-Jun 2026 (Block 2)', 'Variance', 0, 0, null, 0, 0],
      ['Apr-Jun 2026 (Block 2)', '% Achieved', 0, 0, null, 0, 0],
    );
    const ds = parseTabs(t);
    expect(ds.salesBlocks.map((b) => b.allZero)).toEqual([false, true, false]);
    const z = ruleZeroBlocks(ds);
    expect(z).toHaveLength(1);
    expect(z[0].subject).toBe('Apr-Jun 2026 (Block 2)');
    expect(runQuality(ds).hiddenBlocks[0].rows).toEqual([6, 7, 8, 9]);
  });
});

describe('other consistency rules', () => {
  it('annual achieved lower than quarter actual', () => {
    const t = cleanWorkbook();
    t['1_Sales_Collection'][6] = ['Annual FY 2026-27', 'Achieved', 18, 300, 12, 600, 500];
    expect(fails(ruleAnnualVsQuarter(parseTabs(t))).map((c) => c.subject)).toEqual(['Annual FY 2026-27 · Units']);
  });
  it('tab 5 arithmetic', () => {
    const t = cleanWorkbook();
    t['5_Project_Summary'][4] = ['Total Units for Sale', 6, 2, 9];
    expect(fails(ruleSummaryArithmetic(parseTabs(t))).length).toBeGreaterThan(0);
  });
  it('tab 6 buckets add up to unregistered', () => {
    const t = cleanWorkbook();
    t['6_Registration_Summary'][5] = ['Ageing Un Registration Status - >120 days', 5, 1];
    expect(fails(ruleRegistrationSummary(parseTabs(t))).some((c) => /Ageing buckets/.test(c.subject))).toBe(true);
  });
  it('tab 7 outstanding arithmetic; negative outstanding is fine', () => {
    expect(fails(ruleOutstanding(parseTabs(cleanWorkbook())))).toHaveLength(0);
    const t = cleanWorkbook();
    t['7_Collection_Summary'][4] = ['Total Outstanding', 90, -50];
    expect(fails(ruleOutstanding(parseTabs(t))).length).toBeGreaterThan(0);
  });
  it('tab 7 vs tab 8', () => {
    const t = cleanWorkbook();
    t['8_Ageing_Outstanding'][5] = ['All', 'Grand Total', 100, -40];
    expect(fails(ruleOutstandingCrossTab(parseTabs(t))).length).toBe(1);
  });
  it('tab 8 bucket sums', () => {
    const t = cleanWorkbook();
    t['8_Ageing_Outstanding'][2] = ['Registered', 'Total', 61, -50];
    expect(fails(ruleAgeingSums(parseTabs(t))).length).toBeGreaterThan(0);
  });
  it('segment coverage', () => {
    const t = cleanWorkbook();
    t['6_Registration_Summary'] = t['6_Registration_Summary'].map((r) => [r[0], r[2]]);
    const f = fails(ruleSegmentCoverage(parseTabs(t)));
    expect(f.map((c) => c.tab)).toEqual(['6_Registration_Summary']);
  });
});
