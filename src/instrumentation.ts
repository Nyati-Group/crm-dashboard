/**
 * Runs once when the server starts. In production it stops the app if a required setting is
 * missing (rather than failing later on the first request) and warns about optional ones.
 */
export function register() {
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_RUNTIME !== 'nodejs') return;
  const missing: string[] = [];
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) missing.push('AUTH_SECRET (at least 16 characters)');
  if (!process.env.AUTH_USERS?.trim()) missing.push('AUTH_USERS (nobody could sign in)');
  if (!process.env.DATA_SOURCES?.trim()) missing.push('DATA_SOURCES');
  if (missing.length) {
    throw new Error(`Missing required settings for production: ${missing.join(', ')}. See .env.example and README "Deploy".`);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[startup] GEMINI_API_KEY is not set: the assistant will answer with keyword matching only.');
  }
}
