'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

/**
 * Session-aware corner of the header.
 *
 * Renders nothing at all while the session is still resolving, rather than
 * flashing "Sign in" at someone who is already signed in.
 */
export function AuthNav() {
  const { data: session, status } = useSession();

  const base: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 8,
    textDecoration: 'none',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  };

  if (status === 'loading') {
    return <span style={{ ...base, width: 64 }} aria-hidden />;
  }

  if (session?.user) {
    const label = session.user.name || session.user.email || 'Account';
    return (
      <Link
        href="/account"
        style={{ ...base, color: 'rgba(148,163,184,0.9)' }}
        title={session.user.email ?? undefined}
      >
        {label.length > 18 ? `${label.slice(0, 18)}…` : label}
      </Link>
    );
  }

  return (
    <Link href="/signin" style={{ ...base, color: 'rgba(148,163,184,0.8)' }}>
      Sign in
    </Link>
  );
}
