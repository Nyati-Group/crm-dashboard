'use client';

import clsx from 'clsx';
import { ChevronsLeft, ChevronsRight, LayoutDashboard, Menu, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV_COOKIE } from '@/lib/nav';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/copilot', label: 'AI Copilot', icon: Sparkles, tag: 'AI' },
];

const RAIL = 76;
const WIDE = 240;

/** One solid colour: the navy of the Nyati logo. */
const NAV_BG = '#1e3f8a';

function NavLinks({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <ul className="space-y-1.5">
      {NAV.map(({ href, label, icon: Icon, tag }) => {
        const active = href === '/' ? path === '/' : path.startsWith(href);
        return (
          <li key={href} className="group/item relative">
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              aria-label={open ? undefined : label}
              className={clsx(
                'flex h-11 items-center rounded-xl text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/70',
                // expanded: icon and tab name; collapsed: icon only
                open ? 'gap-3 px-3' : 'justify-center',
                active ? 'bg-white text-[rgb(var(--header))] shadow-md' : 'text-white/75 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon aria-hidden className="h-5 w-5 shrink-0" />
              {open && <span className="truncate">{label}</span>}
              {open && tag && (
                <span className={clsx('ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide', active ? 'bg-[rgb(var(--header))]/10 text-[rgb(var(--header))]' : 'bg-white/15 text-white')}>{tag}</span>
              )}
            </Link>
            {/* name on hover while collapsed */}
            {!open && (
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/item:opacity-100">
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Brand({ open }: { open: boolean }) {
  return (
    <Link href="/" aria-label="Nyati Sales Dashboard: go to the Overview" className={clsx('flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/70', !open && 'justify-center')}>
      <span className="shrink-0 rounded-xl bg-white p-1.5 shadow-md transition-transform hover:scale-105">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nyati-logo.jpg" alt="" width={28} height={34} />
      </span>
      {open && (
        <span className="min-w-0 leading-tight text-white">
          <span className="block text-base font-bold tracking-wide">NYATI</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Sales Dashboard</span>
        </span>
      )}
    </Link>
  );
}

/**
 * App frame: collapsible left navbar (icon rail by default, 240px when expanded), a drawer on
 * phones, and the sticky header to the right of it.
 */
export function AppShell({ initialOpen, header, children }: { initialOpen: boolean; header: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(initialOpen);
  const [drawer, setDrawer] = useState(false);
  const path = usePathname();

  const toggle = () => {
    const next = !open;
    setOpen(next);
    document.cookie = `${NAV_COOKIE}=${next ? 'open' : 'closed'}; path=/; max-age=31536000; samesite=lax`;
  };

  // close the phone drawer on navigation and on Escape
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  return (
    <div className="min-h-screen">
      {/* desktop navbar */}
      <aside
        aria-label="Main navigation"
        className="fixed inset-y-0 left-0 z-40 hidden flex-col overflow-visible shadow-xl transition-[width] duration-300 ease-out lg:flex"
        style={{ width: open ? WIDE : RAIL, background: NAV_BG }}
      >
        <div className={clsx('flex h-[62px] items-center border-b border-white/10', open ? 'px-5' : 'justify-center px-2')}>
          <Brand open={open} />
        </div>
        <nav className={clsx('flex-1 py-5', open ? 'px-4' : 'px-3')}>
          {open && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Menu</p>}
          <NavLinks open={open} />
        </nav>
        <div className={clsx('border-t border-white/10 py-3', open ? 'px-4' : 'px-3')}>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? 'Collapse navigation' : 'Expand navigation'}
            title={open ? 'Collapse' : 'Expand'}
            className={clsx(
              'flex h-10 w-full items-center rounded-xl text-sm text-white/70 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70',
              open ? 'gap-3 px-3' : 'justify-center',
            )}
          >
            {open ? <ChevronsLeft aria-hidden className="h-5 w-5" /> : <ChevronsRight aria-hidden className="h-5 w-5" />}
            {open && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* phone drawer */}
      <div className={clsx('fixed inset-0 z-50 lg:hidden', drawer ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!drawer}>
        <div className={clsx('absolute inset-0 bg-ink/50 backdrop-blur-[2px] transition-opacity duration-300', drawer ? 'opacity-100' : 'opacity-0')} onClick={() => setDrawer(false)} />
        <aside
          aria-label="Main navigation"
          className={clsx('absolute inset-y-0 left-0 flex w-[260px] max-w-[82vw] flex-col shadow-2xl transition-transform duration-300 ease-out', drawer ? 'translate-x-0' : '-translate-x-full')}
          style={{ background: NAV_BG }}
        >
          <div className="flex h-[62px] items-center justify-between border-b border-white/10 px-5">
            <Brand open />
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close navigation" className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white" tabIndex={drawer ? 0 : -1}>
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-5">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Menu</p>
            <NavLinks open onNavigate={() => setDrawer(false)} />
          </nav>
        </aside>
      </div>

      {/* page */}
      <div className="transition-[padding] duration-300 ease-out lg:pl-[var(--nav-w)]" style={{ ['--nav-w' as string]: `${open ? WIDE : RAIL}px` }}>
        <header className="sticky top-0 z-30 bg-gradient-to-r from-[rgb(var(--header))] via-[rgb(var(--header))] to-[rgb(var(--brand-2))] text-white shadow-lg">
          <div className="mx-auto flex h-[62px] max-w-[1440px] items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
              aria-expanded={drawer}
              className="-ml-1 rounded-lg p-2 text-white/90 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <Menu aria-hidden className="h-5 w-5" />
            </button>
            {header}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
