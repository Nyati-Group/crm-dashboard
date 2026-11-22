import Link from 'next/link';

export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm rounded-xl border border-line bg-surface p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">No access to this page</h1>
        <p className="mt-2 text-sm text-muted">Your role does not include this page. Ask an Admin if you need access.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
          Back to Overview
        </Link>
      </div>
    </main>
  );
}
