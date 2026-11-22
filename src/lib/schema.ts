/**
 * THE single typed schema for the dashboard.
 *
 * Part 1 - the sheet CONTRACT: tab names, column headers and parameter-row labels exactly
 *          as they appear in the company's Google Sheet / xlsx. If any of these is missing
 *          or renamed, the loader returns a SchemaError naming it (never zeros).
 * Part 2 - the parsed DATA MODEL every page reads. Pages never touch raw sheet rows.
 *
 * To add a tab (e.g. a future CRM feed: leads, site visits, bookings): add it to TAB + COLUMNS,
 * add a model type below, and add a parser in src/lib/data/parse.ts.
 */

// ---------------------------------------------------------------- Part 1: contract

export const TAB = {
  salesCollection: '1_Sales_Collection',
  projectSales: '2_Project_Sales',
  registration: '3a_Registration',
  collection: '3b_Collection',
  generalInfo: '4_Project_General_Info',
  projectSummary: '5_Project_Summary',
  registrationSummary: '6_Registration_Summary',
  collectionSummary: '7_Collection_Summary',
  ageing: '8_Ageing_Outstanding',
} as const;
export type TabKey = keyof typeof TAB;

/** Optional tab: when present and it says "TEST", the dataset is flagged as test data. */
export const README_TAB = 'README';

export const COLUMNS = {
  salesCollection: {
    section: 'Section',
    parameter: 'Parameter',
    units: 'No. of Units',
    value: 'Value (INR)',
    rate: 'Rate (per sq.ft.)',
    area: 'Area (sq.ft.)',
    collection: 'Collection (INR)',
  },
  projectSales: {
    project: 'Project',
    targetUnits: 'Target Units',
    achievedUnits: 'Achieved Units',
    varianceUnits: 'Variance Units',
    unitsPct: 'Units %',
    targetValue: 'Target Value (INR)',
    achievedValue: 'Achieved Value (INR)',
    varianceValue: 'Variance Value (INR)',
    valuePct: 'Value %',
  },
  registration: { project: 'Project', sold: 'Sold', registered: 'Registered', unregistered: 'Unregistered' },
  collection: {
    project: 'Project',
    budget: 'Budget (INR)',
    achieved: 'Achieved (INR)',
    variance: 'Variance (INR)',
    pct: '%',
  },
  // Wide "Parameter x segment" tabs: first column fixed, the remaining columns are
  // "<Project> (Residential|Commercial)" or "Total" and are discovered at load time.
  generalInfo: { parameter: 'Parameter' },
  projectSummary: { parameter: 'Parameter' },
  registrationSummary: { parameter: 'Parameter' },
  collectionSummary: { parameter: 'Parameter' },
  ageing: { category: 'Category', bucket: 'Bucket' },
} as const satisfies Record<TabKey, Record<string, string>>;

/**
 * Columns whose header may carry a suffix, e.g. "Parameter - As on 1st July 2026"
 * or "Parameter (in INR) - As on 1st July 2026". The suffix carries the "as on" date.
 */
export const PREFIX_HEADER_COLUMNS: Partial<Record<TabKey, string[]>> = {
  registrationSummary: ['parameter'],
  collectionSummary: ['parameter'],
};

export interface RowLabel {
  label: string;
  /** match when the normalised row label starts with `label` (otherwise exact match) */
  prefix?: boolean;
  /** missing row = schema error (true) or simply absent (false) */
  required?: boolean;
}

export const ROWS = {
  generalInfo: {
    configuration: { label: 'Project Configuration', required: true },
    buildings: { label: 'Building Names', required: true },
    totalUnits: { label: 'Total Units', required: true },
    saleableArea: { label: 'Saleable Area (sq.ft.)', required: true },
    startDate: { label: 'Project Start Date' },
    reraRegistration: { label: 'RERA Registration Date' },
    expectedCompletion: { label: 'Expected Completion', prefix: true },
    reraCompletion: { label: 'RERA Completion' },
  },
  projectSummary: {
    totalUnits: { label: 'Total Units', required: true },
    landOwnerUnits: { label: 'Land Owner Units' },
    premiumBlocked: { label: 'Premium Units (Blocked)' },
    unitsForSale: { label: 'Total Units for Sale', required: true },
    soldToDate: { label: 'Total Sold up to date', required: true },
    unsold: { label: 'Unsold Units', required: true },
    avgRateToDate: { label: 'Average Rate (Up to Date)' },
    avgRateFy: { label: 'Average Rate (FY', prefix: true },
    avgRateMonth: { label: 'Average Rate (Current Month)' },
    budgetToDate: { label: 'Budget- upto date' },
    achievedToDate: { label: 'Achieved- upto date' },
    budgetQ: { label: 'Budget- for the Q' },
    achievedQ: { label: 'Achieved - for the Q' },
  },
  registrationSummary: {
    sold: { label: 'Total Sold Units', required: true },
    registered: { label: 'Total Registered Units', required: true },
    unregistered: { label: 'Total Unregistered Units', required: true },
  },
  collectionSummary: {
    soldValue: { label: 'Total Sold Value', prefix: true, required: true },
    due: { label: 'Total Due as per milestone', required: true },
    collected: { label: 'Total Collection', required: true },
    outstanding: { label: 'Total Outstanding', required: true },
    registeredOs: { label: 'Registered O/s' },
    unregisteredOs: { label: 'Unregistered O/s' },
  },
} as const satisfies Partial<Record<TabKey, Record<string, RowLabel>>>;

/** Rows in tab 6 that hold unregistered-unit ageing buckets. */
export const REGISTRATION_AGEING_PREFIX = 'Ageing Un Registration Status';

// ---------------------------------------------------------------- Part 2: data model

/** A raw value as it arrives from xlsx / CSV / Google Sheets. */
export type RawValue = string | number | boolean | Date | null;

export type CellStatus = 'ok' | 'empty' | 'needs_clarification';

/** A numeric cell. `value` is null unless status is 'ok'; `raw` keeps exactly what the sheet holds. */
export interface NumCell {
  status: CellStatus;
  value: number | null;
  raw: RawValue;
  /** A1-style reference, e.g. "1_Sales_Collection!C10" */
  ref: string;
  /** the number was stored as text in the sheet (e.g. "17,60,00,000") and read by its digit grouping */
  fromText?: boolean;
}

/** A text/date cell, displayed as-is. */
export interface TextCell {
  text: string | null;
  raw: RawValue;
  ref: string;
}

export type Segment = 'residential' | 'commercial' | 'total';
export const SEGMENTS: Segment[] = ['residential', 'commercial', 'total'];
export const SEGMENT_LABEL: Record<Segment, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  total: 'Total',
};

export interface SegmentColumn {
  /** stable key: "<project>|<segment>" (project "*" for company-level Total) */
  key: string;
  header: string;
  project: string | null;
  segment: Segment;
  colIndex: number;
}

// --- tab 1
export interface MetricSet {
  units: NumCell;
  value: NumCell;
  rate: NumCell;
  area: NumCell;
  collection: NumCell;
}
export type MetricKey = keyof MetricSet;
export const METRIC_KEYS: MetricKey[] = ['units', 'value', 'rate', 'area', 'collection'];

export type SalesRowKind = 'budget' | 'actual' | 'variance' | 'pct';
export interface SalesRow {
  kind: SalesRowKind;
  parameter: string;
  rowNumber: number;
  metrics: MetricSet;
}
export interface SalesBlock {
  id: string;
  /** Section text as in the sheet (first row of the block) */
  section: string;
  kind: 'quarter' | 'annual';
  rows: Partial<Record<SalesRowKind, SalesRow>>;
  unknownRows: { parameter: string; rowNumber: number }[];
  /** every numeric cell in the block is 0 or empty (e.g. the duplicate "Block 2") */
  allZero: boolean;
}

// --- tab 2
export interface ProjectSalesRow {
  project: string;
  rowNumber: number;
  targetUnits: NumCell;
  achievedUnits: NumCell;
  varianceUnits: NumCell;
  unitsPct: NumCell;
  targetValue: NumCell;
  achievedValue: NumCell;
  varianceValue: NumCell;
  valuePct: NumCell;
}

// --- tab 3a
export interface RegistrationRow {
  project: string;
  rowNumber: number;
  isTotal: boolean;
  sold: NumCell;
  registered: NumCell;
  unregistered: NumCell;
}

// --- tab 3b
export interface CollectionRow {
  project: string;
  rowNumber: number;
  isTotal: boolean;
  budget: NumCell;
  achieved: NumCell;
  variance: NumCell;
  pct: NumCell;
}

// --- tabs 4, 5, 6, 7 (Parameter x segment)
export interface ParamRow {
  parameter: string;
  rowNumber: number;
  /** contract key from ROWS when the label is recognised */
  key: string | null;
  cells: Record<string, TextCell>;
  nums: Record<string, NumCell>;
}
export interface ParamTable {
  tab: string;
  /** header of the first column, e.g. "Parameter - As on 1st July 2026" */
  firstHeader: string;
  segments: SegmentColumn[];
  rows: ParamRow[];
}

// --- tab 8
export interface AgeingRow {
  category: string;
  bucket: string;
  isTotal: boolean;
  isGrandTotal: boolean;
  rowNumber: number;
  cells: Record<string, NumCell>;
}
export interface AgeingTable {
  segments: SegmentColumn[];
  rows: AgeingRow[];
}

export type SourceKind = 'xlsx' | 'csv' | 'google-sheets' | 'google-sheets-public';

export interface DatasetMeta {
  sourceId: string;
  sourceLabel: string;
  sourceKind: SourceKind;
  location: string;
  isTest: boolean;
  testNotice: string[];
  /** e.g. "FY 2026-27" - read from tab 1 */
  fiscalYear: string | null;
  /** ISO date read from the "As on ..." headers of tabs 6/7 */
  asOn: string | null;
  asOnLabel: string | null;
  loadedAt: string;
  projects: string[];
}

export interface Dataset {
  meta: DatasetMeta;
  salesBlocks: SalesBlock[];
  projectSales: ProjectSalesRow[];
  registration: RegistrationRow[];
  collection: CollectionRow[];
  generalInfo: ParamTable;
  projectSummary: ParamTable;
  registrationSummary: ParamTable;
  collectionSummary: ParamTable;
  ageing: AgeingTable;
}

export interface SchemaError {
  tab: string;
  column?: string;
  row?: string;
  message: string;
}
