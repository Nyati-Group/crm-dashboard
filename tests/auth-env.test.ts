import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { authenticate } from '@/lib/auth/users';
import { missingSettings, setupPageHtml } from '@/lib/env-check';

describe('password hashes', () => {
  it('verifies the right password and rejects others', () => {
    const h = hashPassword('Str0ng-Pass!');
    expect(h).toMatch(/^scrypt\.[\w-]+\.[\w-]+$/);
    expect(h).not.toMatch(/[:;$]/);
    expect(verifyPassword('Str0ng-Pass!', h)).toBe(true);
    expect(verifyPassword('wrong', h)).toBe(false);
  });

  it('still accepts plain-text passwords', () => {
    expect(verifyPassword('abc12345', 'abc12345')).toBe(true);
    expect(verifyPassword('abc1234', 'abc12345')).toBe(false);
  });
});

describe('AUTH_USERS login', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('signs in hashed and plain users with the right role', () => {
    vi.stubEnv('AUTH_USERS', `boss@nyati.com:${hashPassword('Secret-1')}:Admin;view@nyati.com:plain-pass:Viewer`);
    expect(authenticate('Boss@Nyati.com', 'Secret-1')).toEqual({ email: 'boss@nyati.com', role: 'Admin' });
    expect(authenticate('boss@nyati.com', 'nope')).toBeNull();
    expect(authenticate('view@nyati.com', 'plain-pass')?.role).toBe('Viewer');
  });

  it('has no demo users in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_USERS', '');
    expect(authenticate('admin@nyati.local', 'admin123')).toBeNull();
  });
});

describe('production settings check', () => {
  it('names only the missing settings, never values', () => {
    const missing = missingSettings({ NODE_ENV: 'production', AUTH_SECRET: 'x'.repeat(32), DATA_SOURCES: 'gsheet-public:abc|S' });
    expect(missing).toEqual(['AUTH_USERS']);
    const html = setupPageHtml(missing);
    expect(html).toContain('AUTH_USERS');
    expect(html).not.toContain('x'.repeat(32));
  });

  it('is silent outside production', () => {
    expect(missingSettings({ NODE_ENV: 'development' })).toEqual([]);
  });
});
