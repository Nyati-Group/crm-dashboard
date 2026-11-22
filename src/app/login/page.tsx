import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/current';
import { DEV_DEMO_USERS, usingDemoUsers } from '@/lib/auth/users';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentSession()) redirect('/');
  const { next } = await searchParams;
  const demo = usingDemoUsers();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nyati-logo.jpg" alt="Nyati" width={64} height={78} />
          </span>
          <h1 className="text-xl font-semibold">Sales Dashboard</h1>
          <p className="text-sm text-muted">Sign in to view sales, registration and collection.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <LoginForm next={next ?? '/'} />
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Sign-in is a placeholder (stub) and will be replaced by company SSO.
        </p>
        {demo && (
          <div className="mt-4 rounded-lg border border-line bg-surface2 p-3 text-xs text-ink2">
            <p className="mb-1 font-medium">Development demo users (disabled in production):</p>
            <ul className="space-y-0.5 tabular">
              {DEV_DEMO_USERS.map((u) => (
                <li key={u.email}>
                  {u.role}: <code>{u.email}</code> / <code>{u.password}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
