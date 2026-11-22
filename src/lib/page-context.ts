import 'server-only';
import { CAN_SWITCH_SOURCE, type Role } from './auth/roles';
import { requireSession } from './auth/current';
import { loadAllSources } from './data/loader';
import type { LoadResult } from './data/types';
import { SEGMENTS, type Dataset } from './schema';
import type { QualityReport } from './quality/types';
import type { SegmentFilter } from './selectors';

export type SearchParams = Record<string, string | string[] | undefined>;

export interface SourceOption {
  id: string;
  label: string;
  status: LoadResult['status'];
  fiscalYear: string | null;
  isTest: boolean;
}

export interface FilterState {
  sourceId: string;
  fy: string | null;
  seg: SegmentFilter;
  project: string | null;
}

export interface PageContext {
  role: Role;
  email: string;
  canSwitchSource: boolean;
  options: SourceOption[];
  fyOptions: string[];
  projects: string[];
  filters: FilterState;
  selected: LoadResult | null;
  /** convenience when selected.status === 'ok' */
  dataset: Dataset | null;
  quality: QualityReport | null;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function getPageContext(sp: SearchParams): Promise<PageContext> {
  const session = await requireSession();
  const results = await loadAllSources();
  const options: SourceOption[] = results.map((r) => ({
    id: r.source.id,
    label: r.source.label,
    status: r.status,
    fiscalYear: r.status === 'ok' ? r.dataset.meta.fiscalYear : null,
    isTest: r.status === 'ok' ? r.dataset.meta.isTest : !!r.source.test,
  }));
  const fyOptions = [...new Set(options.map((o) => o.fiscalYear).filter((f): f is string => !!f))].sort().reverse();

  const canSwitchSource = CAN_SWITCH_SOURCE.includes(session.role);
  const wantSource = canSwitchSource ? one(sp.ds) : undefined;
  const wantFy = one(sp.fy);

  // Preference: explicit source > first loadable real source in the chosen FY > any loadable > first configured.
  const loadable = results.filter((r) => r.status === 'ok' && (!wantFy || r.dataset.meta.fiscalYear === wantFy));
  const selected =
    results.find((r) => r.source.id === wantSource) ??
    loadable.find((r) => r.status === 'ok' && !r.dataset.meta.isTest) ??
    loadable[0] ??
    results.find((r) => r.status === 'ok') ??
    results[0] ??
    null;

  const dataset = selected?.status === 'ok' ? selected.dataset : null;
  const segParam = one(sp.seg);
  const seg: SegmentFilter = segParam && (SEGMENTS as string[]).includes(segParam) ? (segParam as SegmentFilter) : 'all';
  const projects = dataset?.meta.projects ?? [];
  const projectParam = one(sp.project);

  return {
    role: session.role,
    email: session.email,
    canSwitchSource,
    options,
    fyOptions,
    projects,
    filters: {
      sourceId: selected?.source.id ?? '',
      fy: dataset?.meta.fiscalYear ?? wantFy ?? null,
      seg,
      project: projectParam && projects.includes(projectParam) ? projectParam : null,
    },
    selected,
    dataset,
    quality: selected?.status === 'ok' ? selected.quality : null,
  };
}
