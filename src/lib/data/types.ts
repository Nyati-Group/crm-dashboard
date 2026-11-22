import type { Dataset, RawValue, SchemaError, SourceKind } from '../schema';
import type { QualityReport } from '../quality/types';

/** One tab as delivered by an adapter: rows of raw cell values, top row = sheet row `firstRow`. */
export interface RawSheet {
  name: string;
  rows: RawValue[][];
  firstRow: number;
}

/** What every adapter returns. The parser and UI never know which adapter produced it. */
export interface RawWorkbook {
  sheets: RawSheet[];
}

export interface SourceConfig {
  id: string;
  label: string;
  kind: SourceKind;
  /** file path, CSV directory, or Google spreadsheet ID */
  location: string;
  /** mark this source as TEST data even if it has no README tab saying so */
  test?: boolean;
}

/** The single data-access interface. Implemented by xlsx, csv and google-sheets adapters. */
export interface DataSourceAdapter {
  readonly config: SourceConfig;
  load(): Promise<RawWorkbook>;
}

export type LoadResult =
  | { status: 'ok'; source: SourceConfig; dataset: Dataset; quality: QualityReport }
  | { status: 'schema_error'; source: SourceConfig; errors: SchemaError[]; loadedAt: string }
  | { status: 'unavailable'; source: SourceConfig; message: string; loadedAt: string };
