import { LogOut } from 'lucide-react';
import { Suspense } from 'react';
import { logoutAction } from '../actions';
import { ChatWidget } from '@/components/ChatWidget';
import { Sidebar } from '@/components/shell/Sidebar';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { requireSession } from '@/lib/auth/current';
import { NAV } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const items = NAV.filter((n) => n.roles.includes(session.role)).map(({ href, label }) => ({ href, label }));
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-[rgb(var(--header))] text-white shadow">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5">
          <span className="rounded-md bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nyati-logo.jpg" alt="Nyati" width={26} height={32} />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-wide">NYATI · Sales Dashboard</p>
            <p className="truncate text-xs text-white/70">Sales · Registration · Collection · Outstanding</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden text-right text-xs leading-tight text-white/80 sm:block">
              {session.email}
              <br />
              <span className="font-medium text-white">{session.role}</span>
            </span>
            <ThemeToggle />
            <form action={logoutAction}>
              <button type="submit" title="Sign out" aria-label="Sign out" className="rounded-md p-2 text-white/85 hover:bg-white/10 hover:text-white">
                <LogOut aria-hidden className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 lg:flex-row lg:gap-6 lg:py-6">
        <aside className="lg:sticky lg:top-[72px] lg:h-fit lg:w-56 lg:shrink-0">
          <Suspense>
            <Sidebar items={items} />
          </Suspense>
        </aside>
        <main className="min-w-0 flex-1 pb-24">{children}</main>
      </div>
      <Suspense>
        <ChatWidget />
      </Suspense>
    </div>
  );
}
