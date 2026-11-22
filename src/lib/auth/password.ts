import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashes for AUTH_USERS: "scrypt.<salt>.<hash>" (base64url, no ":" "$" or ";" so it is
 * safe inside AUTH_USERS and .env files). Create one with: npm run hash-password -- "the password"
 */
const PREFIX = 'scrypt.';
const KEYLEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return `${PREFIX}${salt.toString('base64url')}.${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith(PREFIX)) {
    const [saltB64, hashB64] = stored.slice(PREFIX.length).split('.');
    if (!saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, 'base64url');
    const actual = scryptSync(password, Buffer.from(saltB64, 'base64url'), expected.length || KEYLEN);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  // plain-text password (allowed, but a startup warning recommends hashes)
  const a = Buffer.from(password);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
