import { Building2 } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Card, EmptyState, LegendItem, Num, SERIES, SectionHeading } from '@/components/ui';
import { ok } from '@/lib/data/cells';
import { formatIndianNumber } from '@/lib/format';
import { getPageContext, type PageContext, type SearchParams } from '@/lib/page-context';
import { filterSegments, paramNum, paramText } from '@/lib/selectors';
import { type Dataset, type NumCell, type ParamTable, type SegmentColumn } from '@/lib/schema';

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getPageContext(await searchParams);
  return (
    <PageShell ctx={ctx} title="Project Info" description="Configuration, units, saleable area, RERA dates and average rates.">
      {ctx.dataset && <Content ctx={ctx} />}
    </PageShell>
  );
}

function Content({ ctx }: { ctx: PageContext }) {
  const ds = ctx.dataset!;
  const segs = filterSegments(ds.projectSummary.segments, ctx.filters.seg, ctx.filters.project);
  return (
    <>
      {segs.length === 0 ? (
        <EmptyState title="No project figures for this selection." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {segs.map((s) => (
            <SegmentCard key={s.key} ds={ds} s={s} />
          ))}
        </div>
      )}

      <SectionHeading title="Project general information" />
      <SourceTable t={ds.generalInfo} numericKeys={['totalUnits', 'saleableArea']} />
      <SectionHeading title="Project summary" />
      <SourceTable t={ds.projectSummary} numericKeys="all" />
    </>
  );
}

function SegmentCard({ ds, s }: { ds: Dataset; s: SegmentColumn }) {
  const t4 = ds.generalInfo;
  const t5 = ds.projectSummary;
  const g = (k: string) => paramText(t4, k, s.key);
  const n5 = (k: string) => paramNum(t5, k, s.key);
  const isCompany = s.segment === 'total' && s.project === null;
  const fyLabel =
    t5.rows
      .find((r) => r.key === 'avgRateFy')
      ?.parameter.replace(/^Average Rate\s*/i, '')
      .replace(/^\((.*)\)$/, '$1') || 'Financial year';
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="rounded-lg bg-brand/10 p-2 text-brand">
          <Building2 aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{s.header}</h2>
          <p className="text-xs text-muted">
            {isCompany ? 'All projects combined' : g('configuration') ?? '—'}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <Fact label="Buildings" value={g('buildings')} />
        <Fact label="Total units" value={<Num cell={paramNum(t4, 'totalUnits', s.key)} kind="units" />} />
        <Fact label="Saleable area" value={<Num cell={paramNum(t4, 'saleableArea', s.key)} kind="area" />} />
        <Fact label="Project start" value={g('startDate')} />
        <Fact label="RERA registration" value={g('reraRegistration')} />
        <Fact label="Expected completion (engineering)" value={g('expectedCompletion')} />
        <Fact label="RERA completion" value={g('reraCompletion')} />
      </dl>

      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Units</h3>
      <UnitsBar
        total={n5('totalUnits')}
        parts={[
          { label: 'Sold', cell: n5('soldToDate'), color: SERIES.actual },
          { label: 'Unsold', cell: n5('unsold'), color: SERIES.budget },
          { label: 'Premium (blocked)', cell: n5('premiumBlocked'), color: SERIES.third },
          { label: 'Land owner', cell: n5('landOwnerUnits'), color: SERIES.neutral },
        ]}
      />
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <Fact label="Total units" value={<Num cell={n5('totalUnits')} kind="units" />} />
        <Fact label="For sale" value={<Num cell={n5('unitsForSale')} kind="units" />} />
        <Fact label="Sold to date" value={<Num cell={n5('soldToDate')} kind="units" />} />
        <Fact label="Unsold" value={<Num cell={n5('unsold')} kind="units" />} />
      </dl>

      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Average rate (₹ per sq.ft.)</h3>
      <dl className="grid grid-cols-3 gap-x-4 text-sm">
        <Fact label="Up to date" value={<Num cell={n5('avgRateToDate')} kind="rate" />} />
        <Fact label={fyLabel} value={<Num cell={n5('avgRateFy')} kind="rate" />} />
        <Fact label="Current month" value={<Num cell={n5('avgRateMonth')} kind="rate" />} />
      </dl>

      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Units: budget vs achieved</h3>
      <dl className="grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-4">
        <Fact label="Budget up to date" value={<Num cell={n5('budgetToDate')} kind="units" />} />
        <Fact label="Achieved up to date" value={<Num cell={n5('achievedToDate')} kind="units" />} />
        <Fact label="Budget for the Q" value={<Num cell={n5('budgetQ')} kind="units" />} />
        <Fact label="Achieved for the Q" value={<Num cell={n5('achievedQ')} kind="units" />} />
      </dl>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate font-medium tabular">{value ?? <span className="text-muted">—</span>}</dd>
    </div>
  );
}

/** Tall segmented bar: one whole (total units) split into parts; labels inside only when they fit. */
function UnitsBar({ total, parts }: { total: NumCell | undefined; parts: { label: string; cell: NumCell | undefined; color: string }[] }) {
  const usable = parts.filter((p) => ok(p.cell) && p.cell.value > 0).map((p) => ({ ...p, v: p.cell!.value! }));
  const sum = usable.reduce((s, p) => s + p.v, 0);
  if (sum === 0) return <EmptyState title="No unit breakdown in the source." />;
  const totalV = ok(total) ? total.value : null;
  const name = usable.map((p) => `${p.label} ${formatIndianNumber(p.v)}`).join(', ');
  return (
    <div>
      <div className="flex h-7 w-full gap-0.5" role="img" aria-label={`Units: ${name}`}>
        {usable.map((p) => {
          const share = p.v / sum;
          return (
            <div
              key={p.label}
              className="flex h-full items-center overflow-visible rounded px-1.5 text-[11px] font-semibold text-white first:rounded-l last:rounded-r"
              style={{ flexGrow: p.v, flexBasis: 0, background: p.color }}
              title={`${p.label}: ${formatIndianNumber(p.v)} (${Math.round(share * 100)}%)`}
            >
              {share >= 0.12 ? formatIndianNumber(p.v) : ''}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <LegendItem key={p.label} color={p.color} label={`${p.label}${ok(p.cell) ? ` ${formatIndianNumber(p.cell.value)}` : ''}`} />
        ))}
      </div>
    </div>
  );
}

function SourceTable({ t, numericKeys }: { t: ParamTable; numericKeys: string[] | 'all' }) {
  const isNum = (key: string | null) => numericKeys === 'all' || (key !== null && numericKeys.includes(key));
  return (
    <Card className="overflow-x-auto p-4">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            <th className="py-1.5 pr-3 font-medium">{t.firstHeader}</th>
            {t.segments.map((s) => (
              <th key={s.key} className="py-1.5 pr-3 text-right font-medium">
                {s.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {t.rows.map((r) => (
            <tr key={r.rowNumber} className="border-b border-line/50 last:border-0">
              <td className="py-1.5 pr-3">{r.parameter}</td>
              {t.segments.map((s) => (
                <td key={s.key} className="py-1.5 pr-3 text-right">
                  {isNum(r.key) ? (
                    <Num cell={r.nums[s.key]} kind={/area/i.test(r.parameter) ? 'area' : /rate/i.test(r.parameter) ? 'rate' : 'units'} />
                  ) : (
                    r.cells[s.key]?.text ?? <span className="text-muted">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
