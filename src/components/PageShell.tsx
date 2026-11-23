import type { PageContext } from '@/lib/page-context';
import { DataProblem } from './DataProblem';

/**
 * Wraps every dashboard page: title, and the error page when the source is missing or doesn't match the contract.
 * `children` is only rendered when a dataset loaded successfully.
 */
export function PageShell({ ctx, title, description, children }: { ctx: PageContext; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {ctx.dataset ? children : <DataProblem ctx={ctx} />}
    </div>
  );
}
