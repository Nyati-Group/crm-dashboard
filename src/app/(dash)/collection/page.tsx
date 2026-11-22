import { ChartCard, SimpleTable } from '@/components/ChartCard';
import { BarCompare } from '@/components/charts/BarCompare';
import { StackedColumns } from '@/components/charts/StackedColumns';
import { Waterfall, type WaterfallStep } from '@/components/charts/Waterfall';
import { KpiCard, StatTile } from '@/components/Kpi';
import { PageShell } from '@/components/PageShell';
import { EmptyState, LegendItem, Num, SERIES, SectionHeading, Value } from '@/components/ui';
import { ok, val } from '@/lib/data/cells';
import { formatINR, formatPct } from '@/lib/format';
import { compare, outstandingState } from '@/lib/metrics';
import { getPageContext, type PageContext, type SearchParams } from '@/lib/page-context';
import { ageingBuckets, ageingCategories, filterSegments, paramRow } from '@/lib/selectors';
import { SEGMENT_LABEL, type NumCell, type SegmentColumn } from '@/lib/schema';

export default async function CollectionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getPageContext(await searchParams);
  return (
    <PageShell
      ctx={ctx}
      title="Collection & Outstanding"
      description="Collection against budget, what is due and collected, and how old the outstanding amounts are."
      segmentNote="The segment filter applies to the outstanding sections."
    >
      {ctx.dataset && <Content ctx={ctx} />}
    </PageShell>
  );
}

function AdvanceChip({ cell }: { cell: NumCell | undefined }) {
  const st = outstandingState(val(cell));
  if (st !== 'advance') return null;
  return (
    <span className="ml-1 rounded bg-good/10 px-1.5 py-0.5 text-[11px] font-medium text-goodInk" title="Negative outstanding: collected ahead of milestone">
      Advance
    </span>
  );
}

function Content({ ctx }: { ctx: PageContext }) {
  const ds = ctx.dataset!;
  const projects = ds.collection.filter((r) => !r.isTotal && (!ctx.filters.project || r.project === ctx.filters.project));
  const total = ds.collection.find((r) => r.isTotal);
  const head = !ctx.filters.project && total ? total : projects.length === 1 ? projects[0] : null;
  const t7 = ds.collectionSummary;
  const segs7 = filterSegments(t7.segments, ctx.filters.seg, ctx.filters.project);
  const segs8 = filterSegments(ds.ageing.segments, ctx.filters.seg, ctx.filters.project);

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-2">
          {head ? (
            <KpiCard label={`Collection · ${head.isTotal ? 'All projects' : head.project}`} kind="inr" cmp={compare(head.budget, head.achieved, head.variance, head.pct)} />
          ) : (
            <EmptyState title="No collection figures for this selection." />
          )}
        </div>
        <ChartCard
          className="xl:col-span-3"
          title="Collection vs budget"
          subtitle="By project"
          legend={
            <>
              <LegendItem color={SERIES.budget} label="Budget" />
              <LegendItem color={SERIES.actual} label="Achieved" />
            </>
          }
          chart={
            projects.length ? (
              <BarCompare
                ariaLabel="Collection budget vs achieved by project"
                kind="inr"
                orientation="horizontal"
                height={Math.max(170, projects.length * 72 + 50)}
                series={[
                  { key: 'budget', label: 'Budget', color: SERIES.budget },
                  { key: 'achieved', label: 'Achieved', color: SERIES.actual },
                ]}
                data={projects.map((r) => ({ name: r.project, values: { budget: val(r.budget), achieved: val(r.achieved) } }))}
              />
            ) : (
              <EmptyState title="No projects for this selection." />
            )
          }
          table={
            <SimpleTable
              head={['Project', 'Budget', 'Achieved', 'Variance', '%']}
              rows={[...projects, ...(total && !ctx.filters.project ? [total] : [])].map((r) => [
                r.isTotal ? <strong key="p">Total</strong> : r.project,
                <Num key="b" cell={r.budget} kind="inr" />,
                <Num key="a" cell={r.achieved} kind="inr" />,
                <Num key="v" cell={r.variance} kind="inr" signed />,
                <Num key="p" cell={r.pct} kind="pct" />,
              ])}
            />
          }
        />
      </div>

      <SectionHeading title="Sold value → Due → Collected → Outstanding" sub={ds.meta.asOnLabel ? `As on ${ds.meta.asOnLabel}` : undefined} />
      {segs7.length === 0 ? (
        <MissingSegments all={t7.segments} seg={ctx.filters.seg} />
      ) : (
        <div className="space-y-4">
          {segs7.map((s) => (
            <WaterfallSection key={s.key} s={s} ctx={ctx} />
          ))}
        </div>
      )}

      <SectionHeading title="Outstanding by age" sub="Registered + Unregistered, by days overdue" />
      {segs8.length === 0 ? (
        <MissingSegments all={ds.ageing.segments} seg={ctx.filters.seg} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {segs8.map((s) => {
            const cats = ageingCategories(ds.ageing.rows);
            const reg = ageingBuckets(ds.ageing.rows, 'Registered');
            const unreg = ageingBuckets(ds.ageing.rows, 'Unregistered');
            const bucketNames = [...new Set([...reg, ...unreg].map((b) => b.bucket))];
            const pick = (rows: typeof reg, name: string) => val(rows.find((r) => r.bucket === name)?.cells[s.key]);
            const grand = ds.ageing.rows.find((r) => r.isGrandTotal)?.cells[s.key];
            return (
              <ChartCard
                key={s.key}
                title={s.header.replace(/\s+INR$/i, '')}
                subtitle={
                  <>
                    Total outstanding <Num cell={grand} kind="inr" className="font-semibold text-ink" />
                    <AdvanceChip cell={grand} />
                  </>
                }
                legend={
                  <>
                    <LegendItem color={SERIES.actual} label="Registered" />
                    <LegendItem color={SERIES.budget} label="Unregistered" />
                  </>
                }
                chart={
                  <StackedColumns
                    ariaLabel={`Outstanding by ageing bucket, ${s.header}`}
                    kind="inr"
                    height={280}
                    series={[
                      { key: 'reg', label: 'Registered', color: SERIES.actual },
                      { key: 'unreg', label: 'Unregistered', color: SERIES.budget },
                    ]}
                    data={bucketNames.map((b) => ({ name: b.replace(/\s*days$/i, ' d'), values: { reg: pick(reg, b), unreg: pick(unreg, b) } }))}
                  />
                }
                table={
                  <SimpleTable
                    head={['Category', 'Bucket', 'Amount']}
                    rows={ds.ageing.rows.map((r) => [
                      r.isTotal ? <strong key="c">{r.category}</strong> : r.category,
                      r.isTotal ? <strong key="b">{r.bucket}</strong> : r.bucket,
                      <span key="v">
                        <Num cell={r.cells[s.key]} kind="inr" />
                        <AdvanceChip cell={r.cells[s.key]} />
                      </span>,
                    ])}
                  />
                }
                footer={
                  <span>
                    {cats.map((c) => {
                      const t = ds.ageing.rows.find((r) => r.category === c && r.isTotal && !r.isGrandTotal);
                      return (
                        <span key={c} className="mr-4">
                          {c}: <Num cell={t?.cells[s.key]} kind="inr" className="font-medium text-ink" />
                          <AdvanceChip cell={t?.cells[s.key]} />
                        </span>
                      );
                    })}
                  </span>
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function WaterfallSection({ s, ctx }: { s: SegmentColumn; ctx: PageContext }) {
  const t7 = ctx.dataset!.collectionSummary;
  const n = (k: string) => paramRow(t7, k)?.nums[s.key];
  const sold = n('soldValue');
  const due = n('due');
  const collected = n('collected');
  const os = n('outstanding');
  const steps: WaterfallStep[] = [];
  if (ok(sold)) steps.push({ name: 'Total sold value', range: [0, sold.value], value: sold.value, color: SERIES.neutral, label: formatINR(sold.value) });
  if (ok(due)) steps.push({ name: 'Due (milestones)', range: [0, due.value], value: due.value, color: SERIES.actual, label: formatINR(due.value), connectTo: due.value });
  if (ok(due) && ok(collected))
    steps.push({
      name: 'Collected',
      range: [due.value - collected.value, due.value],
      value: collected.value,
      color: SERIES.third,
      label: `−${formatINR(collected.value)}`,
      note: 'Collected against the amount due.',
      connectTo: due.value - collected.value,
    });
  if (ok(os)) {
    const adv = os.value < 0;
    steps.push({
      name: adv ? 'Advance' : 'Outstanding',
      range: [Math.min(0, os.value), Math.max(0, os.value)],
      value: os.value,
      color: adv ? SERIES.third : SERIES.budget,
      label: adv ? `Advance ${formatINR(-os.value)}` : formatINR(os.value),
      note: adv ? 'Negative outstanding: collected ahead of the milestone schedule.' : undefined,
    });
  }
  const collectedOfDue = ok(due) && ok(collected) && due.value ? collected.value / due.value : null;
  const dueOfSold = ok(due) && ok(sold) && sold.value ? due.value / sold.value : null;
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="grid grid-cols-2 gap-3 xl:col-span-2 xl:content-start">
        <p className="col-span-2 text-sm font-semibold">{s.header}</p>
        <StatTile label="Total sold value">
          <Num cell={sold} kind="inr" />
        </StatTile>
        <StatTile label="Due (milestones)" sub={dueOfSold !== null ? `${formatPct(dueOfSold)} of sold value` : undefined}>
          <Num cell={due} kind="inr" />
        </StatTile>
        <StatTile label="Collected" sub={collectedOfDue !== null ? `${formatPct(collectedOfDue)} of due` : undefined} tone="good">
          <Num cell={collected} kind="inr" />
        </StatTile>
        <StatTile label={ok(os) && os.value < 0 ? 'Advance' : 'Outstanding'} tone={ok(os) && os.value < 0 ? 'good' : 'bad'} sub={ok(os) && os.value < 0 ? 'Collected ahead of milestones' : undefined}>
          {ok(os) ? <Value kind="inr" value={Math.abs(os.value)} /> : '—'}
        </StatTile>
        {(
          [
            ['Registered O/s', n('registeredOs')],
            ['Unregistered O/s', n('unregisteredOs')],
          ] as const
        ).map(([label, cell]) => (
          <div key={label} className="rounded-lg border border-line bg-surface2/60 px-3 py-2 text-sm">
            <p className="text-xs text-muted">{label}</p>
            <p className="font-semibold">
              <Num cell={cell} kind="inr" />
              <AdvanceChip cell={cell} />
            </p>
          </div>
        ))}
      </div>
      <ChartCard
        className="xl:col-span-3"
        title="Collection bridge"
        subtitle={s.header}
        legend={
          <>
            <LegendItem color={SERIES.neutral} label="Sold value" />
            <LegendItem color={SERIES.actual} label="Due" />
            <LegendItem color={SERIES.third} label="Collected / Advance" />
            <LegendItem color={SERIES.budget} label="Outstanding" />
          </>
        }
        chart={steps.length ? <Waterfall steps={steps} ariaLabel={`Sold value, due, collected and outstanding, ${s.header}`} /> : <EmptyState title="No figures." />}
        table={
          <SimpleTable
            head={['Parameter', 'Amount']}
            rows={t7.rows.map((r) => [
              r.parameter.replace(/\s*\(.*?\)\s*/g, ' ').trim(),
              <span key="v">
                <Num cell={r.nums[s.key]} kind="inr" />
                {(r.key === 'outstanding' || r.key === 'registeredOs' || r.key === 'unregisteredOs') && <AdvanceChip cell={r.nums[s.key]} />}
              </span>,
            ])}
          />
        }
      />
    </div>
  );
}

function MissingSegments({ all, seg }: { all: SegmentColumn[]; seg: string }) {
  return (
    <EmptyState title={`No ${seg === 'all' ? '' : `${SEGMENT_LABEL[seg as 'residential'].toLowerCase()} `}figures for this selection.`}>
      Available for: {all.map((s) => s.header.replace(/\s+INR$/i, '')).join(', ') || '—'}.
    </EmptyState>
  );
}
