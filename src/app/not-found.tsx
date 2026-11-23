import { ArrowLeft, Compass } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page does not exist on the Nyati sales dashboard.',
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="animate-rise w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface text-center shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-br from-[rgb(var(--header))] to-[rgb(var(--brand-2))] px-6 pb-8 pt-7 text-white">
          <span aria-hidden className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
          <span aria-hidden className="absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-white/5" />
          <Link href="/" aria-label="Nyati Sales Dashboard: go to the Overview" className="relative mx-auto mb-4 inline-block rounded-xl bg-white p-1.5 shadow-sm transition-transform hover:scale-105">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nyati-logo.jpg" alt="" width={40} height={49} />
          </Link>
          <p className="relative text-6xl font-bold tracking-tight tabular">404</p>
          <p className="relative mt-1 text-sm text-white/75">Page not found</p>
        </div>
        <div className="p-6">
          <h1 className="flex items-center justify-center gap-2 text-lg font-semibold text-ink">
            <Compass aria-hidden className="h-5 w-5 text-brand" /> This page doesn&apos;t exist
          </h1>
          <p className="mt-2 text-sm text-muted">The link may be old or mistyped. Everything on the dashboard is now on the Overview page.</p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--header))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand2/50"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" /> Back to the Overview
          </Link>
        </div>
      </div>
      <Footer className="mt-8" />
    </main>
  );
}
