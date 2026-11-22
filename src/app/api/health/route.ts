import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness probe for the host. Reveals nothing about the data. */
export function GET() {
  return NextResponse.json({ ok: true });
}
