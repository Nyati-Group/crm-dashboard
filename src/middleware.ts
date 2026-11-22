import { NextResponse, type NextRequest } from 'next/server';
import { canAccess } from './lib/auth/roles';
import { SESSION_COOKIE, verifySession } from './lib/auth/session';
import { missingSettings, setupPageHtml } from './lib/env-check';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === '/api/health') return NextResponse.next();

  // Production without its required settings: explain what is missing instead of failing with a 500.
  const missing = missingSettings();
  if (missing.length) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Server setup incomplete', missing }, { status: 503 });
    return new NextResponse(setupPageHtml(missing), { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  if (pathname === '/login') return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (pathname !== '/forbidden' && !canAccess(session.role, pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/forbidden';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|nyati-logo.jpg).*)'],
};
