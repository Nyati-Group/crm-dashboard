import { missingSettings } from './lib/env-check';

/**
 * Runs once when the server starts. In production it logs any missing required setting (the
 * middleware then shows a "Setup required" page instead of the app) and warns about optional ones.
 */
export function register() {
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_RUNTIME !== 'nodejs') return;
  const missing = missingSettings();
  if (missing.length) {
    console.error(`[startup] Missing required settings: ${missing.join(', ')}. The app shows a "Setup required" page until they are set. See README "Deploy".`);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[startup] GEMINI_API_KEY is not set: the assistant will answer with keyword matching only.');
  }
  if (!process.env.AUTH_USERS?.trim()) {
    console.warn('[startup] AUTH_USERS is not set: the demo users (admin@nyati.local, saleshead@nyati.local, viewer@nyati.local) can sign in.');
  }
  if (process.env.AUTH_USERS &&/:(?!scrypt\.)[^;:]+:(Admin|Sales Head|Viewer)/.test(process.env.AUTH_USERS)) {
    console.warn('[startup] AUTH_USERS contains plain-text passwords. Prefer hashes from `npm run hash-password`.');
  }
}
