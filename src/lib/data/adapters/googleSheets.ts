import 'server-only';
import type { RawValue } from '../../schema';
import type { DataSourceAdapter, RawWorkbook, SourceConfig } from '../types';

/**
 * Reads the company Google Sheet through the Sheets API with a service account (read-only scope).
 *
 * Environment (never hard-coded):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   service account e-mail
 *   GOOGLE_PRIVATE_KEY             its private key ("\n" escapes are accepted)
 *   - or - GOOGLE_APPLICATION_CREDENTIALS = path to the service-account JSON key file
 * The spreadsheet ID comes from DATA_SOURCES (gsheet:<spreadsheetId>|Label).
 * Share the sheet with the service-account e-mail as "Viewer".
 *
 * Values are requested UNFORMATTED so numbers arrive as numbers (ratios stay ratios),
 * matching what the xlsx adapter produces. The app never writes to the sheet.
 */
export class GoogleSheetsAdapter implements DataSourceAdapter {
  constructor(readonly config: SourceConfig) {}

  async load(): Promise<RawWorkbook> {
    const { sheets: sheetsApi, auth: gauth } = await import('@googleapis/sheets');
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
    const auth =
      email && key
        ? new gauth.GoogleAuth({ credentials: { client_email: email, private_key: key }, scopes })
        : new gauth.GoogleAuth({ scopes }); // falls back to GOOGLE_APPLICATION_CREDENTIALS
    const api = sheetsApi({ version: 'v4', auth });
    const spreadsheetId = this.config.location;

    const meta = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const titles = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => !!t);
    if (titles.length === 0) return { sheets: [] };

    const res = await api.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: titles.map((t) => `'${t.replace(/'/g, "''")}'`),
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
      majorDimension: 'ROWS',
    });
    const ranges = res.data.valueRanges ?? [];
    return {
      sheets: titles.map((name, i) => {
        const vr = ranges[i];
        // A whole-sheet range always starts at A1, so the first returned row is sheet row 1.
        const rows = (vr?.values ?? []).map((r) =>
          r.map((v): RawValue => (v === '' || v === undefined ? null : (v as RawValue))),
        );
        return { name, rows, firstRow: 1 };
      }),
    };
  }
}
