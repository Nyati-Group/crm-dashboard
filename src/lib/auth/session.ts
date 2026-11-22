/**
 * STUB session: an HMAC-signed cookie (Web Crypto, so it runs in middleware and on the server).
 * Swap for NextAuth / company SSO later - only this file and users.ts change.
 */
import { isRole, type Role } from './roles';

export const SESSION_COOKIE = 'nyati_session';
const MAX_AGE_SECONDS = 60 * 60 * 12;

export interface Session {
  email: string;
  role: Role;
  exp: number;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET (at least 16 characters) must be set in production.');
  }
  return 'dev-only-insecure-secret-change-me';
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signSession(email: string, role: Role): Promise<{ token: string; maxAge: number }> {
  const payload = b64url(enc.encode(JSON.stringify({ email, role, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS })));
  return { token: `${payload}.${await hmac(payload)}`, maxAge: MAX_AGE_SECONDS };
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if (!safeEqual(sig, await hmac(payload))) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    if (!isRole(s.role) || typeof s.email !== 'string' || s.exp * 1000 < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}
