import prisma from '@/lib/db';

/**
 * Fleet-wide rate limiting.
 *
 * Counters live in the database rather than process memory, because each
 * serverless invocation may land on a different instance — an in-memory limit
 * throttles one warm lambda while an attacker rotating across cold starts gets
 * a fresh budget every time.
 *
 * This is a fixed window, not a sliding one: simple, one round trip, and
 * adequate for sign-in and registration. It is not a substitute for an edge
 * WAF against a distributed attack, but it stops trivial scripted abuse.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();

  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    // No window yet, or the previous one has expired — start a fresh one.
    if (!existing || existing.resetAt <= now) {
      const resetAt = new Date(now.getTime() + windowMs);
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return { allowed: true, remaining: maxAttempts - 1, retryAfterSeconds: 0 };
    }

    if (existing.count >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000)
        ),
      };
    }

    const updated = await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    return {
      allowed: true,
      remaining: Math.max(0, maxAttempts - updated.count),
      retryAfterSeconds: 0,
    };
  } catch (err) {
    // Fail open. A database blip should not lock everyone out of signing in;
    // the limiter is a speed bump, not an access control, and the endpoints it
    // guards enforce their own authentication regardless.
    console.error('[rateLimit]', err);
    return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
  }
}

/** Best-effort client address. Vercel sets x-forwarded-for at the edge. */
export function clientKey(request: Request, scope: string): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return `${scope}:${ip}`;
}
