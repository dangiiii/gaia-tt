import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side guard for mutating API routes.
 * Returns a 401/500 response if the request is not authorized, or null if it may proceed.
 * The password travels in the `x-admin-password` header and is compared against the
 * server-only ADMIN_PASSWORD env var (never shipped to the client bundle).
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD is not configured on the server' },
      { status: 500 }
    );
  }
  if (request.headers.get('x-admin-password') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
