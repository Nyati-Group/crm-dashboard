/**
 * Builds data/fixtures/BROKEN_missing_column_TEST.xlsx from the TEST workbook by renaming one
 * contract column ("Achieved Units" -> "Achieved Unit") and deleting one tab (7_Collection_Summary).
 * The app must show an error page naming both, not crash and not show zeros.
 *
 *   npm run fixtures
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const dataDir = path.join(process.cwd(), 'data');
const testFile = readdirSync(dataDir).find((f) => /TEST\.xlsx$/i.test(f) && !f.startsWith('~$'));
if (!testFile) {
  console.error('No *_TEST.xlsx found in ./data - copy the scaled test workbook there first.');
  process.exit(1);
}
const wb = XLSX.read(readFileSync(path.join(dataDir, testFile)), { type: 'buffer' });

const sales = wb.Sheets['2_Project_Sales'];
const header = Object.keys(sales).find((k) => !k.startsWith('!') && sales[k].v === 'Achieved Units');
if (header) sales[header] = { t: 's', v: 'Achieved Unit' };

wb.SheetNames = wb.SheetNames.filter((n) => n !== '7_Collection_Summary');
delete wb.Sheets['7_Collection_Summary'];

const outDir = path.join(dataDir, 'fixtures');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'BROKEN_missing_column_TEST.xlsx');
writeFileSync(out, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log(`Wrote ${path.relative(process.cwd(), out)}`);
