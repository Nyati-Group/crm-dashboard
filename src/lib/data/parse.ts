import {
  COLUMNS,
  PREFIX_HEADER_COLUMNS,
  README_TAB,
  ROWS,
  TAB,
  type AgeingRow,
  type AgeingTable,
  type CollectionRow,
  type Dataset,
  type MetricSet,
  type NumCell,
  type ParamRow,
  type ParamTable,
  type ProjectSalesRow,
  type RawValue,
  type RegistrationRow,
  type RowLabel,
  type SalesBlock,
  type SalesRowKind,
  type SchemaError,
  type Segment,
  type SegmentColumn,
  type TabKey,
} from '../schema';
import { cellRef, cleanText, norm, parseAsOn, toNumCell, toTextCell } from './cells';
import type { RawSheet, RawWorkbook, SourceConfig } from './types';

export type ParseResult = { ok: true; dataset: Dataset } | { ok: false; errors: SchemaError[] };

interface Table {
  sheet: RawSheet;
  headerRowNumber: number;
  headers: string[];
  /** data rows with their sheet row number; fully blank rows are dropped */
  rows: { rowNumber: number; cells: RawValue[] }[];
}

function isBlank(v: RawValue | undefined) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function toTable(sheet: RawSheet): Table | null {
  const headerIdx = sheet.rows.findIndex((r) => r.some((c) => !isBlank(c)));
  if (headerIdx < 0) return null;
  const headers = sheet.rows[headerIdx].map((h) => cleanText(h));
  const rows: Table['rows'] = [];
  for (let i = headerIdx + 1; i < sheet.rows.length; i++) {
    const cells = sheet.rows[i] ?? [];
    if (cells.every(isBlank)) continue;
    rows.push({ rowNumber: sheet.firstRow + i, cells });
  }
  return { sheet, headerRowNumber: sheet.firstRow + headerIdx, headers, rows };
}

function findSheet(wb: RawWorkbook, name: string): RawSheet | undefined {
  return wb.sheets.find((s) => norm(s.name) === norm(name));
}

function labelMatches(label: string, rule: RowLabel): boolean {
  const n = norm(label);
  const want = norm(rule.label);
  return rule.prefix ? n.startsWith(want) : n === want;
}

class Ctx {
  errors: SchemaError[] = [];
  constructor(readonly wb: RawWorkbook) {}

  table(key: TabKey): Table | null {
    const name = TAB[key];
    const sheet = findSheet(this.wb, name);
    if (!sheet) {
      const found = this.wb.sheets.map((s) => `"${s.name}"`).join(', ') || 'none';
      this.errors.push({ tab: name, message: `Tab "${name}" is missing. Tabs found: ${found}.` });
      return null;
    }
    const t = toTable(sheet);
    if (!t) this.errors.push({ tab: name, message: `Tab "${name}" is empty (no header row).` });
    return t;
  }

  /** Resolve every contract column of a tab to its index. Missing ones become SchemaErrors. */
  columns<K extends TabKey>(key: K, t: Table): Record<keyof (typeof COLUMNS)[K], number> | null {
    const contract = COLUMNS[key] as Record<string, string>;
    const prefixCols: string[] = PREFIX_HEADER_COLUMNS[key] ?? [];
    const out: Record<string, number> = {};
    let missing = false;
    for (const [field, header] of Object.entries(contract)) {
      const want = norm(header);
      const idx = t.headers.findIndex((h) => {
        const n = norm(h);
        return n === want || (prefixCols.includes(field) && n.startsWith(want));
      });
      if (idx < 0) {
        missing = true;
        const found = t.headers.filter((h) => h !== '').map((h) => `"${h}"`).join(', ');
        this.errors.push({
          tab: TAB[key],
          column: header,
          message: `Column "${header}" is missing or renamed in tab "${TAB[key]}" (header row ${t.headerRowNumber}). Columns found: ${found}.`,
        });
      } else out[field] = idx;
    }
    return missing ? null : (out as Record<keyof (typeof COLUMNS)[K], number>);
  }
}

// ------------------------------------------------------------------ segments

export function parseSegmentHeader(header: string): { project: string | null; segment: Segment } | null {
  const h = cleanText(header).replace(/\s+INR$/i, '').trim();
  if (h === '') return null;
  if (norm(h) === 'total' || norm(h) === 'grand total') return { project: null, segment: 'total' };
  const m = /^(.*)\(([^)]+)\)$/.exec(h);
  if (!m) return { project: h, segment: 'total' };
  const s = norm(m[2]);
  // "Residencial" (sheet spelling) and "Residential" both mean residential.
  const segment: Segment | null = s.startsWith('resid')
    ? 'residential'
    : s.startsWith('comm')
      ? 'commercial'
      : s.startsWith('total')
        ? 'total'
        : null;
  if (!segment) return null;
  return { project: m[1].trim() || null, segment };
}

function segmentColumns(ctx: Ctx, tab: string, t: Table, fromIndex: number): SegmentColumn[] {
  const out: SegmentColumn[] = [];
  for (let i = fromIndex; i < t.headers.length; i++) {
    const header = t.headers[i];
    if (!header) continue;
    const seg = parseSegmentHeader(header);
    if (!seg) {
      ctx.errors.push({
        tab,
        column: header,
        message: `Column "${header}" in tab "${tab}" is not a recognised segment. Expected "<Project> (Residential)", "<Project> (Commercial)" or "Total".`,
      });
      continue;
    }
    const key = `${seg.project ?? '*'}|${seg.segment}`;
    if (out.some((o) => o.key === key)) {
      ctx.errors.push({ tab, column: header, message: `Segment column "${header}" appears twice in tab "${tab}".` });
      continue;
    }
    out.push({ key, header, project: seg.project, segment: seg.segment, colIndex: i });
  }
  if (out.length === 0) {
    ctx.errors.push({ tab, message: `Tab "${tab}" has no Residential / Commercial / Total value columns.` });
  }
  return out;
}

// ------------------------------------------------------------------ tab 1

function salesRowKind(parameter: string): SalesRowKind | null {
  const p = norm(parameter);
  if (p.startsWith('%')) return 'pct';
  if (p.startsWith('variance')) return 'variance';
  if (p.includes('budget') || p.includes('target')) return 'budget';
  if (p.startsWith('actual') || p.startsWith('achieved')) return 'actual';
  return null;
}

function parseSalesCollection(ctx: Ctx): SalesBlock[] {
  const t = ctx.table('salesCollection');
  if (!t) return [];
  const c = ctx.columns('salesCollection', t);
  if (!c) return [];
  const tab = TAB.salesCollection;
  const blocks: SalesBlock[] = [];
  const byKey = new Map<string, SalesBlock>();
  let lastKey = '';
  for (const { rowNumber, cells } of t.rows) {
    const section = cleanText(cells[c.section]);
    const parameter = cleanText(cells[c.parameter]);
    // "Annual FY 2026-27 (% Achieved)" belongs to the "Annual FY 2026-27" block.
    const key = section ? norm(section).replace(/\(%\s*achieved\)$/, '').trim() : lastKey;
    lastKey = key;
    let block = byKey.get(key);
    if (!block) {
      block = {
        id: key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        section: section || key,
        kind: key.includes('annual') ? 'annual' : 'quarter',
        rows: {},
        unknownRows: [],
        allZero: true,
      };
      byKey.set(key, block);
      blocks.push(block);
    }
    const num = (col: number) => toNumCell(cells[col], cellRef(tab, col, rowNumber));
    const metrics: MetricSet = {
      units: num(c.units),
      value: num(c.value),
      rate: num(c.rate),
      area: num(c.area),
      collection: num(c.collection),
    };
    const kind = salesRowKind(parameter);
    if (!kind || block.rows[kind]) {
      block.unknownRows.push({ parameter, rowNumber });
      continue;
    }
    block.rows[kind] = { kind, parameter, rowNumber, metrics };
    for (const m of Object.values(metrics) as NumCell[]) {
      if (m.status === 'needs_clarification' || (m.status === 'ok' && m.value !== 0)) block.allZero = false;
    }
  }
  return blocks;
}

// ------------------------------------------------------------------ tabs 2, 3a, 3b

const isTotalLabel = (s: string) => /^(grand )?total\b/.test(norm(s));

function parseProjectSales(ctx: Ctx): ProjectSalesRow[] {
  const t = ctx.table('projectSales');
  if (!t) return [];
  const c = ctx.columns('projectSales', t);
  if (!c) return [];
  const tab = TAB.projectSales;
  return t.rows
    .filter((r) => cleanText(r.cells[c.project]) !== '')
    .map(({ rowNumber, cells }) => {
      const num = (col: number) => toNumCell(cells[col], cellRef(tab, col, rowNumber));
      return {
        project: cleanText(cells[c.project]),
        rowNumber,
        targetUnits: num(c.targetUnits),
        achievedUnits: num(c.achievedUnits),
        varianceUnits: num(c.varianceUnits),
        unitsPct: num(c.unitsPct),
        targetValue: num(c.targetValue),
        achievedValue: num(c.achievedValue),
        varianceValue: num(c.varianceValue),
        valuePct: num(c.valuePct),
      };
    });
}

function parseRegistration(ctx: Ctx): RegistrationRow[] {
  const t = ctx.table('registration');
  if (!t) return [];
  const c = ctx.columns('registration', t);
  if (!c) return [];
  const tab = TAB.registration;
  return t.rows
    .filter((r) => cleanText(r.cells[c.project]) !== '')
    .map(({ rowNumber, cells }) => {
      const project = cleanText(cells[c.project]);
      const num = (col: number) => toNumCell(cells[col], cellRef(tab, col, rowNumber));
      return {
        project,
        rowNumber,
        isTotal: isTotalLabel(project),
        sold: num(c.sold),
        registered: num(c.registered),
        unregistered: num(c.unregistered),
      };
    });
}

function parseCollection(ctx: Ctx): CollectionRow[] {
  const t = ctx.table('collection');
  if (!t) return [];
  const c = ctx.columns('collection', t);
  if (!c) return [];
  const tab = TAB.collection;
  return t.rows
    .filter((r) => cleanText(r.cells[c.project]) !== '')
    .map(({ rowNumber, cells }) => {
      const project = cleanText(cells[c.project]);
      const num = (col: number) => toNumCell(cells[col], cellRef(tab, col, rowNumber));
      return {
        project,
        rowNumber,
        isTotal: isTotalLabel(project),
        budget: num(c.budget),
        achieved: num(c.achieved),
        variance: num(c.variance),
        pct: num(c.pct),
      };
    });
}

// ------------------------------------------------------------------ tabs 4-7

function parseParamTable(
  ctx: Ctx,
  key: 'generalInfo' | 'projectSummary' | 'registrationSummary' | 'collectionSummary',
): ParamTable {
  const tab = TAB[key];
  const empty: ParamTable = { tab, firstHeader: '', segments: [], rows: [] };
  const t = ctx.table(key);
  if (!t) return empty;
  const c = ctx.columns(key, t);
  if (!c) return empty;
  const segments = segmentColumns(ctx, tab, t, c.parameter + 1);
  const rules = (ROWS as Partial<Record<TabKey, Record<string, RowLabel>>>)[key] ?? {};
  const used = new Set<string>();
  const rows: ParamRow[] = t.rows
    .filter((r) => cleanText(r.cells[c.parameter]) !== '')
    .map(({ rowNumber, cells }) => {
      const parameter = cleanText(cells[c.parameter]);
      let rowKey: string | null = null;
      for (const [k, rule] of Object.entries(rules)) {
        if (!used.has(k) && labelMatches(parameter, rule)) {
          rowKey = k;
          used.add(k);
          break;
        }
      }
      const textCells: ParamRow['cells'] = {};
      const nums: ParamRow['nums'] = {};
      for (const s of segments) {
        const ref = cellRef(tab, s.colIndex, rowNumber);
        textCells[s.key] = toTextCell(cells[s.colIndex], ref);
        nums[s.key] = toNumCell(cells[s.colIndex], ref);
      }
      return { parameter, rowNumber, key: rowKey, cells: textCells, nums };
    });
  for (const [k, rule] of Object.entries(rules)) {
    if (rule.required && !used.has(k)) {
      ctx.errors.push({
        tab,
        row: rule.label,
        message: `Row "${rule.label}" is missing or renamed in tab "${tab}" (column "${t.headers[c.parameter]}").`,
      });
    }
  }
  return { tab, firstHeader: t.headers[c.parameter], segments, rows };
}

// ------------------------------------------------------------------ tab 8

function parseAgeing(ctx: Ctx): AgeingTable {
  const tab = TAB.ageing;
  const t = ctx.table('ageing');
  if (!t) return { segments: [], rows: [] };
  const c = ctx.columns('ageing', t);
  if (!c) return { segments: [], rows: [] };
  const segments = segmentColumns(ctx, tab, t, Math.max(c.category, c.bucket) + 1);
  let category = '';
  const rows: AgeingRow[] = [];
  for (const { rowNumber, cells } of t.rows) {
    const cat = cleanText(cells[c.category]);
    if (cat) category = cat; // merged cells in the source: carry the category down
    const bucket = cleanText(cells[c.bucket]);
    if (!bucket && !cat) continue;
    const nb = norm(bucket);
    const isGrandTotal = nb.includes('grand total') || norm(category) === 'all';
    const isTotal = isGrandTotal || nb === 'total';
    const nums: AgeingRow['cells'] = {};
    for (const s of segments) nums[s.key] = toNumCell(cells[s.colIndex], cellRef(tab, s.colIndex, rowNumber));
    rows.push({ category, bucket, isTotal, isGrandTotal, rowNumber, cells: nums });
  }
  return { segments, rows };
}

// ------------------------------------------------------------------ meta

function readme(wb: RawWorkbook): string[] {
  const s = findSheet(wb, README_TAB);
  if (!s) return [];
  return s.rows.flat().filter((v) => !isBlank(v)).map((v) => cleanText(v));
}

export function parseWorkbook(wb: RawWorkbook, source: SourceConfig, loadedAt = new Date()): ParseResult {
  const ctx = new Ctx(wb);
  const salesBlocks = parseSalesCollection(ctx);
  const projectSales = parseProjectSales(ctx);
  const registration = parseRegistration(ctx);
  const collection = parseCollection(ctx);
  const generalInfo = parseParamTable(ctx, 'generalInfo');
  const projectSummary = parseParamTable(ctx, 'projectSummary');
  const registrationSummary = parseParamTable(ctx, 'registrationSummary');
  const collectionSummary = parseParamTable(ctx, 'collectionSummary');
  const ageing = parseAgeing(ctx);

  if (ctx.errors.length) return { ok: false, errors: ctx.errors };

  const notes = readme(wb);
  const isTest =
    !!source.test ||
    notes.some((n) => /\bTEST\b/.test(n)) ||
    /test/i.test(source.location.split(/[\\/]/).pop() ?? '');
  if (source.test && notes.length === 0) {
    notes.push('This source is marked as TEST data in the DATA_SOURCES setting. Do not present these figures as real company data.');
  }

  const annual = salesBlocks.find((b) => b.kind === 'annual');
  const fy = annual ? /FY\s*(\d{4})\s*-\s*(\d{2,4})/i.exec(annual.section) : null;
  const asOn = parseAsOn(registrationSummary.firstHeader) ?? parseAsOn(collectionSummary.firstHeader);

  const projects = new Set<string>();
  for (const r of [...projectSales, ...registration.filter((x) => !x.isTotal), ...collection.filter((x) => !x.isTotal)]) {
    projects.add(r.project);
  }
  for (const s of [...generalInfo.segments, ...projectSummary.segments, ...ageing.segments]) {
    if (s.project) projects.add(s.project);
  }

  return {
    ok: true,
    dataset: {
      meta: {
        sourceId: source.id,
        sourceLabel: source.label,
        sourceKind: source.kind,
        location: source.location,
        isTest,
        testNotice: isTest ? notes : [],
        fiscalYear: fy ? `FY ${fy[1]}-${fy[2]}` : null,
        asOn: asOn?.iso ?? null,
        asOnLabel: asOn?.label ?? null,
        loadedAt: loadedAt.toISOString(),
        projects: [...projects],
      },
      salesBlocks,
      projectSales,
      registration,
      collection,
      generalInfo,
      projectSummary,
      registrationSummary,
      collectionSummary,
      ageing,
    },
  };
}
