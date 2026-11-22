import { ChartCard, SimpleTable } from '@/components/ChartCard';
import { AchievementBars, StatusLegend } from '@/components/charts/AchievementBars';
import { BarCompare } from '@/components/charts/BarCompare';
import { KpiCard, RateCard } from '@/components/Kpi';
import { PageShell } from '@/components/PageShell';
import { Card, EmptyState, LegendItem, Num, SERIES, SectionHeading, StatusBadge } from '@/components/ui';
import { ok, val } from '@/lib/data/cells';
import { formatPct } from '@/lib/format';
import { METRIC_META, achievementRatio, compare, outstandingState, statusFromRatio } from '@/lib/metrics';
import { getPageContext, type SearchParams } from '@/lib/page-context';
import { annualBlock, paramRow, projectSegments, registrationAgeingRows, visibleQuarterBlocks } from '@/lib/selectors';
import { SEGMENT_LABEL, type Dataset, type MetricKey, type SalesBlock } from '@/lib/schema';

export default async function OverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getPageContext(await searchParams);
  return (
    <PageShell
      ctx={ctx}
      title="Overview"
      description="Sales, collection and registration against budget for the financial year."
      segmentNote="Sales and collection KPIs on this page are for the company as a whole."
    >
      {ctx.dataset && <Overview ds={ctx.dataset} />}
    </PageShell>
  );
}

const COMPARE_METRICS: MetricKey[] = ['units', 'value', 'collection', 'area'];

function Overview({ ds }: { ds: Dataset }) {
  const quarters = visibleQuarterBlocks(ds);
  const annual = annualBlock(ds);
  const blocks = [...quarters, ...(annual ? [annual] : [])];
  return (
    <>
      {blocks.length === 0 && <EmptyState title="No budget / actual figures for this year yet." />}
      {blocks.map((b) => (
        <PeriodSection key={b.id} block={b} />
      ))}

      <SectionHeading title="Project health" sub="Each project against its own target." />
      <ProjectHealth ds={ds} />
    </>
  );
}

function periodTitle(b: SalesBlock) {
  return b.kind === 'annual' ? b.section.replace(/\s*\(.*\)$/, '') : b.section.replace(/\s*\(Block \d+\)$/i, '');
}

function PeriodSection({ block }: { block: SalesBlock }) {
  const { budget, actual, variance, pct } = block.rows;
  const isAnnual = block.kind === 'annual';
  if (!budget || !actual) return null;
  const cmp = (m: MetricKey) => compare(budget.metrics[m], actual.metrics[m], variance?.metrics[m], pct?.metrics[m]);
  const title = periodTitle(block);
  return (
    <>
      <SectionHeading title={isAnnual ? `${title} · Full year` : `${title} · Quarter`} sub={isAnnual ? 'Achieved so far against the annual budget' : 'Actual against the quarter budget'} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Units sold" kind="units" cmp={cmp('units')} />
        <KpiCard label="Sales value" kind="inr" cmp={cmp('value')} />
        <KpiCard label="Collection" kind="inr" cmp={cmp('collection')} />
        <KpiCard label="Area sold" kind="area" cmp={cmp('area')} />
        <RateCard label="Average rate" budget={budget.metrics.rate} actual={actual.metrics.rate} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-3"
          title={`Budget vs Actual · ${title}`}
          subtitle="Each measure on its own scale"
          legend={
            <>
              <LegendItem color={SERIES.budget} label="Budget" />
              <LegendItem color={SERIES.actual} label={isAnnual ? 'Achieved' : 'Actual'} />
            </>
          }
          chart={
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
              {COMPARE_METRICS.map((m) => (
                <div key={m} className="min-w-0">
                  <p className="mt-1 text-center text-xs font-semibold text-ink2">{METRIC_META[m].label}</p>
                  <BarCompare
                    ariaLabel={`${METRIC_META[m].label}: budget vs actual, ${title}`}
                    height={210}
                    kind={METRIC_META[m].kind}
                    series={[{ key: 'v', label: METRIC_META[m].label, color: SERIES.actual }]}
                    labels="all"
                    compact
                    data={[
                      { name: 'Budget', values: { v: val(budget.metrics[m]) }, color: SERIES.budget },
                      { name: isAnnual ? 'Achieved' : 'Actual', values: { v: val(actual.metrics[m]) }, color: SERIES.actual },
                    ]}
                  />
                </div>
              ))}
            </div>
          }
          table={
            <SimpleTable
              head={['Measure', 'Budget', 'Actual', 'Variance', '% achieved']}
              rows={COMPARE_METRICS.map((m) => [
                METRIC_META[m].label,
                <Num key="b" cell={budget.metrics[m]} kind={METRIC_META[m].kind} />,
                <Num key="a" cell={actual.metrics[m]} kind={METRIC_META[m].kind} />,
                <Num key="v" cell={variance?.metrics[m]} kind={METRIC_META[m].kind} signed />,
                <Num key="p" cell={pct?.metrics[m]} kind="pct" />,
              ])}
            />
          }
        />
        <ChartCard
          className="xl:col-span-2"
          title="% of budget achieved"
          subtitle={title}
          legend={<StatusLegend />}
          chart={
            <AchievementBars
              ariaLabel={`Percent of budget achieved, ${title}`}
              height={236}
              items={COMPARE_METRICS.map((m) => ({
                label: METRIC_META[m].label,
                ratio: val(pct?.metrics[m]) ?? achievementRatio(val(actual.metrics[m]), val(budget.metrics[m])),
              }))}
            />
          }
        />
      </div>
    </>
  );
}

function ProjectHealth({ ds }: { ds: Dataset }) {
  if (ds.meta.projects.length === 0) return <EmptyState title="No projects for this year yet." />;
  const ageing = registrationAgeingRows(ds.registrationSummary);
  return (
    <div className="space-y-3">
      {ds.meta.projects.map((p) => {
        const sales = ds.projectSales.find((r) => r.project === p);
        const reg = ds.registration.find((r) => r.project === p && !r.isTotal);
        const col = ds.collection.find((r) => r.project === p && !r.isTotal);
        const regSegs = projectSegments(ds.registrationSummary.segments, p);
        const colSegs = projectSegments(ds.collectionSummary.segments, p);
        const over120 = regSegs.map((s) => ({ s, cell: ageing.find((a) => a.is120Plus)?.row.nums[s.key] }));
        const os = colSegs.map((s) => ({ s, cell: paramRow(ds.collectionSummary, 'outstanding')?.nums[s.key] }));
        const regRatio = reg ? achievementRatio(val(reg.registered), val(reg.sold)) : null;
        return (
          <Card key={p} className="p-4">
            <h3 className="mb-3 font-semibold">{p}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              <HealthTile label="Sales units vs target" status={statusFromRatio(val(sales?.unitsPct) ?? null)}>
                {sales ? (
                  <>
                    <Num cell={sales.achievedUnits} kind="units" /> of <Num cell={sales.targetUnits} kind="units" /> · <Num cell={sales.unitsPct} kind="pct" />
                  </>
                ) : (
                  '—'
                )}
              </HealthTile>
              <HealthTile label="Sales value vs target" status={statusFromRatio(val(sales?.valuePct) ?? null)}>
                {sales ? (
                  <>
                    <Num cell={sales.achievedValue} kind="inr" /> · <Num cell={sales.valuePct} kind="pct" />
                  </>
                ) : (
                  '—'
                )}
              </HealthTile>
              <HealthTile label="Collection vs budget" status={statusFromRatio(val(col?.pct) ?? null)}>
                {col ? (
                  <>
                    <Num cell={col.achieved} kind="inr" /> · <Num cell={col.pct} kind="pct" />
                  </>
                ) : (
                  '—'
                )}
              </HealthTile>
              <HealthTile label="Registered of sold" status="unknown" neutral>
                {reg ? (
                  <>
                    <Num cell={reg.registered} kind="units" /> of <Num cell={reg.sold} kind="units" />
                    {regRatio !== null && <span className="text-muted"> ({formatPct(regRatio)})</span>}
                  </>
                ) : (
                  '—'
                )}
              </HealthTile>
              <HealthTile
                label="Unregistered > 120 days"
                status={over120.some((o) => ok(o.cell) && o.cell.value > 0) ? 'critical' : over120.length ? 'good' : 'unknown'}
                statusLabel={over120.some((o) => ok(o.cell) && o.cell.value > 0) ? 'Needs follow-up' : over120.length ? 'None' : '—'}
              >
                {over120.length
                  ? over120.map((o) => (
                      <span key={o.s.key} className="mr-2">
                        <Num cell={o.cell} kind="units" /> {SEGMENT_LABEL[o.s.segment]}
                      </span>
                    ))
                  : '—'}
              </HealthTile>
              <HealthTile label="Outstanding" status="unknown" neutral>
                {os.length
                  ? os.map((o) => {
                      const st = outstandingState(val(o.cell));
                      return (
                        <span key={o.s.key} className="mr-2 block">
                          {SEGMENT_LABEL[o.s.segment]}: <Num cell={o.cell} kind="inr" />
                          {st === 'advance' && <span className="ml-1 rounded bg-good/10 px-1 text-[11px] font-medium text-goodInk">Advance</span>}
                        </span>
                      );
                    })
                  : '—'}
              </HealthTile>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function HealthTile({
  label,
  status,
  statusLabel,
  neutral,
  children,
}: {
  label: string;
  status: 'good' | 'warning' | 'critical' | 'unknown';
  statusLabel?: string;
  neutral?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface2/60 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {!neutral && <StatusBadge status={status} label={statusLabel} />}
      </div>
      <p className="text-sm text-ink">{children}</p>
    </div>
  );
}
