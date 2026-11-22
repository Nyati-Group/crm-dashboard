import type { Dataset } from '../schema';
import { ALL_RULES } from './rules';
import type { ChartId, Check, QualityReport } from './types';

export function runQuality(ds: Dataset): QualityReport {
  const checks: Check[] = [];
  let n = 0;
  for (const rule of ALL_RULES) {
    for (const c of rule(ds)) checks.push({ ...c, id: `${c.rule}-${++n}` });
  }
  const failed = checks.filter((c) => c.status === 'fail');
  const needsClarification = checks
    .filter((c) => c.rule === 'non-numeric' && c.severity === 'error')
    .map((c) => ({ ref: c.cells[0], raw: c.message.match(/holds (".*?"|blank)/)?.[1] ?? '', context: c.subject }));
  const hiddenBlocks = ds.salesBlocks
    .filter((b) => b.allZero)
    .map((b) => ({ section: b.section, rows: Object.values(b.rows).map((r) => r!.rowNumber) }));
  return {
    checks,
    needsClarification,
    hiddenBlocks,
    summary: {
      errors: failed.filter((c) => c.severity === 'error').length,
      warnings: failed.filter((c) => c.severity === 'warning').length,
      info: failed.filter((c) => c.severity === 'info').length,
      passed: checks.filter((c) => c.status === 'pass').length,
      skipped: checks.filter((c) => c.status === 'skipped').length,
    },
  };
}

/** Failing errors/warnings that affect a chart - drives the warning badge on that chart. */
export function issuesFor(report: QualityReport, chart: ChartId): Check[] {
  return report.checks.filter((c) => c.status === 'fail' && c.severity !== 'info' && c.affects.includes(chart));
}

/** Failing checks that reference a specific cell. */
export function issuesForCell(report: QualityReport, ref: string): Check[] {
  return report.checks.filter((c) => c.status === 'fail' && c.cells.includes(ref));
}
