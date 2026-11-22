export type Severity = 'error' | 'warning' | 'info';
export type CheckStatus = 'pass' | 'fail' | 'skipped';

/** Every chart/table that can carry a data-quality warning badge. */
export type ChartId =
  | 'overview.kpis'
  | 'overview.quarter'
  | 'overview.annual'
  | 'overview.health'
  | 'sales.chart'
  | 'sales.table'
  | 'registration.byProject'
  | 'registration.ageing'
  | 'collection.byProject'
  | 'collection.waterfall'
  | 'collection.ageing'
  | 'info.general'
  | 'info.summary';

export type RuleId =
  | 'non-numeric'
  | 'registration-sum'
  | 'total-row'
  | 'sold-cross-tab'
  | 'total-column'
  | 'pct-ratio'
  | 'variance'
  | 'zero-block'
  | 'annual-vs-quarter'
  | 'summary-arithmetic'
  | 'registration-summary'
  | 'outstanding-arithmetic'
  | 'outstanding-cross-tab'
  | 'ageing-sum'
  | 'segment-coverage';

export const RULES: Record<RuleId, { title: string; description: string }> = {
  'non-numeric': {
    title: 'Number cells that are not numbers',
    description:
      'A number was expected but the cell holds text (for example "1,03" looks truncated). It is shown as "Needs clarification" and left out of every total and comparison.',
  },
  'registration-sum': {
    title: 'Registered + Unregistered = Sold',
    description: 'For every row of 3a_Registration, registered plus unregistered units should equal sold units.',
  },
  'total-row': {
    title: 'TOTAL row = sum of project rows',
    description:
      'The TOTAL row should equal the sum of the project rows above it. A difference usually means the TOTAL includes projects that are not listed in this sheet.',
  },
  'sold-cross-tab': {
    title: 'Sold units agree across tabs',
    description: 'Sold units in 3a_Registration and 6_Registration_Summary should match "Total Sold up to date" in 5_Project_Summary.',
  },
  'total-column': {
    title: 'Total column = Residential + Commercial',
    description:
      'In tabs 4 and 5 the Total column should equal the sum of the segment columns. When it does not but is internally consistent, it probably covers projects not in this sheet.',
  },
  'pct-ratio': {
    title: '% column = Achieved ÷ Target',
    description: `Each stored percentage should equal Achieved ÷ Target/Budget, within 1 percentage point.`,
  },
  variance: {
    title: 'Variance = Achieved − Budget',
    description: 'Each stored variance should equal Achieved − Budget/Target. A reversed sign means the sheet used Budget − Achieved.',
  },
  'zero-block': {
    title: 'Duplicate blocks that are all zero',
    description: 'Blocks of 1_Sales_Collection whose every value is 0. They are hidden on the Overview and listed here.',
  },
  'annual-vs-quarter': {
    title: 'Annual achieved ≥ quarter actual',
    description: 'The FY "Achieved" figures should include the Apr–Jun actuals, so they cannot be smaller.',
  },
  'summary-arithmetic': {
    title: 'Project summary arithmetic',
    description: 'In 5_Project_Summary: Units for Sale = Total − Land Owner − Premium (Blocked); Unsold = For Sale − Sold; Variance = Achieved − Budget.',
  },
  'registration-summary': {
    title: 'Registration summary arithmetic',
    description: 'In 6_Registration_Summary: Registered + Unregistered = Sold, and the ageing buckets add up to Unregistered.',
  },
  'outstanding-arithmetic': {
    title: 'Outstanding arithmetic',
    description: 'In 7_Collection_Summary: Outstanding = Due − Collected, and Registered O/s + Unregistered O/s = Outstanding.',
  },
  'outstanding-cross-tab': {
    title: 'Outstanding agrees across tabs',
    description: 'Outstanding in 7_Collection_Summary should match the totals in 8_Ageing_Outstanding.',
  },
  'ageing-sum': {
    title: 'Ageing buckets add up',
    description: 'In 8_Ageing_Outstanding the buckets should add up to each Total row, and the Grand Total to the category totals.',
  },
  'segment-coverage': {
    title: 'Segments covered by every tab',
    description: 'Residential / Commercial columns that exist in 5_Project_Summary but are missing from another tab.',
  },
};

export interface Check {
  id: string;
  rule: RuleId;
  status: CheckStatus;
  severity: Severity;
  tab: string;
  /** what is being checked, e.g. "Apr-Jun 2026 (Block 1) · Collection" */
  subject: string;
  message: string;
  cells: string[];
  affects: ChartId[];
}

export interface NeedsClarification {
  ref: string;
  raw: string;
  context: string;
}

export interface HiddenBlock {
  section: string;
  rows: number[];
}

export interface QualityReport {
  checks: Check[];
  needsClarification: NeedsClarification[];
  hiddenBlocks: HiddenBlock[];
  summary: { errors: number; warnings: number; info: number; passed: number; skipped: number };
}
