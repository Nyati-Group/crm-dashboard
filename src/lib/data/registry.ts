import 'server-only';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { SourceKind } from '../schema';
import type { DataSourceAdapter, SourceConfig } from './types';
import { CsvFolderAdapter, XlsxAdapter } from './adapters/xlsx';
import { GoogleSheetsAdapter } from './adapters/googleSheets';
import { GoogleSheetsPublicAdapter } from './adapters/googleSheetsPublic';

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'source';
}

const KIND_ALIASES: Record<string, SourceKind> = {
  xlsx: 'xlsx',
  csv: 'csv',
  gsheet: 'google-sheets',
  google: 'google-sheets',
  'google-sheets': 'google-sheets',
  'gsheet-public': 'google-sheets-public',
};

/** Accept a full Google Sheets URL or a bare spreadsheet ID. */
export function spreadsheetIdFrom(location: string): string {
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(location);
  return m ? m[1] : location;
}

/**
 * DATA_SOURCES="kind:location|Label|flags;kind:location|Label"
 *   kind  = xlsx | csv | gsheet (service account) | gsheet-public (link-shared, no credentials)
 *   flags = optional "test" -> always show the TEST DATA banner for this source
 * e.g. gsheet-public:1fg_...|Google Sheet|test;xlsx:data/Nyati_Sales_Collection_FY2026-27.xlsx|Nyati FY 2026-27
 * When unset, every .xlsx in ./data and ./data/fixtures is offered (zero-config local run).
 */
export function parseSourcesEnv(value: string): SourceConfig[] {
  const out: SourceConfig[] = [];
  for (const entry of value.split(';').map((e) => e.trim()).filter(Boolean)) {
    const colon = entry.indexOf(':');
    if (colon < 0) continue;
    const kind = KIND_ALIASES[entry.slice(0, colon).trim().toLowerCase()];
    if (!kind) continue;
    const [rawLocation, label, flags] = entry.slice(colon + 1).split('|').map((s) => s.trim());
    if (!rawLocation) continue;
    const location = kind.startsWith('google') ? spreadsheetIdFrom(rawLocation) : rawLocation;
    const name = label || path.basename(location);
    let id = slug(name);
    while (out.some((o) => o.id === id)) id += '-2';
    const test = /\btest\b/i.test(flags ?? '');
    out.push({ id, kind, location, label: name, ...(test ? { test } : {}) });
  }
  return out;
}

function discoverLocal(): SourceConfig[] {
  const dirs = ['data', path.join('data', 'fixtures')];
  const out: SourceConfig[] = [];
  for (const d of dirs) {
    const abs = path.join(process.cwd(), d);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs).sort()) {
      if (!f.toLowerCase().endsWith('.xlsx') || f.startsWith('~$')) continue;
      const label = f.replace(/\.xlsx$/i, '').replace(/_/g, ' ');
      out.push({ id: slug(label), kind: 'xlsx', location: path.join(d, f), label });
    }
  }
  return out;
}

export function getSourceConfigs(): SourceConfig[] {
  const env = process.env.DATA_SOURCES?.trim();
  return env ? parseSourcesEnv(env) : discoverLocal();
}

export function createAdapter(config: SourceConfig): DataSourceAdapter {
  switch (config.kind) {
    case 'xlsx':
      return new XlsxAdapter(config);
    case 'csv':
      return new CsvFolderAdapter(config);
    case 'google-sheets':
      return new GoogleSheetsAdapter(config);
    case 'google-sheets-public':
      return new GoogleSheetsPublicAdapter(config);
  }
}
