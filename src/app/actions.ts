'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, signSession } from '@/lib/auth/session';
import { authenticate } from '@/lib/auth/users';
import { currentSession } from '@/lib/auth/current';
import { allow } from '@/lib/chat/rate-limit';
import { clearDataCache } from '@/lib/data/loader';

export async function loginAction(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/');
  if (!allow(`login:${email.trim().toLowerCase()}`, 10)) return { error: 'Too many attempts. Please wait a minute and try again.' };
  const user = authenticate(email, password);
  if (!user) return { error: 'Email or password is incorrect.' };
  const { token, maxAge } = await signSession(user.email, user.role);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
  // only same-site relative paths
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

/** Refresh button: drop the 60-second cache and re-read the sheet. */
export async function refreshDataAction() {
  if (!(await currentSession())) return;
  clearDataCache();
  revalidatePath('/', 'layout');
}
