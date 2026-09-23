'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

/**
 * Session-aware corner of the header.
 *
 * Renders a fixed-width placeholder while the session resolves, rather than
 * flashing "Sign in" at someone who is already signed in.
 */
export function AuthNav() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <span style={{ display: 'inline-block', width: 56 }} aria-hidden />;
  }

  if (session?.user) {
    const label = session.user.name || session.user.email || 'Account';
    return (
      <Link href="/account" className="btn" title={session.user.email ?? undefined}>
        {label.length > 20 ? `${label.slice(0, 20)}…` : label}
      </Link>
    );
  }

  return (
    <Link href="/signin" className="btn">
      Sign in
    </Link>
  );
}
