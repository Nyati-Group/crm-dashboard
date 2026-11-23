import { LogOut } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Suspense } from 'react';
import { logoutAction } from '../actions';
import { ChatBubble } from '@/components/copilot/ChatBubble';
import { Flash } from '@/components/Flash';
import { Footer } from '@/components/Footer';
import { AppShell } from '@/components/shell/AppShell';
import { NAV_COOKIE } from '@/lib/nav';
import { requireSession } from '@/lib/auth/current';
import { loadAllSources } from '@/lib/data/loader';

export const dynamic = 'force-dynamic';
// First load downloads the Google Sheet; allow for a slow response on serverless hosts.
export const maxDuration = 30;

/** Project name(s) and FY for the header, from the first source that loads (cached for 60 s). */
async function headerInfo(): Promise<{ projects: string[]; fy: string | null }> {
  try {
    const ok = (await loadAllSources()).find((r) => r.status === 'ok');
    return ok?.status === 'ok' ? { projects: ok.dataset.meta.projects, fy: ok.dataset.meta.fiscalYear } : { projects: [], fy: null };
  } catch {
    return { projects: [], fy: null };
  }
}

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { projects, fy } = await headerInfo();
  const projectName = projects.length ? projects.join(' · ') : 'Sales Dashboard';
  // the navbar starts expanded (tab names shown); it stays collapsed (icons only) if the user collapsed it before
  const navOpen = (await cookies()).get(NAV_COOKIE)?.value !== 'closed';
  const initial = (session.email[0] ?? '?').toUpperCase();

  const header = (
    <>
      <Link href="/" aria-label={`${projectName}: go to the Overview`} className="min-w-0 rounded-lg leading-tight outline-none focus-visible:ring-2 focus-visible:ring-white/70">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">Nyati Group · Sales Dashboard</span>
        <span className="block truncate text-lg font-bold tracking-wide sm:text-xl">{projectName}</span>
      </Link>
      {fy && <span className="ml-1 hidden shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90 ring-1 ring-white/25 md:inline-block">{fy}</span>}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="hidden text-right text-xs leading-tight text-white/80 sm:block">
          {session.email}
          <br />
          <span className="font-medium text-white">{session.role}</span>
        </span>
        <span aria-hidden className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-semibold ring-1 ring-white/30 sm:flex">
          {initial}
        </span>
        <form action={logoutAction}>
          <button type="submit" title="Sign out" aria-label="Sign out" className="rounded-md p-2 text-white/85 hover:bg-white/10 hover:text-white">
            <LogOut aria-hidden className="h-4 w-4" />
          </button>
        </form>
      </div>
    </>
  );

  return (
    <AppShell initialOpen={navOpen} header={header}>
      <main className="mx-auto min-w-0 max-w-[1440px] px-4 pb-6 pt-5 sm:px-6">{children}</main>
      <Footer className="px-4 pb-24 pt-2" />
      <Flash />
      <Suspense>
        <ChatBubble />
      </Suspense>
    </AppShell>
  );
}
