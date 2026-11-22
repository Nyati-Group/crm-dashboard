'use client';

import clsx from 'clsx';
import { BarChart3, Building2, FileSignature, LayoutDashboard, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const ICONS: Record<string, typeof BarChart3> = {
  '/': LayoutDashboard,
  '/sales': BarChart3,
  '/registration': FileSignature,
  '/collection': Wallet,
  '/projects': Building2,
};

/** Navigation keeps the current filters (source, FY, segment, project) when moving between pages. */
export function Sidebar({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ['ds', 'fy', 'seg', 'project']) {
    const v = sp.get(k);
    if (v) keep.set(k, v);
  }
  const qs = keep.toString();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((it) => {
        const Icon = ICONS[it.href] ?? LayoutDashboard;
        const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={qs ? `${it.href}?${qs}` : it.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-brand/10 text-brand' : 'text-ink2 hover:bg-surface2 hover:text-ink',
            )}
          >
            <Icon aria-hidden className="h-4 w-4" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
