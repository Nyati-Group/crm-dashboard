import { ChartCard, SimpleTable } from '@/components/ChartCard';
import { AchievementBars, StatusLegend } from '@/components/charts/AchievementBars';
import { BarCompare } from '@/components/charts/BarCompare';
import { DataTable, type DTColumn } from '@/components/DataTable';
import { PageShell } from '@/components/PageShell';
import { Card, EmptyState, LegendItem, Num, SERIES, SectionHeading } from '@/components/ui';
import { val } from '@/lib/data/cells';
import { getPageContext, type SearchParams } from '@/lib/page-context';
import { dtNum, dtText } from '@/lib/table-cells';
import { COLUMNS } from '@/lib/schema';

const C = COLUMNS.projectSales;
const columns: DTColumn[] = [
  { key: 'project', label: C.project, kind: 'text' },
  { key: 'targetUnits', label: C.targetUnits, kind: 'units' },
  { key: 'achievedUnits', label: C.achievedUnits, kind: 'units' },
  { key: 'varianceUnits', label: C.varianceUnits, kind: 'units', signed: true },
  { key: 'unitsPct', label: C.unitsPct, kind: 'pct' },
  { key: 'targetValue', label: C.targetValue, kind: 'inr' },
  { key: 'achievedValue', label: C.achievedValue, kind: 'inr' },
  { key: 'varianceValue', label: C.varianceValue, kind: 'inr', signed: true },
  { key: 'valuePct', label: C.valuePct, kind: 'pct' },
];

export default async function SalesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getPageContext(await searchParams);
  const ds = ctx.dataset;
  const rows = ds ? ds.projectSales.filter((r) => !ctx.filters.project || r.project === ctx.filters.project) : [];
  const chartH = Math.max(260, rows.length * 40 + 200);
  return (
    <PageShell ctx={ctx} title="Sales by Project" description="Target vs achieved units and sales value for each project." segmentNote="Project sales are reported per project (Residential and Commercial together).">
      {ds && (
        <>
          {rows.length === 0 ? (
            <EmptyState title="No project sales for this year yet." />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {(
                  [
                    ['Units', 'units', 'targetUnits', 'achievedUnits', 'varianceUnits', 'unitsPct'],
                    ['Sales value', 'inr', 'targetValue', 'achievedValue', 'varianceValue', 'valuePct'],
                  ] as const
                ).map(([label, kind, t, a, v, p]) => (
                  <ChartCard
                    key={label}
                    title={`${label}: Target vs Achieved`}
                    subtitle="By project"
                    legend={
                      <>
                        <LegendItem color={SERIES.budget} label="Target" />
                        <LegendItem color={SERIES.actual} label="Achieved" />
                      </>
                    }
                    chart={
                      <BarCompare
                        ariaLabel={`${label}: target vs achieved by project`}
                        kind={kind}
                        height={chartH}
                        series={[
                          { key: 'target', label: 'Target', color: SERIES.budget },
                          { key: 'achieved', label: 'Achieved', color: SERIES.actual },
                        ]}
                        data={rows.map((r) => ({ name: r.project, values: { target: val(r[t]), achieved: val(r[a]) } }))}
                      />
                    }
                    table={
                      <SimpleTable
                        head={['Project', 'Target', 'Achieved', 'Variance', '%']}
                        rows={rows.map((r) => [
                          r.project,
                          <Num key="t" cell={r[t]} kind={kind} />,
                          <Num key="a" cell={r[a]} kind={kind} />,
                          <Num key="v" cell={r[v]} kind={kind} signed />,
                          <Num key="p" cell={r[p]} kind="pct" />,
                        ])}
                      />
                    }
                  />
                ))}
                <ChartCard
                  className="lg:col-span-2 2xl:col-span-1"
                  title="% of target achieved"
                  subtitle="Units and sales value, by project"
                  legend={<StatusLegend />}
                  chart={
                    <AchievementBars
                      ariaLabel="Percent of target achieved by project"
                      items={rows.flatMap((r) => [
                        { label: rows.length > 1 ? `${r.project} · Units` : 'Units', ratio: val(r.unitsPct) },
                        { label: rows.length > 1 ? `${r.project} · Value` : 'Sales value', ratio: val(r.valuePct) },
                      ])}
                    />
                  }
                />
              </div>

              <SectionHeading title="Project table" sub="Sort by any column; Export downloads the table as CSV." />
              <Card className="p-4">
                <DataTable
                  caption="Sales by project"
                  filename={`sales-by-project_${ds.meta.fiscalYear ?? 'FY'}.csv`.replace(/\s+/g, '-')}
                  columns={columns}
                  rows={rows.map((r) => ({
                    id: `${r.project}-${r.rowNumber}`,
                    cells: {
                      project: dtText(r.project),
                      targetUnits: dtNum(r.targetUnits),
                      achievedUnits: dtNum(r.achievedUnits),
                      varianceUnits: dtNum(r.varianceUnits),
                      unitsPct: dtNum(r.unitsPct),
                      targetValue: dtNum(r.targetValue),
                      achievedValue: dtNum(r.achievedValue),
                      varianceValue: dtNum(r.varianceValue),
                      valuePct: dtNum(r.valuePct),
                    },
                  }))}
                />
              </Card>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
