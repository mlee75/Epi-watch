'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [time, setTime] = useState('');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const update = () => setTime(new Date().toUTCString().replace(' GMT', ' UTC'));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: scrolled
          ? 'rgba(2,8,23,0.85)'
          : 'rgba(2,8,23,0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: scrolled
          ? '1px solid rgba(255,255,255,0.1)'
          : '1px solid rgba(255,255,255,0.05)',
        boxShadow: scrolled ? '0 1px 40px rgba(0,0,0,0.5)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(239,68,68,0.8) 0%, rgba(220,38,38,0.6) 100%)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(239,68,68,0.3)',
            }}>
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, color: '#ffffff' }} fill="currentColor">
                <path d="M12 2C10.07 2 8.5 3.57 8.5 5.5c0 .74.22 1.42.6 2C7.17 7.96 6 9.61 6 11.5c0 .45.07.88.18 1.3C5.47 13.1 5 13.75 5 14.5c0 1.1.9 2 2 2h.5c.55 0 1-.45 1-1s-.45-1-1-1H7c0-.55.45-1 1-1 .37 0 .7.2.87.5H9c.3-.84.9-1.54 1.65-2C9.65 11.4 9 10.04 9 8.5c0-1.66 1.34-3 3-3s3 1.34 3 3c0 1.54-.65 2.9-1.65 3c.75.46 1.35 1.16 1.65 2h.13c.17-.3.5-.5.87-.5.55 0 1 .45 1 1h-.5c-.55 0-1 .45-1 1s.45 1 1 1H17c1.1 0 2-.9 2-2 0-.75-.47-1.4-1.18-1.7.11-.42.18-.85.18-1.3 0-1.89-1.17-3.54-2.9-4c.38-.58.6-1.26.6-2C15.5 3.57 13.93 2 12 2z"/>
              </svg>
            </div>
            <span style={{
              color: '#ffffff', fontWeight: 700, letterSpacing: '0.12em',
              fontFamily: 'var(--font-mono), Space Mono, monospace',
              fontSize: 17,
            }}>
              EPI<span style={{ color: '#ef4444' }}>-</span>WATCH
            </span>
          </Link>

          {/* Center: Live UTC clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 20,
            }}>
              <span style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7 }}>
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: '#ef4444', opacity: 0.75,
                  animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                }} />
                <span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              </span>
              <span style={{
                color: '#ef4444', fontWeight: 700,
                fontFamily: 'var(--font-mono), Space Mono, monospace',
                fontSize: 11, letterSpacing: '0.1em',
              }}>
                LIVE
              </span>
            </div>
            {time && (
              <span style={{
                color: 'rgba(148,163,184,0.7)',
                fontFamily: 'var(--font-mono), Space Mono, monospace',
                fontSize: 11,
                display: 'none',
              }}
                className="hidden lg:inline"
              >
                {time}
              </span>
            )}
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {[
              { label: 'Map',       href: '/#map'      },
              { label: 'Outbreaks', href: '/outbreaks' },
              { label: 'News',      href: '/news'      },
              { label: 'Stats',     href: '/#stats'    },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                style={{
                  padding: '6px 14px', fontSize: 13, fontWeight: 500,
                  color: 'rgba(148,163,184,0.8)',
                  borderRadius: 8, textDecoration: 'none',
                  transition: 'all 0.15s',
                  letterSpacing: '0.02em',
                }}
                onMouseOver={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.color = '#ffffff';
                  el.style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseOut={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.color = 'rgba(148,163,184,0.8)';
                  el.style.background = 'transparent';
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
        @media (max-width: 768px) {
          nav { display: none !important; }
        }
      `}</style>
    </header>
  );
}
