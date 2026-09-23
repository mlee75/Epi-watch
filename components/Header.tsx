'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthNav } from '@/components/AuthNav';

const NAV = [
  { label: 'Overview', href: '/' },
  { label: 'Outbreaks', href: '/outbreaks' },
  { label: 'News', href: '/news' },
  { label: 'Video', href: '/videos' },
  { label: 'Methodology', href: '/faq' },
];

/**
 * Formats the ingest timestamp for the header. The previous header showed a
 * pulsing "LIVE" badge and a ticking UTC clock, which implied a real-time feed;
 * ingestion runs once a day, so the honest signal is when the data was last
 * updated.
 */
function formatAsOf(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${date}, ${time} UTC`;
}

export function Header() {
  const pathname = usePathname();
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.data?.lastUpdated) setAsOf(formatAsOf(j.data.lastUpdated));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <header className="site-header">
      <div className="page site-header-row">
        <Link href="/" className="wordmark" aria-label="Epi-watch home">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="10" cy="10" rx="3.6" ry="8.25" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1.9 10h16.2" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <span>Epi-watch</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="site-nav-link"
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-header-meta">
          {asOf && (
            <span className="as-of" title="Time of the most recent record update">
              Data as of {asOf}
            </span>
          )}
          <AuthNav />
        </div>
      </div>
    </header>
  );
}
