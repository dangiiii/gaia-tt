import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Anonymous-but-unforgeable voter identity for the literature voting feature.
 * The server issues `kg_voter=<uuid>.<hmac>` as an httpOnly cookie; client-supplied
 * ids are never trusted. Signed with the server-only VOTE_SECRET env var.
 */
const COOKIE = 'kg_voter';
const MAX_AGE = 60 * 60 * 24 * 365;

function sign(id: string, secret: string): string {
  return createHmac('sha256', secret).update(id).digest('base64url');
}

function verify(value: string | undefined, secret: string): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(id, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

export type VoterResult =
  | { voterId: string | null; issue?: { id: string; cookie: string } }
  | { error: NextResponse };

/** Reads the signed voter cookie. With `issue`, mints a new identity when absent/invalid. */
export function getVoter(request: NextRequest, issue: boolean): VoterResult {
  const secret = process.env.VOTE_SECRET;
  if (!secret) {
    return {
      error: NextResponse.json({ error: 'VOTE_SECRET is not configured on the server' }, { status: 500 }),
    };
  }
  const existing = verify(request.cookies.get(COOKIE)?.value, secret);
  if (existing || !issue) return { voterId: existing };
  const id = randomUUID();
  return { voterId: id, issue: { id, cookie: `${id}.${sign(id, secret)}` } };
}

export function attachVoterCookie(res: NextResponse, cookie: string): NextResponse {
  res.cookies.set(COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
  return res;
}

// Vote targets: entity ids or paper part keys, e.g. 'device:Princeton model C',
// 'paper:IAEA-CN-28-H-1:exp:a9c4e00c'. Device ids embed the device name, so
// spaces/punctuation are allowed; only control characters are rejected.
// eslint-disable-next-line no-control-regex
const TARGET_RE = /^(paper|device|finding):[^\x00-\x1f\x7f]{1,300}$/;
export const isValidTarget = (t: unknown): t is string =>
  typeof t === 'string' && TARGET_RE.test(t);

/**
 * Best-effort per-IP fixed-window rate limit. In-memory, so on serverless it is
 * per-instance — it blunts scripted spam but is not a hard guarantee.
 */
const hits = new Map<string, { count: number; reset: number }>();
export function rateLimited(request: NextRequest, limit = 30, windowMs = 60_000): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + windowMs });
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    }
    return false;
  }
  return ++entry.count > limit;
}
