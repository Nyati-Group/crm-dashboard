/**
 * Smoke test against a running app (npm run dev / npm start):
 * renders every page for every configured data source (real, TEST, broken, Google Sheet)
 * and checks role-based access.
 *
 *   npm run smoke            (BASE_URL defaults to http://localhost:3000)
 */
import { readFileSync, existsSync } from 'node:fs';

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

// Single-page dashboard: every section is on the Overview.
const PAGES: [string, RegExp][] = [
  ['/', /Project at a glance[\s\S]*Target vs achieved[\s\S]*Unit inventory[\s\S]*Outstanding by age/],
  ['/copilot', /AI Copilot[\s\S]*How can I help/],
];
const OLD_PAGES = ['/sales', '/registration', '/collection', '/projects'];

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');
  const { signSession } = await import('../src/lib/auth/session');
  const { getSourceConfigs } = await import('../src/lib/data/registry');
  const base = process.env.BASE_URL ?? 'http://localhost:3000';
  const admin = (await signSession('smoke@nyati.local', 'Admin')).token;
  const viewer = (await signSession('smoke-viewer@nyati.local', 'Viewer')).token;
  const sources = getSourceConfigs();
  let failures = 0;

  const get = async (path: string, token?: string) =>
    fetch(`${base}${path}`, { headers: token ? { cookie: `nyati_session=${token}` } : {}, redirect: 'manual' });

  for (const s of sources) {
    for (const [page, marker] of PAGES) {
      const res = await get(`${page}?ds=${encodeURIComponent(s.id)}`, admin);
      const html = await res.text();
      let verdict: string;
      if (res.status !== 200) verdict = `HTTP ${res.status}`;
      else if (/Application error|Unhandled Runtime Error|__next_error__/.test(html)) verdict = 'RUNTIME ERROR';
      else if (/does not match the expected sheet format/.test(html)) verdict = 'schema-error page';
      else if (/Data source not available/.test(html)) verdict = 'unavailable page';
      else if (marker.test(html)) verdict = 'ok';
      else verdict = 'MARKER MISSING';
      const bad = verdict.startsWith('HTTP') || verdict === 'RUNTIME ERROR' || verdict === 'MARKER MISSING' || /Test data, not real company figures|Data Quality|Needs clarification|data issue/i.test(html);
      if (bad) failures++;
      const test = /Test data, not real company figures|Data Quality/i.test(html) ? ' [UNWANTED TEST/DQ TEXT]' : '';
      console.log(`${bad ? 'FAIL' : 'pass'}  ${s.label.padEnd(30)} ${page.padEnd(14)} ${verdict}${test}`);
    }
  }

  for (const page of OLD_PAGES) {
    const res = await get(page, admin);
    const okRedirect = res.status >= 300 && res.status < 400 && new URL(res.headers.get('location') ?? '', base).pathname === '/';
    if (!okRedirect) failures++;
    console.log(`${okRedirect ? 'pass' : 'FAIL'}  old page ${page} redirects to the Overview (${res.status})`);
  }

  const anon = await get('/');
  const anonOk = anon.status === 307 && /\/login/.test(anon.headers.get('location') ?? '');
  console.log(`${anonOk ? 'pass' : 'FAIL'}  signed-out user is sent to /login (${anon.status})`);
  const v = await get('/', viewer);
  const vOk = v.status === 200;
  console.log(`${vOk ? 'pass' : 'FAIL'}  Viewer can open the Overview (${v.status})`);
  if (!anonOk) failures++;
  if (!vOk) failures++;

  console.log(failures ? `\n${failures} failure(s)` : '\nAll smoke checks passed');
  process.exit(failures ? 1 : 0);
}

void main();
