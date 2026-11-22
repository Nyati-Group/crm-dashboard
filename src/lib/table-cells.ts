import type { DTCell } from '@/components/DataTable';
import type { NumCell } from './schema';

/** Serialise a sheet cell for the client table. */
export function dtNum(cell: NumCell | undefined): DTCell {
  if (!cell) return { value: null, raw: null, status: 'empty' };
  const raw = cell.raw instanceof Date ? cell.raw.toISOString().slice(0, 10) : cell.raw;
  return { value: cell.value, raw, status: cell.status, ref: cell.ref };
}

export function dtText(text: string): DTCell {
  return { value: null, raw: text, status: 'text' };
}
