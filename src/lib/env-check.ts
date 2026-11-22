/**
 * Production settings check. Edge-safe (no Node imports): used by middleware, instrumentation
 * and the health endpoint. Returns setting NAMES only, never values.
 */
export function missingSettings(env: Record<string, string | undefined> = process.env): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const missing: string[] = [];
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 16) missing.push('AUTH_SECRET');
  if (!env.AUTH_USERS?.trim()) missing.push('AUTH_USERS');
  if (!env.DATA_SOURCES?.trim()) missing.push('DATA_SOURCES');
  return missing;
}

const HELP: Record<string, string> = {
  AUTH_SECRET: 'at least 16 random characters, used to sign login sessions',
  AUTH_USERS: 'who can sign in: email:password:Role;email:password:Role (Role = Admin, Sales Head or Viewer)',
  DATA_SOURCES: 'the data source, e.g. gsheet-public:<SPREADSHEET_ID>|Nyati Sales MIS',
};

/** Plain HTML page shown instead of the app while required settings are missing. */
export function setupPageHtml(missing: string[]): string {
  const items = missing.map((m) => `<li><code>${m}</code> &ndash; ${HELP[m] ?? ''}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Setup required - Nyati Sales Dashboard</title>
<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#f3f6fb;color:#0d1830;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
main{max-width:560px;background:#fff;border:1px solid #dfe4ee;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.06)}h1{font-size:20px;margin:0 0 8px;color:#1e3f8a}
p,li{font-size:14px;line-height:1.55}code{background:#eef2f9;padding:1px 5px;border-radius:4px}</style></head>
<body><main><h1>Setup required</h1><p>The dashboard is deployed, but these settings are missing on the server:</p><ul>${items}</ul>
<p>Add them in your hosting settings (on Vercel: Project &rarr; Settings &rarr; Environment Variables), then redeploy.</p></main></body></html>`;
}
