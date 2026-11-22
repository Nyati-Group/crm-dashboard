import 'server-only';
import { verifyPassword } from './password';
import { isRole, type Role } from './roles';

/**
 * STUB user store. Users come from AUTH_USERS="email:password:Role;email:password:Role".
 * Roles: Admin | Sales Head | Viewer.
 * In development only, when AUTH_USERS is not set, three demo users are available
 * (listed on the login page). They are disabled in production.
 */
interface User {
  email: string;
  password: string;
  role: Role;
}

export const DEV_DEMO_USERS: User[] = [
  { email: 'admin@nyati.local', password: 'admin123', role: 'Admin' },
  { email: 'saleshead@nyati.local', password: 'sales123', role: 'Sales Head' },
  { email: 'viewer@nyati.local', password: 'viewer123', role: 'Viewer' },
];

export function usingDemoUsers(): boolean {
  return !process.env.AUTH_USERS?.trim() && process.env.NODE_ENV !== 'production';
}

function users(): User[] {
  const env = process.env.AUTH_USERS?.trim();
  if (!env) return usingDemoUsers() ? DEV_DEMO_USERS : [];
  return env
    .split(';')
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => {
      const [email, password, role] = u.split(':').map((s) => s.trim());
      return { email: email?.toLowerCase(), password, role } as User;
    })
    .filter((u) => u.email && u.password && isRole(u.role));
}

export function authenticate(email: string, password: string): { email: string; role: Role } | null {
  const u = users().find((x) => x.email === email.trim().toLowerCase());
  if (!u || !verifyPassword(password, u.password)) return null;
  return { email: u.email, role: u.role };
}
