import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Flash } from '@/components/Flash';
import { Footer } from '@/components/Footer';
import { currentSession } from '@/lib/auth/current';
import { DEV_DEMO_USERS, usingDemoUsers } from '@/lib/auth/users';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the Nyati Group sales dashboard to see sales, collection, registration and outstanding against target.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  if (await currentSession()) redirect('/');
  const { next, expired } = await searchParams;
  // demo credentials are a development aid only; never list them on a live site
  const showDemo = usingDemoUsers() && process.env.NODE_ENV !== 'production';
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Flash fallback={expired ? 'session-expired' : undefined} />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nyati-logo.jpg" alt="Nyati Group" width={64} height={78} />
          </span>
          <h1 className="text-xl font-semibold">Sales Dashboard</h1>
          <p className="text-sm text-muted">Sign in to view sales, registration and collection.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <LoginForm next={next ?? '/'} />
        </div>
        {showDemo && (
          <div className="mt-4 rounded-lg border border-line bg-surface2 p-3 text-xs text-ink2">
            <p className="mb-1 font-medium">Demo users (development only):</p>
            <ul className="space-y-0.5 break-all tabular">
              {DEV_DEMO_USERS.map((u) => (
                <li key={u.email}>
                  {u.role}: <code>{u.email}</code> / <code>{u.password}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Footer className="mt-8" />
    </main>
  );
}
