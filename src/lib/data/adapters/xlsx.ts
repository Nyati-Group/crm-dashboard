import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import type { RawValue } from '../../schema';
import type { DataSourceAdapter, RawSheet, RawWorkbook, SourceConfig } from '../types';

/**
 * Convert a SheetJS worksheet to raw rows, starting at A1 so row numbers / column letters match the sheet.
 * Numbers and text are taken exactly as stored. Date cells are taken as the text the sheet DISPLAYS
 * (its own number format), so "01/12/2024" is never silently re-ordered into another date format.
 */
export function sheetToRaw(name: string, ws: XLSX.WorkSheet): RawSheet {
  const ref = ws['!ref'];
  if (!ref) return { name, rows: [], firstRow: 1 };
  const range = XLSX.utils.decode_range(ref);
  const rows: RawValue[][] = [];
  for (let r = 0; r <= range.e.r; r++) {
    const row: RawValue[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      row.push(cellValue(cell));
    }
    rows.push(row);
  }
  return { name, rows, firstRow: 1 };
}

function cellValue(cell: XLSX.CellObject | undefined): RawValue {
  if (!cell || cell.t === 'z') return null;
  switch (cell.t) {
    case 'n':
      return typeof cell.v === 'number' ? cell.v : null;
    case 's':
      return cell.v === undefined || cell.v === null ? null : String(cell.v);
    case 'b':
      return Boolean(cell.v);
    case 'd':
      return cell.w ?? (cell.v instanceof Date ? cell.v : null);
    case 'e':
      return cell.w ?? '#ERROR';
    default:
      return null;
  }
}

export function workbookToRaw(wb: XLSX.WorkBook): RawWorkbook {
  return { sheets: wb.SheetNames.map((n) => sheetToRaw(n, wb.Sheets[n])) };
}

export function resolveLocalPath(location: string): string {
  return path.isAbsolute(location) ? location : path.join(process.cwd(), location);
}

/** Reads a local .xlsx file (e.g. the file exported from the Google Sheet). */
export class XlsxAdapter implements DataSourceAdapter {
  constructor(readonly config: SourceConfig) {}

  async load(): Promise<RawWorkbook> {
    const buf = await fs.readFile(resolveLocalPath(this.config.location));
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, dense: false });
    return workbookToRaw(wb);
  }
}

/**
 * Reads a folder of CSV files, one per tab, named exactly like the tab:
 *   data/csv/1_Sales_Collection.csv, data/csv/2_Project_Sales.csv, ...
 * Cells are read as text (raw) so nothing is re-interpreted; the parser decides what is numeric.
 */
export class CsvFolderAdapter implements DataSourceAdapter {
  constructor(readonly config: SourceConfig) {}

  async load(): Promise<RawWorkbook> {
    const dir = resolveLocalPath(this.config.location);
    const files = (await fs.readdir(dir)).filter((f) => f.toLowerCase().endsWith('.csv')).sort();
    const sheets: RawSheet[] = [];
    for (const f of files) {
      const text = await fs.readFile(path.join(dir, f), 'utf8');
      const wb = XLSX.read(text.replace(/^﻿/, ''), { type: 'string', raw: true });
      const first = wb.SheetNames[0];
      sheets.push(sheetToRaw(path.basename(f, path.extname(f)), wb.Sheets[first]));
    }
    return { sheets };
  }
}
