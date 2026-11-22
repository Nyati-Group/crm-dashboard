import 'server-only';
import { cacheTtlMs } from '../config';
import { runQuality } from '../quality';
import { parseWorkbook } from './parse';
import { reconcileDataset } from './reconcile';
import { createAdapter, getSourceConfigs } from './registry';
import type { DataSourceAdapter, LoadResult, SourceConfig } from './types';

/**
 * Load one source end-to-end: adapter -> parser (schema contract) -> automatic clean-up -> checks.
 * `reconcile: false` returns the figures exactly as the sheet holds them (used by check-source --raw and tests).
 */
export async function loadWithAdapter(
  adapter: DataSourceAdapter,
  now = new Date(),
  opts: { reconcile?: boolean } = {},
): Promise<LoadResult> {
  const source = adapter.config;
  let raw;
  try {
    raw = await adapter.load();
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const message =
      err?.code === 'ENOENT'
        ? `File not found: ${source.location}`
        : `Could not read ${source.label}: ${err?.message ?? String(e)}`;
    return { status: 'unavailable', source, message, loadedAt: now.toISOString() };
  }
  const parsed = parseWorkbook(raw, source, now);
  if (!parsed.ok) return { status: 'schema_error', source, errors: parsed.errors, loadedAt: now.toISOString() };
  const dataset = opts.reconcile === false ? parsed.dataset : reconcileDataset(parsed.dataset);
  return { status: 'ok', source, dataset, quality: runQuality(dataset) };
}

// ---------------------------------------------------------------- 60-second in-memory cache

type Entry = { at: number; promise: Promise<LoadResult> };
const g = globalThis as unknown as { __nyatiCache?: Map<string, Entry> };
const cache = (g.__nyatiCache ??= new Map<string, Entry>());

function cacheKey(c: SourceConfig) {
  return `${c.kind}:${c.location}:${c.test ? 't' : ''}`;
}

export async function loadSource(config: SourceConfig): Promise<LoadResult> {
  const key = cacheKey(config);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < cacheTtlMs()) return hit.promise;
  const promise = loadWithAdapter(createAdapter(config));
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

export async function loadAllSources(): Promise<LoadResult[]> {
  return Promise.all(getSourceConfigs().map((c) => loadSource(c)));
}

export function clearDataCache() {
  cache.clear();
}
