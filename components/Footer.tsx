'use client';

export function Footer() {
  return (
    <footer
      style={{
        background: 'rgba(2,8,23,0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
      className="py-10"
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">

          {/* Brand */}
          <div>
            <div style={{
              fontFamily: 'var(--font-mono), Space Mono, monospace',
              fontWeight: 700, fontSize: 17, color: '#ffffff',
              letterSpacing: '0.15em', marginBottom: 10,
            }}>
              EPI<span style={{ color: '#ef4444' }}>-</span>WATCH
            </div>
            <p style={{ fontSize: 12, color: 'rgba(107,114,128,0.8)', lineHeight: 1.7, maxWidth: 280 }}>
              Real-time global disease outbreak intelligence. Powered by automated surveillance of
              official health authority reports.
            </p>
          </div>

          {/* Data Sources */}
          <div>
            <h4 style={{
              fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.7)',
              textTransform: 'uppercase', letterSpacing: '0.12em',
              fontFamily: 'var(--font-mono), Space Mono, monospace',
              marginBottom: 14,
            }}>
              Data Sources
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['WHO Disease Outbreak News', 'https://www.who.int/emergencies/disease-outbreak-news'],
                ['CDC Outbreak Reports',      'https://www.cdc.gov/outbreaks/index.html'],
                ['ProMED Mail',               'https://promedmail.org'],
                ['ECDC Surveillance',         'https://www.ecdc.europa.eu/en/publications-data'],
              ].map(([label, url]) => (
                <li key={label}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'rgba(107,114,128,0.8)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#60a5fa'; }}
                    onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = 'rgba(107,114,128,0.8)'; }}
                  >
                    {label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h4 style={{
              fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.7)',
              textTransform: 'uppercase', letterSpacing: '0.12em',
              fontFamily: 'var(--font-mono), Space Mono, monospace',
              marginBottom: 14,
            }}>
              About
            </h4>
            <ul style={{
              listStyle: 'none', padding: 0, margin: 0,
              display: 'flex', flexDirection: 'column', gap: 7,
              fontSize: 12, color: 'rgba(107,114,128,0.8)',
            }}>
              <li>Updates every hour via automated scrapers</li>
              <li>Severity classified by case &amp; death counts</li>
              <li>Open source · MIT License</li>
              <li>Built with Next.js, Prisma, Three.js</li>
            </ul>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: 24,
          display: 'flex', flexWrap: 'wrap',
          alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <p style={{
            fontSize: 11, color: 'rgba(71,85,105,0.8)',
            fontFamily: 'var(--font-mono), Space Mono, monospace',
          }}>
            © {new Date().getFullYear()} Epi-Watch · For informational purposes only
          </p>
          <p style={{
            fontSize: 11, color: 'rgba(71,85,105,0.8)',
            fontFamily: 'var(--font-mono), Space Mono, monospace',
          }}>
            Data sourced from public health authorities
          </p>
        </div>
      </div>
    </footer>
  );
}
