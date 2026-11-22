/**
 * Print the data-quality report for a workbook from the command line.
 *   npm run check-source -- data/Nyati_Sales_Collection_FY2026-27.xlsx
 *   npm run check-source -- gsheet-public:<spreadsheetId>
 */
import { loadWithAdapter } from '../src/lib/data/loader';
import { createAdapter, parseSourcesEnv } from '../src/lib/data/registry';

async function main() {
  const args = process.argv.slice(2);
  const raw = args.includes('--raw');
  const arg = args.find((a) => !a.startsWith('--'));
  if (!arg) {
    console.error('usage: npm run check-source -- [--raw] <file.xlsx | kind:location>');
    console.error('  --raw  check the figures exactly as the sheet holds them (before the automatic clean-up)');
    process.exit(1);
  }
  const [config] = parseSourcesEnv(/^(xlsx|csv|gsheet|gsheet-public|google):/i.test(arg) ? arg : `xlsx:${arg}`);
  const r = await loadWithAdapter(createAdapter(config), new Date(), { reconcile: !raw });
  if (r.status !== 'ok') {
    console.log(r.status.toUpperCase());
    console.log(JSON.stringify(r.status === 'schema_error' ? r.errors : r.message, null, 1));
    process.exit(2);
  }
  const { meta } = r.dataset;
  console.log(`${meta.sourceLabel} | ${meta.fiscalYear} | as on ${meta.asOn} | test=${meta.isTest} | projects=${meta.projects.join(', ')}`);
  console.log('summary', r.quality.summary);
  for (const c of r.quality.checks.filter((c) => c.status !== 'pass')) {
    console.log(`[${c.status}/${c.severity}] ${c.rule} | ${c.tab} | ${c.subject}\n    ${c.message}`);
  }
}

void main();
