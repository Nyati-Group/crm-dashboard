/**
 * User roles. The dashboard is a single Overview page that every signed-in role can open
 * (the old per-topic pages redirect to it, see next.config.mjs).
 */
export const ROLES = ['Admin', 'Sales Head', 'Viewer'] as const;
export type Role = (typeof ROLES)[number];

/** Who may switch the data source (?ds=) when more than one is configured. */
export const CAN_SWITCH_SOURCE: readonly Role[] = ['Admin', 'Sales Head'];

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}
