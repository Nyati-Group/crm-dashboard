/**
 * Turns the (cleaned) dataset into plain-text facts for the dashboard assistant.
 * Every figure the dashboard shows is here, with its compact and exact form, so the assistant
 * answers only from the application's data.
 */
import { val } from '../data/cells';
import { formatExact, formatPct, formatValue, type ValueKind } from '../format';
import { METRIC_META } from '../metrics';
import { ageingBuckets, ageingCategories, annualBlock, paramRow, registrationAgeingRows, visibleQuarterBlocks } from '../selectors';
import type { Dataset, MetricKey, NumCell, ParamTable } from '../schema';

function f(kind: ValueKind, c: NumCell | undefined | null): string {
  const v = val(c);
  if (v === null) return 'not available';
  if (kind === 'pct') return formatPct(v, 1);
  const short = formatValue(kind, v);
  const exact = formatExact(kind, v);
  return short === exact ? short : `${short} (${exact})`;
}

const PERIOD_METRICS: MetricKey[] = ['units', 'value', 'collection', 'area', 'rate'];

function paramTableLines(t: ParamTable, title: string, kindOf: (parameter: string) => ValueKind | 'text'): string[] {
  const out = [`## ${title}`];
  for (const s of t.segments) {
    const parts: string[] = [];
    for (const r of t.rows) {
      const k = kindOf(r.parameter);
      const text = k === 'text' ? r.cells[s.key]?.text ?? null : val(r.nums[s.key]) === null ? null : f(k, r.nums[s.key]);
      if (text !== null) parts.push(`${r.parameter}: ${text}`);
    }
    out.push(`- ${s.header}: ${parts.join('; ') || 'no figures'}`);
  }
  return out;
}

export function buildKnowledge(ds: Dataset): string {
  const L: string[] = [];
  const m = ds.meta;
  L.push(`# Nyati Sales Dashboard data`);
  L.push(`Financial year: ${m.fiscalYear ?? 'not stated'} (April to March). Data as on: ${m.asOnLabel ?? m.asOn ?? 'not stated'}.`);
  L.push(`Projects: ${m.projects.join(', ') || 'none'}.`);
  L.push(`Money is in Indian Rupees; 1 Cr (crore) = 1,00,00,000 and 1 Lakh = 1,00,000. Variance = Achieved − Budget. % = Achieved ÷ Budget.`);

  L.push('', '## Pages of the application');
  L.push('- Overview: KPI cards (units sold, sales value, collection, area sold, average rate) for the quarter and full year, Budget vs Actual charts, % of budget achieved, project health.');
  L.push('- Sales by Project: target vs achieved units and sales value per project, % of target, sortable table with CSV export.');
  L.push('- Registration: units sold / registered / unregistered, registration rate, ageing of unregistered units by days since sale.');
  L.push('- Collection & Outstanding: collection vs budget, sold value → due → collected → outstanding bridge, outstanding by age.');
  L.push('- Project Info: configuration, buildings, total units, saleable area, RERA dates, unit split and average rates.');
  L.push('- Filters on every page: financial year, project segment (Residential / Commercial / Total), Refresh button reloads the Google Sheet.');

  const blocks = [...visibleQuarterBlocks(ds), ...(annualBlock(ds) ? [annualBlock(ds)!] : [])];
  for (const b of blocks) {
    const { budget, actual, variance, pct } = b.rows;
    if (!budget || !actual) continue;
    L.push('', `## Sales & collection summary: ${b.section} (${b.kind === 'annual' ? 'full financial year, achieved so far' : 'quarter'})`);
    for (const k of PERIOD_METRICS) {
      const kind = METRIC_META[k].kind;
      L.push(
        `- ${METRIC_META[k].label}: budget ${f(kind, budget.metrics[k])}; ${b.kind === 'annual' ? 'achieved' : 'actual'} ${f(kind, actual.metrics[k])}; variance ${f(kind, variance?.metrics[k])}; achieved ${val(pct?.metrics[k]) === null ? 'n/a' : formatPct(val(pct?.metrics[k])!, 1)} of budget`,
      );
    }
  }

  L.push('', '## Project sales (target vs achieved)');
  for (const r of ds.projectSales) {
    L.push(
      `- ${r.project}: units target ${f('units', r.targetUnits)}, achieved ${f('units', r.achievedUnits)}, variance ${f('units', r.varianceUnits)}, ${f('pct', r.unitsPct)}; sales value target ${f('inr', r.targetValue)}, achieved ${f('inr', r.achievedValue)}, variance ${f('inr', r.varianceValue)}, ${f('pct', r.valuePct)}`,
    );
  }

  L.push('', '## Registration (units)');
  for (const r of ds.registration) {
    const ratio = val(r.sold) ? (val(r.registered) ?? 0) / val(r.sold)! : null;
    L.push(`- ${r.isTotal ? 'All projects (total)' : r.project}: sold ${f('units', r.sold)}, registered ${f('units', r.registered)}, unregistered ${f('units', r.unregistered)}${ratio !== null ? `, registration rate ${formatPct(ratio, 1)}` : ''}`);
  }
  const t6 = ds.registrationSummary;
  const buckets = registrationAgeingRows(t6);
  for (const s of t6.segments) {
    const n = (k: string) => paramRow(t6, k)?.nums[s.key];
    L.push(
      `- ${s.header}: sold ${f('units', n('sold'))}, registered ${f('units', n('registered'))}, unregistered ${f('units', n('unregistered'))}; unregistered ageing: ${buckets.map((b) => `${b.label} ${f('units', b.row.nums[s.key])}`).join(', ')}`,
    );
  }

  L.push('', '## Collection vs budget (by project)');
  for (const r of ds.collection) {
    L.push(`- ${r.isTotal ? 'All projects (total)' : r.project}: budget ${f('inr', r.budget)}, achieved ${f('inr', r.achieved)}, variance ${f('inr', r.variance)}, ${f('pct', r.pct)} of budget`);
  }

  L.push('', `## Collection summary${m.asOnLabel ? ` as on ${m.asOnLabel}` : ''}`);
  const t7 = ds.collectionSummary;
  for (const s of t7.segments) {
    L.push(`- ${s.header}: ${t7.rows.map((r) => `${r.parameter.replace(/\s*\(.*?\)\s*/g, ' ').trim()} ${f('inr', r.nums[s.key])}`).join('; ')}`);
  }

  L.push('', '## Outstanding by age (INR)');
  const cats = ageingCategories(ds.ageing.rows);
  for (const s of ds.ageing.segments) {
    const parts = cats.map((c) => `${c}: ${ageingBuckets(ds.ageing.rows, c).map((b) => `${b.bucket} ${f('inr', b.cells[s.key])}`).join(', ')}; ${c} total ${f('inr', ds.ageing.rows.find((r) => r.category === c && r.isTotal && !r.isGrandTotal)?.cells[s.key])}`);
    const grand = ds.ageing.rows.find((r) => r.isGrandTotal)?.cells[s.key];
    L.push(`- ${s.header.replace(/\s+INR$/i, '')}: ${parts.join(' | ')}; grand total ${f('inr', grand)}`);
  }

  L.push('');
  L.push(...paramTableLines(ds.generalInfo, 'Project general information', (p) => (/total units/i.test(p) ? 'units' : /area/i.test(p) ? 'area' : 'text')));
  L.push('');
  L.push(...paramTableLines(ds.projectSummary, 'Project summary (units and average rates)', (p) => (/rate/i.test(p) ? 'rate' : /area/i.test(p) ? 'area' : 'units')));
  return L.join('\n');
}
