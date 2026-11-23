import type { Metadata } from 'next';
import { loadAllSources } from '@/lib/data/loader';
import { Building2, Gauge, IndianRupee, Layers, Ruler, Wallet } from 'lucide-react';
import { ChartCard, SimpleTable } from '@/components/ChartCard';
import { AgeingExplorer, type AgeingOption } from '@/components/charts/AgeingExplorer';
import { BarCompare } from '@/components/charts/BarCompare';
import { BulletLegend, Bullets, type BulletGroup } from '@/components/charts/Bullets';
import { SegmentedBars, type SegmentedRow } from '@/components/charts/SegmentedBars';
import { Waterfall, type WaterfallStep } from '@/components/charts/Waterfall';
import { KpiCard, RateCard } from '@/components/Kpi';
import { CountUp } from '@/components/motion';
import { PageShell } from '@/components/PageShell';
import { ProjectTimeline } from '@/components/ProjectTimeline';
import { EmptyState, LegendItem, Num, SERIES, SectionHeading } from '@/components/ui';
import { ok, val } from '@/lib/data/cells';
import { formatINR, formatPct, formatValue } from '@/lib/format';
import { METRIC_META, compare } from '@/lib/metrics';
import { getPageContext, type SearchParams } from '@/lib/page-context';
import { ageingBuckets, annualBlock, paramNum, paramRow, paramText, projectSegments, registrationAgeingRows, visibleQuarterBlocks } from '@/lib/selectors';
import { SEGMENT_LABEL, type Dataset, type MetricKey, type SalesBlock, type SegmentColumn } from '@/lib/schema';

export async function generateMetadata(): Promise<Metadata> {
  // same 60-second cache as the page, so this costs no extra sheet read
  const ok = (await loadAllSources().catch(() => [])).find((r) => r.status === 'ok');
  const projects = ok?.status === 'ok' ? ok.dataset.meta.projects.join(', ') : '';
  const fy = ok?.status === 'ok' ? ok.dataset.meta.fiscalYear : null;
  return {
    title: projects ? `${projects} · Overview` : 'Overview',
    description: `${projects || 'Nyati Group'}${fy ? ` ${fy}` : ''}: units sold, sales value, collection and area against target, unit inventory and registration, average rates, outstanding ageing and the project timeline.`,
  };
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getPageContext(await searchParams);
  const ds = ctx.dataset;
  const projects = ds ? (ctx.filters.project ? [ctx.filters.project] : ds.meta.projects) : [];
  return (
    <PageShell ctx={ctx} title="Overview" description="Sales, collection, registration, inventory and outstanding for the financial year, on one page.">
      {ds && <Overview ds={ds} projects={projects} />}
    </PageShell>
  );
}

// ---------------------------------------------------------------- layout

function Overview({ ds, projects }: { ds: Dataset; projects: string[] }) {
  const annual = annualBlock(ds);
  const quarters = visibleQuarterBlocks(ds);
  // Headline cards use the full year; when the sheet has no annual block, the latest quarter takes its place.
  const headline = annual ?? quarters[quarters.length - 1];
  const chartQuarters = quarters.filter((q) => q !== headline);
  return (
    <div className="space-y-2">
      {projects.map((p) => (
        <ProjectGlance key={p} ds={ds} project={p} showName={projects.length > 1} />
      ))}

      <SectionHeading
        title={headline ? `${periodTitle(headline)} · ${headline.kind === 'annual' ? 'achieved so far' : 'quarter'}` : 'Performance'}
        sub={headline?.kind === 'annual' ? 'Achieved against the full-year target' : 'Achieved against the quarter target'}
      />
      {headline ? <HeadlineKpis block={headline} /> : <EmptyState title="No target / achieved figures for this year yet." />}

      <div className="grid gap-5 pt-3 xl:grid-cols-2">
        <TargetsChart ds={ds} quarters={chartQuarters} projects={projects} />
        <InventoryChart ds={ds} projects={projects} />
      </div>

      <SectionHeading title="Pricing & collection" sub={ds.meta.asOnLabel ? `As on ${ds.meta.asOnLabel}` : undefined} />
      <div className="grid gap-5 xl:grid-cols-2">
        <RateChart ds={ds} projects={projects} />
        <CollectionBridge ds={ds} projects={projects} />
      </div>

      <SectionHeading title="Ageing" sub="How long amounts and registrations have been pending" />
      <div className="grid gap-5 xl:grid-cols-2">
        <OutstandingAgeing ds={ds} projects={projects} />
        <RegistrationAgeing ds={ds} projects={projects} />
      </div>
    </div>
  );
}

function periodTitle(b: SalesBlock) {
  return b.kind === 'annual' ? b.section.replace(/\s*\(.*\)$/, '').replace(/^Annual\s+/i, '') : b.section.replace(/\s*\(Block \d+\)$/i, '');
}

// ---------------------------------------------------------------- project at a glance (tab 4)

function parseDate(s: string | null): Date | null {
  const m = s ? /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s) : null;
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

function ProjectGlance({ ds, project, showName }: { ds: Dataset; project: string; showName: boolean }) {
  const t4 = ds.generalInfo;
  const segs = projectSegments(t4.segments, project);
  if (!segs.length) return null;
  const units = segs.reduce((s, c) => s + (val(paramNum(t4, 'totalUnits', c.key)) ?? 0), 0);
  const area = segs.reduce((s, c) => s + (val(paramNum(t4, 'saleableArea', c.key)) ?? 0), 0);
  const firstText = (k: string) => segs.map((c) => paramText(t4, k, c.key)).find(Boolean) ?? null;

  const milestones = [
    { key: 'startDate', label: 'Project start' },
    { key: 'reraRegistration', label: 'RERA registration' },
    { key: 'expectedCompletion', label: 'Engineering completion' },
    { key: 'reraCompletion', label: 'RERA completion' },
  ]
    .map((m) => ({ ...m, date: parseDate(firstText(m.key)) }))
    .filter((m): m is typeof m & { date: Date } => m.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const asOn = ds.meta.asOn ? new Date(`${ds.meta.asOn}T00:00:00`) : new Date();
  // sales pace: units sold up to date against units released for sale (tab 5)
  const t5 = ds.projectSummary;
  const t5segs = projectSegments(t5.segments, project);
  const sumT5 = (k: string) => {
    const v = t5segs.map((c) => val(paramNum(t5, k, c.key)));
    return v.some((x) => x !== null) ? v.reduce<number>((a, x) => a + (x ?? 0), 0) : null;
  };

  return (
    <>
    <section className="animate-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="grid lg:grid-cols-[minmax(260px,340px)_1fr]">
        <div className="relative overflow-hidden bg-[rgb(var(--header))] p-5 text-white">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            <Building2 aria-hidden className="h-4 w-4" /> Project at a glance
          </p>
          {showName && <h2 className="mt-1 text-xl font-bold">{project}</h2>}
          <div className="relative mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-bold tabular">
                <CountUp value={units} kind="units" />
              </p>
              <p className="text-xs text-white/70">Total units</p>
            </div>
            <div>
              <p className="text-3xl font-bold tabular">
                <CountUp value={area / 1e5} kind="number" className="tabular" />
                <span className="ml-1 text-base font-semibold">L</span>
              </p>
              <p className="text-xs text-white/70" title={formatValue('area', area)}>
                Saleable sq.ft.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          {segs.map((c, i) => (
            <div key={c.key} className="animate-rise rounded-xl border border-line bg-surface2/60 p-3.5" style={{ animationDelay: `${120 + i * 90}ms` }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                  <Layers aria-hidden className="h-3.5 w-3.5" />
                  {SEGMENT_LABEL[c.segment]}
                </span>
                <span className="truncate text-xs text-muted">{paramText(t4, 'configuration', c.key) ?? '—'}</span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <Fact label="Units" value={<Num cell={paramNum(t4, 'totalUnits', c.key)} kind="units" />} />
                <Fact label="Saleable area" value={<Num cell={paramNum(t4, 'saleableArea', c.key)} kind="area" />} />
                <Fact label="Buildings" value={paramText(t4, 'buildings', c.key)} />
              </dl>
            </div>
          ))}

        </div>
      </div>
    </section>
    {milestones.length >= 2 && (
      <ProjectTimeline milestones={milestones} asOn={asOn} fiscalYear={ds.meta.fiscalYear} sold={sumT5('soldToDate')} forSale={sumT5('unitsForSale')} />
    )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="truncate font-semibold tabular text-ink">{value ?? <span className="text-muted">—</span>}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- headline KPIs (tab 1, full year)

function HeadlineKpis({ block }: { block: SalesBlock }) {
  const { budget, actual, variance, pct } = block.rows;
  if (!budget || !actual) return <EmptyState title="No target / achieved figures for this period." />;
  const cmp = (m: MetricKey) => compare(budget.metrics[m], actual.metrics[m], variance?.metrics[m], pct?.metrics[m]);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard label="Units sold" kind="units" cmp={cmp('units')} icon={<Building2 />} delay={0} />
      <KpiCard label="Sales value" kind="inr" cmp={cmp('value')} icon={<IndianRupee />} delay={70} />
      <KpiCard label="Collection" kind="inr" cmp={cmp('collection')} icon={<Wallet />} delay={140} />
      <KpiCard label="Area sold" kind="area" cmp={cmp('area')} icon={<Ruler />} delay={210} />
      <RateCard label="Average rate" target={budget.metrics.rate} actual={actual.metrics.rate} icon={<Gauge />} delay={280} />
    </div>
  );
}

// ---------------------------------------------------------------- every budget-vs-actual in one chart (tabs 1, 2, 3b, 5)

const Q_METRICS: MetricKey[] = ['units', 'value', 'area', 'collection', 'rate'];

function TargetsChart({ ds, quarters, projects }: { ds: Dataset; quarters: SalesBlock[]; projects: string[] }) {
  const groups: BulletGroup[] = [];
  for (const q of quarters) {
    const { budget, actual, pct } = q.rows;
    if (!budget || !actual) continue;
    groups.push({
      title: `${periodTitle(q)} quarter`,
      sub: 'Company total',
      items: Q_METRICS.map((m) => ({
        label: METRIC_META[m].label,
        kind: METRIC_META[m].kind,
        target: val(budget.metrics[m]),
        actual: val(actual.metrics[m]),
        ratio: m === 'rate' ? null : val(pct?.metrics[m]),
      })),
    });
  }
  const t5 = ds.projectSummary;
  for (const p of projects) {
    const items: BulletGroup['items'] = [];
    const s = ds.projectSales.find((r) => r.project === p);
    if (s) {
      items.push({ label: 'Units sold', kind: 'units', target: val(s.targetUnits), actual: val(s.achievedUnits), ratio: val(s.unitsPct) });
      items.push({ label: 'Sales value', kind: 'inr', target: val(s.targetValue), actual: val(s.achievedValue), ratio: val(s.valuePct) });
    }
    const c = ds.collection.find((r) => r.project === p && !r.isTotal);
    if (c) items.push({ label: 'Collection', kind: 'inr', target: val(c.budget), actual: val(c.achieved), ratio: val(c.pct) });
    for (const seg of projectSegments(t5.segments, p)) {
      const pairs = [
        ['budgetToDate', 'achievedToDate', 'units to date'],
        ['budgetQ', 'achievedQ', 'units this quarter'],
      ] as const;
      for (const [b, a, label] of pairs) {
        const bv = val(paramNum(t5, b, seg.key));
        const av = val(paramNum(t5, a, seg.key));
        if (bv && av !== null) items.push({ label: `${SEGMENT_LABEL[seg.segment]} ${label}`, kind: 'units', target: bv, actual: av });
      }
    }
    if (items.length) groups.push({ title: projects.length > 1 ? p : 'Project targets', sub: projects.length > 1 ? 'Project targets' : p, items });
  }

  const tableRows = groups.flatMap((g) =>
    g.items.map((it) => [
      g.title,
      it.label,
      it.target === null ? '—' : formatValue(it.kind, it.target),
      it.actual === null ? '—' : formatValue(it.kind, it.actual),
      it.target !== null && it.actual !== null ? `${it.actual - it.target > 0 ? '+' : ''}${formatValue(it.kind, it.actual - it.target)}` : '—',
      (it.ratio ?? (it.target ? (it.actual ?? 0) / it.target : null)) === null ? '—' : formatPct(it.ratio ?? (it.actual ?? 0) / it.target!),
    ]),
  );

  return (
    <ChartCard
      title="Target vs achieved"
      subtitle="Every target on one scale: bar = achieved as % of target, tick = target"
      legend={<BulletLegend />}
      minHeight={420}
      chart={groups.length ? <Bullets groups={groups} ariaLabel="Achieved as a percentage of target for the quarter and the project targets" /> : <EmptyState title="No targets for this selection." />}
      table={<SimpleTable head={['Group', 'Measure', 'Target', 'Achieved', 'Variance', '%']} rows={tableRows} />}
    />
  );
}

// ---------------------------------------------------------------- inventory + registration in one chart (tabs 3a, 5, 6)

const INV_SERIES = [
  { key: 'registered', label: 'Sold · registered', color: SERIES.actual },
  { key: 'unregistered', label: 'Sold · unregistered', color: 'rgb(var(--series-1) / 0.5)' },
  { key: 'sold', label: 'Sold', color: SERIES.actual },
  { key: 'unsold', label: 'Unsold', color: SERIES.neutral },
  { key: 'premium', label: 'Premium (blocked)', color: SERIES.budget },
  { key: 'landOwner', label: 'Land owner', color: SERIES.third },
];

function InventoryChart({ ds, projects }: { ds: Dataset; projects: string[] }) {
  const t5 = ds.projectSummary;
  const t6 = ds.registrationSummary;
  const rows: (SegmentedRow & { seg: SegmentColumn })[] = [];
  for (const p of projects) {
    const segs = projectSegments(t5.segments, p);
    // registration split: tab 6 per segment; a segment without its own column gets the project total (tab 3a) minus the others
    const reg3a = ds.registration.find((r) => r.project === p && !r.isTotal);
    const t6For = (s: SegmentColumn) => t6.segments.find((c) => c.project === p && c.segment === s.segment);
    const known = segs.filter(t6For);
    const missing = segs.filter((s) => !t6For(s));
    for (const s of segs) {
      const sold = val(paramNum(t5, 'soldToDate', s.key));
      let registered: number | null = null;
      let unregistered: number | null = null;
      const c6 = t6For(s);
      if (c6) {
        registered = val(paramNum(t6, 'registered', c6.key));
        unregistered = val(paramNum(t6, 'unregistered', c6.key));
      } else if (reg3a && missing.length === 1) {
        const r = val(reg3a.registered);
        const u = val(reg3a.unregistered);
        if (r !== null && u !== null) {
          registered = r - known.reduce((a, k) => a + (val(paramNum(t6, 'registered', t6For(k)!.key)) ?? 0), 0);
          unregistered = u - known.reduce((a, k) => a + (val(paramNum(t6, 'unregistered', t6For(k)!.key)) ?? 0), 0);
        }
      }
      const splitOk = registered !== null && unregistered !== null && registered >= 0 && unregistered >= 0 && sold !== null && registered + unregistered === sold;
      rows.push({
        seg: s,
        label: projects.length > 1 ? `${p} · ${SEGMENT_LABEL[s.segment]}` : SEGMENT_LABEL[s.segment],
        sub: sold !== null && splitOk && sold > 0 ? `${formatPct(registered! / sold)} of sold registered` : undefined,
        values: {
          registered: splitOk ? registered : null,
          unregistered: splitOk ? unregistered : null,
          sold: splitOk ? null : sold,
          unsold: val(paramNum(t5, 'unsold', s.key)),
          premium: val(paramNum(t5, 'premiumBlocked', s.key)),
          landOwner: val(paramNum(t5, 'landOwnerUnits', s.key)),
        },
      });
    }
  }
  const sum = (k: string) => rows.reduce((a, r) => a + (r.values[k] ?? 0), 0);
  const used = INV_SERIES.filter((s) => sum(s.key) > 0);
  const soldAll = sum('registered') + sum('unregistered') + sum('sold');
  return (
    <ChartCard
      title="Unit inventory & registration"
      subtitle={soldAll ? `${formatValue('units', soldAll)} units sold · ${formatValue('units', sum('unsold'))} unsold` : 'Units by status'}
      minHeight={300}
      legend={
        <>
          {used.map((s) => (
            <LegendItem key={s.key} color={s.color} label={`${s.label} ${formatValue('units', sum(s.key))}`} />
          ))}
        </>
      }
      chart={
        rows.length ? (
          <div className="space-y-6">
            <SegmentedBars rows={rows} series={used} kind="units" ariaLabel="Units by status for each segment" />
            <SellThrough rows={rows.map((r) => ({ label: r.label, sold: (r.values.registered ?? 0) + (r.values.unregistered ?? 0) + (r.values.sold ?? 0), forSale: val(paramNum(t5, 'unitsForSale', r.seg.key)) }))} />
          </div>
        ) : (
          <EmptyState title="No unit figures for this selection." />
        )
      }
      table={
        <SimpleTable
          head={['Segment', 'Total units', ...used.map((s) => s.label)]}
          rows={rows.map((r) => [
            r.label,
            <Num key="t" cell={paramNum(t5, 'totalUnits', r.seg.key)} kind="units" />,
            ...used.map((s) => (r.values[s.key] === null ? '—' : formatValue('units', r.values[s.key]!))),
          ])}
        />
      }
      footer="Total units = sold + unsold + premium (blocked) + land owner. Registration split from the registration summary."
    />
  );
}

/** Sell-through: sold as a share of the units released for sale (excludes land-owner and blocked premium units). */
function SellThrough({ rows }: { rows: { label: string; sold: number; forSale: number | null }[] }) {
  const shown = rows.filter((r): r is typeof r & { forSale: number } => r.forSale !== null && r.forSale > 0);
  if (!shown.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface2/60 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink2">Sell-through · sold of units for sale</p>
      <ul className="space-y-3">
        {shown.map((r, i) => {
          const share = Math.min(1, r.sold / r.forSale);
          return (
            <li key={r.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="text-ink">{r.label}</span>
                <span className="tabular text-xs text-muted">
                  <span className="text-sm font-semibold text-ink">{formatPct(r.sold / r.forSale)}</span> · {formatValue('units', r.sold)} of {formatValue('units', r.forSale)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[rgb(var(--grid))]">
                <div className="animate-grow h-full rounded-full bg-gradient-to-r from-brand to-brand2" style={{ width: `${share * 100}%`, animationDelay: `${400 + i * 120}ms` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- average rates (tab 5)

function RateChart({ ds, projects }: { ds: Dataset; projects: string[] }) {
  const t5 = ds.projectSummary;
  const segs = projects.flatMap((p) => projectSegments(t5.segments, p));
  const fyLabel =
    t5.rows
      .find((r) => r.key === 'avgRateFy')
      ?.parameter.replace(/^Average Rate\s*/i, '')
      .replace(/^\((.*)\)$/, '$1') || 'Financial year';
  const cats = [
    { key: 'avgRateToDate', name: 'Up to date' },
    { key: 'avgRateFy', name: fyLabel },
    { key: 'avgRateMonth', name: 'Current month' },
  ];
  const colors = [SERIES.actual, SERIES.third, SERIES.budget, SERIES.neutral];
  const series = segs.map((s, i) => ({ key: s.key, label: projects.length > 1 ? `${s.project} · ${SEGMENT_LABEL[s.segment]}` : SEGMENT_LABEL[s.segment], color: colors[i % colors.length] }));
  const data = cats
    .map((c) => ({ name: c.name, values: Object.fromEntries(segs.map((s) => [s.key, val(paramNum(t5, c.key, s.key))])) }))
    .filter((d) => Object.values(d.values).some((v) => v !== null && v > 0));
  return (
    <ChartCard
      title="Average selling rate"
      subtitle="₹ per sq.ft., by segment"
      minHeight={300}
      legend={
        <>
          {series.map((s) => (
            <LegendItem key={s.key} color={s.color} label={s.label} />
          ))}
        </>
      }
      chart={data.length ? <BarCompare ariaLabel="Average rate per sq.ft. by period and segment" kind="rate" height={300} labels="all" series={series} data={data} /> : <EmptyState title="No rates in the sheet." />}
      table={
        <SimpleTable
          head={['Period', ...series.map((s) => s.label)]}
          rows={cats.map((c) => [c.name, ...segs.map((s) => <Num key={s.key} cell={paramNum(t5, c.key, s.key)} kind="rate" />)])}
        />
      }
    />
  );
}

// ---------------------------------------------------------------- collection bridge (tab 7)

function CollectionBridge({ ds, projects }: { ds: Dataset; projects: string[] }) {
  const t7 = ds.collectionSummary;
  const segs = t7.segments.filter((s) => s.project === null || projects.includes(s.project));
  if (!segs.length) {
    return <ChartCard title="Sold value → collected → outstanding" chart={<EmptyState title="No collection summary for this selection." />} />;
  }
  return (
    <>
      {segs.map((s) => {
        const n = (k: string) => paramRow(t7, k)?.nums[s.key];
        const sold = n('soldValue');
        const due = n('due');
        const collected = n('collected');
        const os = n('outstanding');
        const regOs = val(n('registeredOs'));
        const unregOs = val(n('unregisteredOs'));
        const steps: WaterfallStep[] = [];
        if (ok(sold)) steps.push({ name: 'Sold value', range: [0, sold.value], value: sold.value, color: SERIES.neutral, label: formatINR(sold.value) });
        if (ok(due)) steps.push({ name: 'Due', range: [0, due.value], value: due.value, color: SERIES.actual, label: formatINR(due.value), note: 'Due as per construction milestones.', connectTo: due.value });
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
        if (ok(os) && regOs !== null && unregOs !== null && regOs >= 0 && unregOs >= 0 && regOs + unregOs === os.value) {
          steps.push({ name: 'Registered O/s', range: [0, regOs], value: regOs, color: SERIES.budget, label: formatINR(regOs), note: 'Outstanding on registered units.' });
          if (unregOs > 0)
            steps.push({ name: 'Unregistered O/s', range: [regOs, regOs + unregOs], value: unregOs, color: 'rgb(var(--series-2) / 0.55)', label: formatINR(unregOs), note: 'Outstanding on units not yet registered.' });
        } else if (ok(os)) {
          steps.push({ name: 'Outstanding', range: [Math.min(0, os.value), Math.max(0, os.value)], value: os.value, color: SERIES.budget, label: formatINR(os.value) });
        }
        const collectedOfDue = ok(due) && ok(collected) && due.value ? collected.value / due.value : null;
        return (
          <ChartCard
            key={s.key}
            title="Sold value → collected → outstanding"
            subtitle={
              <>
                {s.project && projects.length > 1 ? `${s.project} · ` : ''}
                {SEGMENT_LABEL[s.segment]}
                {collectedOfDue !== null && (
                  <>
                    {' '}
                    · <span className="font-semibold text-ink">{formatPct(collectedOfDue)}</span> of due collected
                  </>
                )}
                {ok(os) && (
                  <>
                    {' '}
                    · outstanding <span className="font-semibold text-ink">{formatINR(os.value)}</span>
                  </>
                )}
              </>
            }
            minHeight={300}
            legend={
              <>
                <LegendItem color={SERIES.neutral} label="Sold value" />
                <LegendItem color={SERIES.actual} label="Due" />
                <LegendItem color={SERIES.third} label="Collected" />
                <LegendItem color={SERIES.budget} label="Outstanding" />
              </>
            }
            chart={steps.length ? <Waterfall steps={steps} height={300} ariaLabel={`Sold value, due, collected and outstanding, ${s.header}`} /> : <EmptyState title="No figures." />}
            table={
              <SimpleTable
                head={['Parameter', 'Amount']}
                rows={t7.rows.map((r) => [r.parameter.replace(/\s*\(.*?\)\s*/g, ' ').trim(), <Num key="v" cell={r.nums[s.key]} kind="inr" />])}
              />
            }
          />
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- outstanding ageing (tab 8)

function OutstandingAgeing({ ds, projects }: { ds: Dataset; projects: string[] }) {
  const t8 = ds.ageing;
  const segs = t8.segments.filter((s) => s.segment !== 'total' && (s.project === null || projects.includes(s.project)));
  const reg = ageingBuckets(t8.rows, 'Registered');
  const unreg = ageingBuckets(t8.rows, 'Unregistered');
  const buckets = [...new Set([...reg, ...unreg].map((b) => b.bucket))];
  const pick = (rows: typeof reg, b: string, keys: string[]) => {
    const r = rows.find((x) => x.bucket === b);
    if (!r) return null;
    const vals = keys.map((k) => val(r.cells[k])).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, v) => a + v, 0) : null;
  };
  const optionFor = (id: string, label: string, keys: string[]): AgeingOption => ({
    id,
    label,
    data: buckets.map((b) => ({ name: b.replace(/\s*days$/i, '').replace(/\s+/g, ' ').trim() + ' d', values: { reg: pick(reg, b, keys), unreg: pick(unreg, b, keys) } })),
  });
  const options = [
    ...(segs.length > 1 ? [optionFor('all', 'All segments', segs.map((s) => s.key))] : []),
    ...segs.map((s) => optionFor(s.key, projects.length > 1 && s.project ? `${s.project} · ${SEGMENT_LABEL[s.segment]}` : SEGMENT_LABEL[s.segment], [s.key])),
  ];
  const grand = segs.reduce((a, s) => a + (val(t8.rows.find((r) => r.isGrandTotal)?.cells[s.key]) ?? 0), 0);
  const over120 = options[0]?.data.find((d) => /^>/.test(d.name));
  const over120Sum = over120 ? (over120.values.reg ?? 0) + (over120.values.unreg ?? 0) : 0;
  return (
    <ChartCard
      title="Outstanding by age"
      subtitle={
        <>
          Total outstanding <span className="font-semibold text-ink">{formatINR(grand)}</span>
          {grand > 0 && over120Sum > 0 && (
            <>
              {' '}
              · <span className="font-semibold text-badInk">{formatPct(over120Sum / grand)}</span> overdue more than 120 days
            </>
          )}
        </>
      }
      minHeight={320}
      legend={
        <>
          <LegendItem color={SERIES.actual} label="Registered" />
          <LegendItem color={SERIES.budget} label="Unregistered" />
        </>
      }
      chart={
        options.length ? (
          <AgeingExplorer
            ariaLabel="Outstanding by days overdue"
            kind="inr"
            options={options}
            series={[
              { key: 'reg', label: 'Registered', color: SERIES.actual },
              { key: 'unreg', label: 'Unregistered', color: SERIES.budget },
            ]}
          />
        ) : (
          <EmptyState title="No outstanding ageing for this selection." />
        )
      }
      table={
        <SimpleTable
          head={['Category', 'Bucket', ...segs.map((s) => SEGMENT_LABEL[s.segment])]}
          rows={t8.rows.map((r) => [
            r.isTotal ? <strong key="c">{r.category}</strong> : r.category,
            r.isTotal ? <strong key="b">{r.bucket}</strong> : r.bucket,
            ...segs.map((s) => <Num key={s.key} cell={r.cells[s.key]} kind="inr" />),
          ])}
        />
      }
    />
  );
}

// ---------------------------------------------------------------- unregistered units ageing (tab 6)

function RegistrationAgeing({ ds, projects }: { ds: Dataset; projects: string[] }) {
  const t6 = ds.registrationSummary;
  const segs = t6.segments.filter((s) => s.segment !== 'total' && (s.project === null || projects.includes(s.project)));
  const buckets = registrationAgeingRows(t6);
  const options: AgeingOption[] = segs.map((s) => ({
    id: s.key,
    label: projects.length > 1 && s.project ? `${s.project} · ${SEGMENT_LABEL[s.segment]}` : SEGMENT_LABEL[s.segment],
    data: buckets.map((b) => {
      const v = val(b.row.nums[s.key]);
      return { name: b.label.replace(/\s*days$/i, '').replace(/^0(\d)/, '$1').replace(/\s+/g, ' ').trim() + ' d', values: b.is120Plus ? { ontime: null, late: v } : { ontime: v, late: null } };
    }),
  }));
  const overTotal = segs.reduce((a, s) => a + (val(buckets.find((b) => b.is120Plus)?.row.nums[s.key]) ?? 0), 0);
  const unregTotal = segs.reduce((a, s) => a + (val(paramNum(t6, 'unregistered', s.key)) ?? 0), 0);
  return (
    <ChartCard
      title="Unregistered units by age"
      subtitle={
        segs.length ? (
          <>
            {segs.map((s) => SEGMENT_LABEL[s.segment]).join(', ')} · <span className="font-semibold text-ink">{unregTotal}</span> unregistered
            {overTotal > 0 && (
              <>
                {' '}
                · <span className="font-semibold text-badInk">{overTotal}</span> waiting more than 120 days
              </>
            )}
          </>
        ) : undefined
      }
      minHeight={320}
      legend={
        <>
          <LegendItem color={SERIES.actual} label="Up to 120 days" />
          <LegendItem color={SERIES.critical} label="Over 120 days: follow up" />
        </>
      }
      chart={
        options.length && buckets.length ? (
          <AgeingExplorer
            ariaLabel="Unregistered units by days since sale"
            kind="units"
            options={options}
            series={[
              { key: 'ontime', label: 'Up to 120 days', color: SERIES.actual },
              { key: 'late', label: 'Over 120 days', color: SERIES.critical },
            ]}
          />
        ) : (
          <EmptyState title="No registration ageing for this selection." />
        )
      }
      table={
        <SimpleTable
          head={['Days since sale', ...segs.map((s) => SEGMENT_LABEL[s.segment])]}
          rows={buckets.map((b) => [b.label, ...segs.map((s) => <Num key={s.key} cell={b.row.nums[s.key]} kind="units" />)])}
        />
      }
    />
  );
}
