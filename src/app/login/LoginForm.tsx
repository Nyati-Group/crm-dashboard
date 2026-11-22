'use client';

import { useActionState } from 'react';
import { loginAction } from '../actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand2 focus:ring-2 focus:ring-brand2/30"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand2 focus:ring-2 focus:ring-brand2/30"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-badInk">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[rgb(var(--header))] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
