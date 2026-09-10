import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Self-serve account deletion.
 *
 * The privacy policy commits to deleting an account on request, so that has to
 * be something a user can actually do rather than an email promise.
 *
 * Deletion is driven entirely by the server-side session — the account removed
 * is whoever is signed in, never an id supplied by the caller. Accepting a
 * userId from the request body would let anyone delete anyone else's account.
 *
 * Sessions, OAuth links and watchlist rows are removed by the schema's
 * onDelete: Cascade, so no orphans are left behind.
 */
export async function POST() {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'You must be signed in to delete your account.' },
        { status: 401 }
      );
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({
      ok: true,
      message: 'Your account and watchlist have been permanently deleted.',
    });
  } catch (err) {
    console.error('[POST /api/account/delete]', err);
    return NextResponse.json(
      { ok: false, error: 'Could not delete the account. Please try again.' },
      { status: 500 }
    );
  }
}
