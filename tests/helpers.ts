import { parseWorkbook } from '@/lib/data/parse';
import type { RawWorkbook, SourceConfig } from '@/lib/data/types';
import type { Dataset, RawValue } from '@/lib/schema';

export const SRC: SourceConfig = { id: 'mem', label: 'In-memory', kind: 'xlsx', location: 'memory.xlsx' };

/**
 * A small, CONSISTENT workbook with every contract tab (no data-quality problems),
 * so each rule test can break exactly one thing.
 */
export function cleanWorkbook(): Record<string, RawValue[][]> {
  return {
    '1_Sales_Collection': [
      ['Section', 'Parameter', 'No. of Units', 'Value (INR)', 'Rate (per sq.ft.)', 'Area (sq.ft.)', 'Collection (INR)'],
      ['Apr-Jun 2026 (Block 1)', 'Budget- April’26 Till June’26', 40, 200, 10, 1000, 400],
      ['Apr-Jun 2026 (Block 1)', 'Actual - April’26 Till June’26', 50, 100, 12, 500, 200],
      ['Apr-Jun 2026 (Block 1)', 'Variance', 10, -100, null, -500, -200],
      ['Apr-Jun 2026 (Block 1)', '% Achieved', 1.25, 0.5, null, 0.5, 0.5],
      ['Annual FY 2026-27', 'Annual Budget – FY 2026-27', 100, 1000, 10, 4000, 2000],
      ['Annual FY 2026-27', 'Achieved', 60, 300, 12, 600, 500],
      ['Annual FY 2026-27', 'Variance', -40, -700, null, -3400, -1500],
      ['Annual FY 2026-27 (% Achieved)', '% Achieved', 0.6, 0.3, null, 0.15, 0.25],
    ],
    '2_Project_Sales': [
      ['Project', 'Target Units', 'Achieved Units', 'Variance Units', 'Units %', 'Target Value (INR)', 'Achieved Value (INR)', 'Variance Value (INR)', 'Value %'],
      ['P1', 30, 24, -6, 0.8, 1000, 500, -500, 0.5],
    ],
    '3a_Registration': [
      ['Project', 'Sold', 'Registered', 'Unregistered'],
      ['P1', 10, 6, 4],
      ['TOTAL', 10, 6, 4],
    ],
    '3b_Collection': [
      ['Project', 'Budget (INR)', 'Achieved (INR)', 'Variance (INR)', '%'],
      ['P1', 100, 150, 50, 1.5],
      ['TOTAL', 100, 150, 50, 1.5],
    ],
    '4_Project_General_Info': [
      ['Parameter', 'P1 (Residencial)', 'P1 (Commercial)', 'Total'],
      ['Project Configuration', '3 BHK', 'Shops', null],
      ['Building Names', 'A', 'C', null],
      ['Total Units', 8, 2, 10],
      ['Saleable Area (sq.ft.)', 800, 200, 1000],
      ['RERA Completion', '30/10/2029', '30/10/2029', null],
    ],
    '5_Project_Summary': [
      ['Parameter', 'P1 (Residencial)', 'P1 (Commercial)', 'Total'],
      ['Total Units', 8, 2, 10],
      ['Land Owner Units', 0, 0, 0],
      ['Premium Units (Blocked)', 1, 0, 1],
      ['Total Units for Sale', 7, 2, 9],
      ['Total Sold up to date', 8, 2, 10],
      ['Unsold Units', -1, 0, -1],
      ['Average Rate (Up to Date)', 100, 200, null],
      ['Budget- upto date', 5, null, 5],
      ['Achieved- upto date', 6, null, 6],
      ['Variance', 1, 0, 1],
    ],
    '6_Registration_Summary': [
      ['Parameter - As on 1st July 2026', 'P1 (Residencial)', 'P1 (Commercial)'],
      ['Total Sold Units', 8, 2],
      ['Total Registered Units', 5, 1],
      ['Total Unregistered Units', 3, 1],
      ['Ageing Un Registration Status - 01 – 30 days', 1, 0],
      ['Ageing Un Registration Status - >120 days', 2, 1],
    ],
    '7_Collection_Summary': [
      ['Parameter (in INR) - As on 1st July 2026', 'P1 (Residencial)', 'P1 (Commercial)'],
      ['Total Sold Value (Registered + Un registered)', 1000, 500],
      ['Total Due as per milestone', 400, 100],
      ['Total Collection', 300, 150],
      ['Total Outstanding', 100, -50],
      ['Registered O/s', 60, -50],
      ['Unregistered O/s', 40, 0],
    ],
    '8_Ageing_Outstanding': [
      ['Category', 'Bucket', 'P1 (Residential) INR', 'P1 (Commercial) INR'],
      ['Registered', '0-30 days', 60, -50],
      ['Registered', 'Total', 60, -50],
      ['Unregistered', '> 120 days', 40, 0],
      ['Unregistered', 'Total', 40, 0],
      ['All', 'Grand Total', 100, -50],
    ],
  };
}

export function toRaw(tabs: Record<string, RawValue[][]>): RawWorkbook {
  return { sheets: Object.entries(tabs).map(([name, rows]) => ({ name, rows, firstRow: 1 })) };
}

export function parseTabs(tabs: Record<string, RawValue[][]>): Dataset {
  const r = parseWorkbook(toRaw(tabs), SRC);
  if (!r.ok) throw new Error(`unexpected schema errors: ${JSON.stringify(r.errors)}`);
  return r.dataset;
}
