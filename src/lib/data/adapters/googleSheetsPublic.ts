import 'server-only';
import * as XLSX from 'xlsx';
import type { DataSourceAdapter, RawWorkbook, SourceConfig } from '../types';
import { workbookToRaw } from './xlsx';

/**
 * Reads a Google Sheet that is shared as "Anyone with the link can view", with no credentials,
 * by downloading Google's own .xlsx export of the whole workbook. Cell types are kept exactly
 * (numbers stay numbers, text stays text), so it parses identically to a local .xlsx.
 *
 * Use the service-account adapter (kind "gsheet") for sheets that are not link-shared.
 * (Google's "gviz" CSV endpoint is deliberately NOT used: it blanks text values in numeric
 * columns, which would silently drop figures like "17,60,00,000".)
 */
export class GoogleSheetsPublicAdapter implements DataSourceAdapter {
  constructor(readonly config: SourceConfig) {}

  async load(): Promise<RawWorkbook> {
    const id = encodeURIComponent(this.config.location);
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, {
      redirect: 'follow',
      cache: 'no-store',
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || type.includes('text/html')) {
      throw new Error(
        `Google Sheet ${this.config.location} could not be exported (HTTP ${res.status}). ` +
          'Share it as "Anyone with the link can view", or use the service-account source (gsheet:).',
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return workbookToRaw(XLSX.read(buf, { type: 'buffer', cellDates: true }));
  }
}
