import clsx from 'clsx';
import { CalendarClock, CheckCircle2, Clock3, Flag, Gauge, HardHat, KeyRound, Rocket } from 'lucide-react';
import { formatPct } from '@/lib/format';

export interface Milestone {
  key: string;
  label: string;
  date: Date;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** Calendar months between two dates (fractional). */
const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30.44;

function fmtDur(m: number) {
  const r = Math.round(Math.abs(m));
  if (r < 1) return 'under a month';
  if (r < 12) return `${r} month${r === 1 ? '' : 's'}`;
  const y = Math.floor(r / 12);
  const mo = r % 12;
  return `${y} yr${mo ? ` ${mo} mo` : ''}`;
}

const ICON: Record<string, React.ReactNode> = {
  startDate: <Rocket />,
  reraRegistration: <Flag />,
  expectedCompletion: <HardHat />,
  reraCompletion: <KeyRound />,
};

/** Phases between consecutive milestones, named by the milestone that closes them. */
const PHASE: Record<string, { name: string; color: string }> = {
  reraRegistration: { name: 'Pre-launch', color: 'rgb(var(--series-3))' },
  expectedCompletion: { name: 'Construction', color: 'rgb(var(--series-1))' },
  reraCompletion: { name: 'Handover buffer', color: 'rgb(var(--series-2))' },
};

/**
 * Full project timeline from tab 4 dates: phases, today marker, year ticks, the financial year
 * (with its quarters) as a band, milestone status, and time elapsed against units sold (tab 5).
 */
export function ProjectTimeline({
  milestones,
  asOn,
  fiscalYear,
  sold,
  forSale,
}: {
  milestones: Milestone[];
  asOn: Date;
  fiscalYear: string | null;
  sold: number | null;
  forSale: number | null;
}) {
  const start = milestones[0].date;
  const end = milestones[milestones.length - 1].date;
  const span = end.getTime() - start.getTime();
  const at = (d: Date) => Math.max(0, Math.min(1, (d.getTime() - start.getTime()) / span));
  const pct = (d: Date) => `${at(d) * 100}%`;
  const elapsed = at(asOn);
  const totalMonths = monthsBetween(start, end);
  const monthNo = Math.min(Math.round(totalMonths), Math.floor(monthsBetween(start, asOn)) + 1);
  const eng = milestones.find((m) => m.key === 'expectedCompletion');
  const rera = milestones.find((m) => m.key === 'reraCompletion');

  const phases = milestones.slice(1).map((m, i) => ({ ...PHASE[m.key], key: m.key, from: milestones[i].date, to: m.date })).filter((p) => p.name);

  const years: Date[] = [];
  for (let y = start.getFullYear() + 1; y <= end.getFullYear(); y++) years.push(new Date(y, 0, 1));

  // financial year band (April–March) with its four quarters
  const fyYear = fiscalYear ? Number(/(\d{4})/.exec(fiscalYear)?.[1]) : NaN;
  const fy = Number.isFinite(fyYear)
    ? {
        from: new Date(fyYear, 3, 1),
        to: new Date(fyYear + 1, 3, 1),
        quarters: [0, 1, 2, 3].map((q) => {
          const from = new Date(fyYear, 3 + q * 3, 1);
          const to = new Date(fyYear, 6 + q * 3, 1);
          return { name: `Q${q + 1}`, from, to, done: to <= new Date(asOn.getTime() + 864e5), current: from <= asOn && asOn < to };
        }),
      }
    : null;

  const soldShare = sold !== null && forSale ? sold / forSale : null;
  const pace = soldShare !== null ? soldShare - elapsed : null;

  return (
    <section className="animate-rise !mt-5 rounded-2xl border border-line bg-surface p-5 shadow-sm" style={{ animationDelay: '120ms' }}>
      {/* header + headline facts */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink2">
            <CalendarClock aria-hidden className="h-4 w-4 text-brand" /> Project timeline
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {fmtDate(start)} to {fmtDate(end)} · {fmtDur(totalMonths)} in all
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Project month" value={`${monthNo}`} sub={`of ${Math.round(totalMonths)}`} />
          <Stat label="Timeline elapsed" value={formatPct(elapsed)} sub={`as on ${fmtDate(asOn)}`} />
          {eng && <Stat label="To engineering completion" value={asOn < eng.date ? fmtDur(monthsBetween(asOn, eng.date)) : 'Done'} />}
          {rera && <Stat label="To RERA completion" value={asOn < rera.date ? fmtDur(monthsBetween(asOn, rera.date)) : 'Done'} />}
        </dl>
      </div>

      {/* the track */}
      <div className="relative mx-1 mt-14 sm:mx-3" role="img" aria-label={`Timeline: ${milestones.map((m) => `${m.label} ${fmtDate(m.date)}`).join(', ')}. As on ${fmtDate(asOn)}, ${formatPct(elapsed)} of the timeline has elapsed.`}>
        {/* FY band with quarters */}
        {fy && fy.to > start && fy.from < end && (
          <div className="absolute -top-11 flex h-6 overflow-hidden rounded-md border border-brand2/40 text-[10px] font-semibold" style={{ left: pct(fy.from), width: `${(at(fy.to) - at(fy.from)) * 100}%` }} title={`${fiscalYear}: April to March`}>
            {fy.quarters.map((q) => (
              <span
                key={q.name}
                title={`${q.name} ${fiscalYear}: ${fmtDate(q.from)} – ${fmtDate(new Date(q.to.getTime() - 864e5))}${q.done ? ' (complete)' : q.current ? ' (in progress)' : ''}`}
                className={clsx('flex flex-1 items-center justify-center border-r border-brand2/30 last:border-r-0', q.done ? 'bg-brand2 text-white' : q.current ? 'bg-brand2/25 text-brand' : 'bg-brand2/5 text-muted')}
              >
                {q.name}
              </span>
            ))}
          </div>
        )}
        {fy && fy.to > start && fy.from < end && (
          <span className="absolute -top-[3.6rem] whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-brand" style={{ left: pct(fy.from) }}>
            {fiscalYear}
          </span>
        )}

        {/* phases: faded for the whole span, solid up to today */}
        <div className="relative h-3.5 rounded-full">
          <div className="absolute inset-0 flex gap-[2px] overflow-hidden rounded-full">
            {phases.map((p) => (
              <span key={p.key} style={{ flexGrow: p.to.getTime() - p.from.getTime(), flexBasis: 0, background: p.color, opacity: 0.22 }} />
            ))}
          </div>
          {elapsed > 0 && (
            <div className="animate-grow absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${elapsed * 100}%`, animationDelay: '300ms', animationDuration: '1.6s' }}>
              <div className="flex h-full gap-[2px]" style={{ width: `${100 / elapsed}%` }}>
                {phases.map((p) => (
                  <span key={p.key} style={{ flexGrow: p.to.getTime() - p.from.getTime(), flexBasis: 0, background: p.color }} />
                ))}
              </div>
            </div>
          )}

          {/* milestone dots */}
          {milestones.map((m) => (
            <span
              key={m.key}
              title={`${m.label}: ${fmtDate(m.date)}`}
              className={clsx('absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface shadow', m.date <= asOn ? 'bg-ink' : 'bg-neutral')}
              style={{ left: pct(m.date) }}
            />
          ))}

          {/* today */}
          <span className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${elapsed * 100}%` }}>
            <span className="animate-pulse-ring block h-5 w-5 rounded-full border-[3px] border-surface bg-s3" />
          </span>
          <span className="absolute top-6 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-s3 px-2 py-0.5 text-[10px] font-semibold text-white shadow" style={{ left: `${elapsed * 100}%` }}>
            Today · {fmtDate(asOn)}
          </span>
        </div>

        {/* year ticks */}
        <div className="relative mt-11 h-4 text-[10px] text-muted">
          {years.map((y) => (
            <span key={y.getFullYear()} className="absolute -translate-x-1/2" style={{ left: pct(y) }}>
              <span aria-hidden className="absolute -top-10 left-1/2 h-8 w-px bg-line" />
              {y.getFullYear()}
            </span>
          ))}
        </div>
      </div>

      {/* phase legend with durations */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {phases.map((p) => {
          const done = p.to <= asOn;
          const now = p.from <= asOn && asOn < p.to;
          return (
            <li key={p.key} className="flex items-center gap-1.5 text-ink2">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
              <span className="font-semibold text-ink">{p.name}</span> {fmtDur(monthsBetween(p.from, p.to))}
              {done && <span className="text-goodInk">· done</span>}
              {now && <span className="text-brand">· {formatPct((asOn.getTime() - p.from.getTime()) / (p.to.getTime() - p.from.getTime()))} through</span>}
            </li>
          );
        })}
      </ul>

      {/* milestones + pace */}
      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        {milestones.map((m, i) => {
          const done = m.date <= asOn;
          const gap = monthsBetween(asOn, m.date);
          return (
            <div
              key={m.key}
              className={clsx('animate-rise rounded-xl border p-3', done ? 'border-good/30 bg-good/5' : 'border-line bg-surface2/60')}
              style={{ animationDelay: `${200 + i * 80}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={clsx('rounded-lg p-1.5 [&>svg]:h-4 [&>svg]:w-4', done ? 'bg-good/15 text-goodInk' : 'bg-brand/10 text-brand')}>{ICON[m.key] ?? <Flag />}</span>
                <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', done ? 'bg-good/15 text-goodInk' : 'bg-brand/10 text-brand')}>
                  {done ? <CheckCircle2 aria-hidden className="h-3 w-3" /> : <Clock3 aria-hidden className="h-3 w-3" />}
                  {done ? 'Done' : 'Upcoming'}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">{m.label}</p>
              <p className="text-sm font-semibold tabular text-ink">{fmtDate(m.date)}</p>
              <p className="mt-0.5 text-[11px] text-muted">{done ? `${fmtDur(gap)} ago` : `in ${fmtDur(gap)}`}</p>
            </div>
          );
        })}

        {soldShare !== null && (
          <div className="animate-rise rounded-xl border border-line bg-surface2/60 p-3 col-span-2 xl:col-span-1" style={{ animationDelay: `${200 + milestones.length * 80}ms` }}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink2">
              <Gauge aria-hidden className="h-4 w-4 text-brand" /> Sales pace vs time
            </p>
            <PaceBar label="Time elapsed" share={elapsed} color="rgb(var(--series-3))" delay={500} />
            <PaceBar label={`Units sold (${sold} of ${forSale})`} share={soldShare} color="rgb(var(--series-1))" delay={650} />
            {pace !== null && (
              <p className={clsx('mt-2 text-[11px] font-medium', pace >= 0 ? 'text-goodInk' : 'text-badInk')}>
                Sales {pace >= 0 ? 'ahead of' : 'behind'} the timeline by {Math.round(Math.abs(pace) * 100)} pts
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-[120px] rounded-xl bg-surface2/80 px-3 py-2 ring-1 ring-line">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-base font-bold tabular text-ink">
        {value}
        {sub && <span className="ml-1 text-[11px] font-normal text-muted">{sub}</span>}
      </dd>
    </div>
  );
}

function PaceBar({ label, share, color, delay }: { label: string; share: number; color: string; delay: number }) {
  return (
    <div className="mt-2">
      <div className="mb-0.5 flex justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular text-ink">{formatPct(share)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[rgb(var(--grid))]">
        <div className="animate-grow h-full rounded-full" style={{ width: `${Math.min(1, share) * 100}%`, background: color, animationDelay: `${delay}ms` }} />
      </div>
    </div>
  );
}
