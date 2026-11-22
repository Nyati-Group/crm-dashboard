import { Suspense } from 'react';
import { formatDateISO } from '@/lib/format';
import type { PageContext } from '@/lib/page-context';
import { DataProblem } from './DataProblem';
import { FilterBar } from './FilterBar';

/**
 * Wraps every dashboard page: title, the shared filter row (FY, source, segment, Data as on, Refresh),
 * and the error page when the source is missing or doesn't match the contract.
 * `children` is only rendered when a dataset loaded successfully.
 */
export function PageShell({
  ctx,
  title,
  description,
  segmentNote,
  children,
}: {
  ctx: PageContext;
  title: string;
  description?: string;
  segmentNote?: string;
  children: React.ReactNode;
}) {
  const ds = ctx.dataset;
  const loadedAt = ctx.selected ? (ctx.selected.status === 'ok' ? ctx.selected.dataset.meta.loadedAt : ctx.selected.loadedAt) : null;
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <Suspense>
        <FilterBar
          options={ctx.options}
          fyOptions={ctx.fyOptions}
          projects={ctx.projects}
          canSwitchSource={ctx.canSwitchSource}
          filters={ctx.filters}
          asOn={ds?.meta.asOn ? formatDateISO(ds.meta.asOn) : null}
          loadedAt={loadedAt}
          segmentNote={ds ? segmentNote : undefined}
        />
      </Suspense>
      {ds ? children : <DataProblem ctx={ctx} />}
    </div>
  );
}
