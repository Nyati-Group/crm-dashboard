import { TriangleAlert } from 'lucide-react';
import { ChartCard, SimpleTable } from '@/components/ChartCard';
import { BarCompare } from '@/components/charts/BarCompare';
import { Donut } from '@/components/charts/Donut';
import { StackedBar } from '@/components/charts/StackedBar';
import { StatTile } from '@/components/Kpi';
import { PageShell } from '@/components/PageShell';
import { EmptyState, LegendItem, Num, SERIES, SectionHeading } from '@/components/ui';
import { ok, val } from '@/lib/data/cells';
import { formatPct } from '@/lib/format';
import { achievementRatio } from '@/lib/metrics';
import { getPageContext, type SearchParams } from '@/lib/page-context';
import { filterSegments, paramRow, registrationAgeingRows } from '@/lib/selectors';
import { SEGMENT_LABEL } from '@/lib/schema';

export default async function RegistrationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getPageContext(await searchParams);
  return (
    <PageShell
      ctx={ctx}
      title="Registration"
      description="Sale-agreement registration of sold units, and how long unregistered units have been waiting."
      segmentNote="The segment filter applies to the ageing section."
    >
      {ctx.dataset && <Content ctx={ctx} />}
    </PageShell>
  );
}

function Content({ ctx }: { ctx: Awaited<ReturnType<typeof getPageContext>> }) {
  const ds = ctx.dataset!;
  const projects = ds.registration.filter((r) => !r.isTotal && (!ctx.filters.project || r.project === ctx.filters.project));
  const total = ds.registration.find((r) => r.isTotal);
  const sum = (k: 'sold' | 'registered' | 'unregistered') =>
    ctx.filters.project || !total ? projects.reduce((s, r) => s + (val(r[k]) ?? 0), 0) : val(total[k]);
  const sold = sum('sold');
  const registered = sum('registered');
  const unregistered = sum('unregistered');
  const regPct = achievementRatio(registered, sold);
  const t6 = ds.registrationSummary;
  const segs = filterSegments(t6.segments, ctx.filters.seg, ctx.filters.project);
  const buckets = registrationAgeingRows(t6);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Units sold">{sold ?? '—'}</StatTile>
        <StatTile label="Registered" sub={regPct !== null ? `${formatPct(regPct)} of sold` : undefined}>
          {registered ?? '—'}
        </StatTile>
        <StatTile label="Unregistered" sub={regPct !== null ? `${formatPct(1 - regPct)} of sold` : undefined}>
          {unregistered ?? '—'}
        </StatTile>
        <StatTile label="Registration rate" tone={regPct !== null && regPct >= 0.8 ? 'good' : undefined}>
          {regPct === null ? '—' : formatPct(regPct)}
        </StatTile>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Registration status"
          subtitle={ctx.filters.project ?? 'All projects'}
          chart={
            <div className="py-2">
              <Donut
                ariaLabel="Registered and unregistered share of sold units"
                kind="units"
                centerLabel="Units sold"
                centerValue={sold}
                parts={[
                  { label: 'Registered', value: registered, color: SERIES.actual },
                  { label: 'Unregistered', value: unregistered, color: SERIES.budget },
                ]}
              />
            </div>
          }
          table={
            <SimpleTable
              head={['Project', 'Sold', 'Registered', 'Unregistered']}
              rows={[...projects, ...(total && !ctx.filters.project ? [total] : [])].map((r) => [
                r.isTotal ? <strong key="p">Total</strong> : r.project,
                <Num key="s" cell={r.sold} kind="units" />,
                <Num key="r" cell={r.registered} kind="units" />,
                <Num key="u" cell={r.unregistered} kind="units" />,
              ])}
            />
          }
        />
        <ChartCard
          title="Registration by project"
          subtitle="Registered + Unregistered = Sold"
          legend={
            <>
              <LegendItem color={SERIES.actual} label="Registered" />
              <LegendItem color={SERIES.budget} label="Unregistered" />
            </>
          }
          chart={
            projects.length ? (
              <StackedBar
                ariaLabel="Registered and unregistered units by project"
                kind="units"
                totalLabel="Sold"
                height={Math.max(200, projects.length * 64 + 60)}
                series={[
                  { key: 'registered', label: 'Registered', color: SERIES.actual },
                  { key: 'unregistered', label: 'Unregistered', color: SERIES.budget },
                ]}
                data={projects.map((r) => ({
                  name: r.project,
                  values: { registered: val(r.registered), unregistered: val(r.unregistered) },
                  total: val(r.sold),
                }))}
              />
            ) : (
              <EmptyState title="No projects for this selection." />
            )
          }
        />
      </div>

      <SectionHeading title="Unregistered units: ageing" sub={`Days since sale${ds.meta.asOnLabel ? ` · as on ${ds.meta.asOnLabel}` : ''}`} />
      {segs.length === 0 ? (
        <EmptyState title={`No ${ctx.filters.seg === 'all' ? '' : SEGMENT_LABEL[ctx.filters.seg as 'residential'].toLowerCase() + ' '}ageing figures for this selection.`}>
          Ageing is available for: {t6.segments.map((s) => s.header).join(', ') || '—'}.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {segs.map((s) => {
            const n = (k: string) => paramRow(t6, k)?.nums[s.key];
            const over = buckets.find((b) => b.is120Plus)?.row.nums[s.key];
            const overCount = ok(over) ? over.value : null;
            return (
              <ChartCard
                key={s.key}
                title={s.header}
                subtitle="Unregistered units by days since sale"
                legend={
                  <>
                    <LegendItem color={SERIES.actual} label="Up to 120 days" />
                    <LegendItem color={SERIES.critical} label="Over 120 days" />
                  </>
                }
                chart={
                  <>
                    <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        ['Sold', n('sold')],
                        ['Registered', n('registered')],
                        ['Unregistered', n('unregistered')],
                      ].map(([label, cell]) => (
                        <div key={label as string} className="rounded-lg bg-surface2 p-2">
                          <dt className="text-xs text-muted">{label as string}</dt>
                          <dd className="text-lg font-semibold">
                            <Num cell={cell as ReturnType<typeof n>} kind="units" />
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {overCount !== null && overCount > 0 && (
                      <p className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-bad/10 px-2 py-1 text-xs font-medium text-badInk">
                        <TriangleAlert aria-hidden className="h-3.5 w-3.5" />
                        {overCount} unit{overCount === 1 ? '' : 's'} unregistered for more than 120 days
                      </p>
                    )}
                    {buckets.length ? (
                      <BarCompare
                        ariaLabel={`Unregistered units by ageing bucket, ${s.header}`}
                        kind="units"
                        height={240}
                        labels="all"
                        series={[{ key: 'units', label: 'Unregistered units', color: SERIES.actual }]}
                        data={buckets.map((b) => ({
                          name: b.label.replace(/\s*days$/i, '').replace(/^0(\d)/, '$1') + ' d',
                          color: b.is120Plus ? SERIES.critical : SERIES.actual,
                          values: { units: val(b.row.nums[s.key]) },
                          footer: b.is120Plus ? 'Over 120 days: needs follow-up' : undefined,
                        }))}
                      />
                    ) : (
                      <EmptyState title="No ageing figures." />
                    )}
                  </>
                }
                table={
                  <SimpleTable
                    head={['Days since sale', 'Unregistered units']}
                    rows={buckets.map((b) => [b.label, <Num key="v" cell={b.row.nums[s.key]} kind="units" />])}
                  />
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
