import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  validatePassword,
} from '@/lib/password';

export const dynamic = 'force-dynamic';

/**
 * Email + password registration.
 *
 * The response is deliberately identical whether or not the address is already
 * registered. Saying "that email is taken" would turn this endpoint into an
 * account-enumeration oracle, letting anyone test which addresses have accounts
 * here — on a health site that is a meaningful disclosure on its own.
 */
const GENERIC_OK = {
  ok: true,
  message: 'If that email is available, the account has been created. You can now sign in.',
};

// Best-effort in-process rate limit. Serverless instances do not share memory,
// so this throttles a single warm instance rather than the fleet — it raises
// the cost of scripted abuse but is not a substitute for an edge rate limiter.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

    if (rateLimited(ip)) {
      return NextResponse.json(
        { ok: false, error: 'Too many attempts. Try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
    }

    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : null;

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: 'Enter a valid email address.' },
        { status: 400 }
      );
    }

    // Password rules are reported plainly — withholding them helps nobody and
    // only produces failed sign-ups. Only the existence of an account is secret.
    const check = validatePassword(password);
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      // Same shape and status as success; no account is created or modified.
      return NextResponse.json(GENERIC_OK);
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.create({
      data: { email, name, passwordHash },
      select: { id: true },
    });

    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    // Never echo the thrown error: it can carry the query and its parameters.
    console.error('[POST /api/auth/register]', err);
    return NextResponse.json(
      { ok: false, error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
