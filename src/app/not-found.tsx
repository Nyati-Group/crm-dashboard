import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nyati-logo.jpg" alt="Nyati" width={48} height={59} className="mx-auto mb-4 rounded-md bg-white p-1" />
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted">The page you are looking for does not exist.</p>
        <Link href="/" className="mt-4 inline-block rounded-md bg-[rgb(var(--header))] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
