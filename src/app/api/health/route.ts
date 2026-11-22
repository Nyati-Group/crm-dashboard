import { NextResponse } from 'next/server';
import { missingSettings } from '@/lib/env-check';

export const dynamic = 'force-dynamic';

/** Liveness / readiness probe. Reports only whether the server is configured, never any data or values. */
export function GET() {
  const ready = missingSettings().length === 0;
  return NextResponse.json({ ok: ready }, { status: ready ? 200 : 503 });
}
