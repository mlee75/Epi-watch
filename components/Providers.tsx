'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * Client boundary for Auth.js. Server components passed as children still
 * render on the server — only the provider itself is client-side.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
