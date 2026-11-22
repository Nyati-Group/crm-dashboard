import { norm } from './data/cells';
import {
  REGISTRATION_AGEING_PREFIX,
  type AgeingRow,
  type Dataset,
  type NumCell,
  type ParamRow,
  type ParamTable,
  type SalesBlock,
  type Segment,
  type SegmentColumn,
} from './schema';

export type SegmentFilter = 'all' | Segment;

export function paramRow(t: ParamTable, key: string): ParamRow | undefined {
  return t.rows.find((r) => r.key === key);
}

export function paramNum(t: ParamTable, key: string, segKey: string): NumCell | undefined {
  return paramRow(t, key)?.nums[segKey];
}

export function paramText(t: ParamTable, key: string, segKey: string): string | null {
  return paramRow(t, key)?.cells[segKey]?.text ?? null;
}

/** Columns of a wide tab that pass the Residential / Commercial / Total + project filter. */
export function filterSegments(segments: SegmentColumn[], seg: SegmentFilter, project?: string | null): SegmentColumn[] {
  return segments.filter(
    (s) => (seg === 'all' || s.segment === seg) && (!project || s.project === null || s.project === project),
  );
}

/** Project-level (non-Total) segment columns, e.g. Residential + Commercial of one project. */
export function projectSegments(segments: SegmentColumn[], project: string): SegmentColumn[] {
  return segments.filter((s) => s.project === project && s.segment !== 'total');
}

export function quarterBlocks(ds: Dataset): SalesBlock[] {
  return ds.salesBlocks.filter((b) => b.kind === 'quarter');
}

/** Quarter blocks shown on the Overview: duplicates that are entirely zero are hidden (also dropped by the automatic clean-up). */
export function visibleQuarterBlocks(ds: Dataset): SalesBlock[] {
  return quarterBlocks(ds).filter((b) => !b.allZero);
}

export function annualBlock(ds: Dataset): SalesBlock | undefined {
  return ds.salesBlocks.find((b) => b.kind === 'annual');
}

export interface AgeingBucketRow {
  label: string;
  /** canonical bucket order key, e.g. "1-30" */
  bucket: string;
  is120Plus: boolean;
  row: ParamRow;
}

/** Normalise "01 – 30 days" / "0-30 days" / ">120 days" to a comparable bucket key. */
export function bucketKey(label: string): string {
  const n = norm(label);
  const gt = /(>|more than|above)\s*(\d+)/.exec(n);
  if (gt) return `>${Number(gt[2])}`;
  const range = /(\d+)\s*-\s*(\d+)/.exec(n);
  if (range) return `${Number(range[1]) === 0 ? 1 : Number(range[1])}-${Number(range[2])}`;
  return n;
}

export function isOver120(label: string): boolean {
  const k = bucketKey(label);
  if (k.startsWith('>')) return Number(k.slice(1)) >= 120;
  return false;
}

/** Tab 6 rows "Ageing Un Registration Status - 01 – 30 days" etc. */
export function registrationAgeingRows(t: ParamTable): AgeingBucketRow[] {
  const prefix = norm(REGISTRATION_AGEING_PREFIX);
  return t.rows
    .filter((r) => norm(r.parameter).startsWith(prefix))
    .map((r) => {
      const label = r.parameter.slice(r.parameter.search(/[-–—]/) + 1).trim() || r.parameter;
      return { label, bucket: bucketKey(label), is120Plus: isOver120(label), row: r };
    });
}

export function ageingBuckets(rows: AgeingRow[], category: string): AgeingRow[] {
  return rows.filter((r) => norm(r.category) === norm(category) && !r.isTotal);
}

export function ageingTotal(rows: AgeingRow[], category: string): AgeingRow | undefined {
  return rows.find((r) => norm(r.category) === norm(category) && r.isTotal && !r.isGrandTotal);
}

export function ageingGrandTotal(rows: AgeingRow[]): AgeingRow | undefined {
  return rows.find((r) => r.isGrandTotal);
}

export function ageingCategories(rows: AgeingRow[]): string[] {
  const out: string[] = [];
  for (const r of rows) if (!r.isGrandTotal && r.category && !out.includes(r.category)) out.push(r.category);
  return out;
}
