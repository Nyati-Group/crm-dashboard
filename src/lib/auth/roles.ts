/**
 * Role-based page access. STUB: replace the user store / session in src/lib/auth with SSO later;
 * this access map stays the same.
 */
export const ROLES = ['Admin', 'Sales Head', 'Viewer'] as const;
export type Role = (typeof ROLES)[number];

export interface NavItem {
  href: string;
  label: string;
  roles: readonly Role[];
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Overview', roles: ROLES },
  { href: '/sales', label: 'Sales by Project', roles: ROLES },
  { href: '/registration', label: 'Registration', roles: ROLES },
  { href: '/collection', label: 'Collection & Outstanding', roles: ROLES },
  { href: '/projects', label: 'Project Info', roles: ROLES },
];

/** Who may switch the data source when more than one is configured. */
export const CAN_SWITCH_SOURCE: readonly Role[] = ['Admin', 'Sales Head'];

export function canAccess(role: Role, pathname: string): boolean {
  const item = [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) =>
    n.href === '/' ? pathname === '/' : pathname === n.href || pathname.startsWith(`${n.href}/`),
  );
  return item ? item.roles.includes(role) : true;
}

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}
