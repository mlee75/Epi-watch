'use client';

export function HowItWorks() {
  const steps = [
    {
      icon: '🔍',
      title: 'Automated Surveillance',
      description:
        'Every hour, our scrapers collect data from WHO Disease Outbreak News, CDC Outbreak reports, and ProMED infectious disease alerts.',
    },
    {
      icon: '🧠',
      title: 'AI Classification',
      description:
        'Each outbreak is automatically classified by severity using case and death counts. Trends are detected by analyzing language in source reports.',
    },
    {
      icon: '🗺️',
      title: 'Geographic Mapping',
      description:
        'Outbreaks are geolocated to their affected countries and displayed on an interactive 3D globe with color-coded severity markers.',
    },
    {
      icon: '⚡',
      title: 'Real-Time Updates',
      description:
        'The intelligence feed refreshes automatically every 30 seconds. New outbreaks appear instantly without a page reload.',
    },
  ];

  const sources = [
    {
      name: 'WHO Disease Outbreak News',
      url: 'https://www.who.int/emergencies/disease-outbreak-news',
      desc: 'Official WHO reports on internationally significant disease events.',
      badge: 'WHO',
      color: { text: '#60a5fa', border: 'rgba(96,165,250,0.25)', bg: 'rgba(96,165,250,0.08)' },
    },
    {
      name: 'CDC Outbreak Reports',
      url: 'https://www.cdc.gov/outbreaks/index.html',
      desc: 'US Centers for Disease Control active outbreak investigations.',
      badge: 'CDC',
      color: { text: '#ef4444', border: 'rgba(239,68,68,0.25)', bg: 'rgba(239,68,68,0.08)' },
    },
    {
      name: 'ProMED Mail',
      url: 'https://promedmail.org',
      desc: 'Global open-source reporting system for infectious disease outbreaks.',
      badge: 'ProMED',
      color: { text: '#eab308', border: 'rgba(234,179,8,0.25)', bg: 'rgba(234,179,8,0.08)' },
    },
    {
      name: 'ECDC Surveillance',
      url: 'https://www.ecdc.europa.eu/en/publications-data',
      desc: 'European Centre for Disease Prevention and Control.',
      badge: 'ECDC',
      color: { text: '#a78bfa', border: 'rgba(167,139,250,0.25)', bg: 'rgba(167,139,250,0.08)' },
    },
  ];

  return (
    <section
      id="about"
      style={{
        background: 'rgba(2,8,23,0.5)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
      className="py-16"
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* How it works */}
        <div className="mb-16">
          <div className="mb-2">
            <span style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono), Space Mono, monospace',
              fontWeight: 700, color: '#60a5fa',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Methodology
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', marginBottom: 32, letterSpacing: '0.02em' }}>
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: 20,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                }}
                onMouseOver={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'rgba(255,255,255,0.05)';
                  el.style.borderColor = 'rgba(255,255,255,0.12)';
                  el.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e)  => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'rgba(255,255,255,0.03)';
                  el.style.borderColor = 'rgba(255,255,255,0.07)';
                  el.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 14 }}>{step.icon}</div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 8, letterSpacing: '0.02em' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.75)', lineHeight: 1.65 }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Data sources */}
        <div>
          <div className="mb-2">
            <span style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono), Space Mono, monospace',
              fontWeight: 700, color: '#60a5fa',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Intelligence Sources
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', marginBottom: 32, letterSpacing: '0.02em' }}>
            Data Sources
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sources.map((src) => (
              <a
                key={src.name}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${src.color.border}`,
                  borderRadius: 14, padding: 16, display: 'block',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                }}
                onMouseOver={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'rgba(255,255,255,0.05)';
                  el.style.transform = 'translateY(-2px) scale(1.01)';
                }}
                onMouseOut={(e)  => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'rgba(255,255,255,0.03)';
                  el.style.transform = 'translateY(0) scale(1)';
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono), Space Mono, monospace',
                    fontWeight: 700,
                    padding: '3px 8px', borderRadius: 5,
                    color: src.color.text, border: `1px solid ${src.color.border}`,
                    background: src.color.bg,
                    letterSpacing: '0.06em',
                  }}>
                    {src.badge}
                  </span>
                </div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginBottom: 5, letterSpacing: '0.01em' }}>
                  {src.name}
                </h3>
                <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', lineHeight: 1.55 }}>{src.desc}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          marginTop: 48, padding: 16,
          background: 'rgba(234,179,8,0.04)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(234,179,8,0.15)',
          borderRadius: 12,
        }}>
          <p style={{ fontSize: 12, color: 'rgba(234,179,8,0.8)', lineHeight: 1.7 }}>
            <strong style={{ color: '#eab308' }}>⚠ Data Notice:</strong> Epi-Watch aggregates
            publicly available information from official health sources. Data accuracy depends on
            source availability and reporting frequency. This platform is intended for informational
            purposes only and should not replace official public health guidance.
          </p>
        </div>
      </div>
    </section>
  );
}
