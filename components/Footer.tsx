import Link from 'next/link';

/**
 * The previous footer claimed "Updates every hour via automated scrapers" —
 * record ingestion runs once a day — and "Open source · MIT License", although
 * the repository carries no licence file. Each cadence below is stated per
 * data type instead.
 */

const REFERENCES: [string, string][] = [
  ['WHO Disease Outbreak News', 'https://www.who.int/emergencies/disease-outbreak-news'],
  ['CDC Travel Health Notices', 'https://wwwnc.cdc.gov/travel/notices'],
  ['ECDC Communicable Disease Threats', 'https://www.ecdc.europa.eu/en/publications-and-data/monitoring/weekly-threats-reports'],
  ['PAHO Epidemiological Alerts', 'https://www.paho.org/en/epidemiological-alerts-and-updates'],
  ['WHO FluID (SARI)', 'https://www.who.int/teams/global-influenza-programme/surveillance-and-monitoring/fluid'],
  ['CDC NHSN hospital data', 'https://data.cdc.gov/d/ua7e-t2fy'],
  ['UKHSA data dashboard', 'https://ukhsa-dashboard.data.gov.uk/'],
  ['GDACS disaster alerts', 'https://www.gdacs.org/'],
  ['adsb.lol aircraft data (ODbL)', 'https://adsb.lol/'],
];

const SITE: [string, string][] = [
  ['Outbreaks', '/outbreaks'],
  ['Alerts', '/alerts'],
  ['Hospitals', '/hospitals'],
  ['News', '/news'],
  ['Video', '/videos'],
  ['Methodology & FAQ', '/faq'],
];

const LEGAL: [string, string][] = [
  ['Privacy', '/privacy'],
  ['Cookies', '/cookies'],
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="page">
        <div className="site-footer-grid">
          <div>
            <div className="site-footer-name">Epi-watch</div>
            <p className="site-footer-text">
              A public tracker of reported infectious disease outbreaks. It aggregates
              published reporting and is not a substitute for official guidance — for
              decisions about your health or travel, consult WHO, CDC or your national
              health authority.
            </p>
          </div>

          <div>
            <div className="site-footer-h">Primary sources</div>
            <ul>
              {REFERENCES.map(([name, url]) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="link">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="site-footer-h">Epi-watch</div>
            <ul>
              {SITE.map(([name, href]) => (
                <li key={href}>
                  <Link href={href} className="link">{name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="site-footer-h">Data</div>
            <ul className="site-footer-facts">
              <li>Outbreak records ingested daily at 06:00 UTC</li>
              <li>Alerts refreshed every 30 minutes</li>
              <li>Hospital data refreshed hourly</li>
              <li>Aircraft positions every 30 seconds</li>
              <li>Severity from reported cases and deaths</li>
              <li>
                <a href="https://github.com/mlee75/Epi-watch" target="_blank" rel="noopener noreferrer" className="link">
                  Source code on GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="site-footer-base">
          <span>© {new Date().getFullYear()} Epi-watch</span>
          <span className="site-footer-legal">
            {LEGAL.map(([name, href]) => (
              <Link key={href} href={href} className="link">{name}</Link>
            ))}
          </span>
        </div>
      </div>

      <style>{`
        .site-footer { margin-top: 64px; border-top: 1px solid var(--hairline); background: var(--page); }
        .site-footer-grid {
          display: grid; grid-template-columns: 2fr 1.4fr 1fr 1.2fr; gap: 32px; padding: 36px 0 28px;
        }
        @media (max-width: 900px) { .site-footer-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .site-footer-grid { grid-template-columns: 1fr; } }
        .site-footer-name { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
        .site-footer-text { font-size: 12.5px; color: var(--ink-3); line-height: 1.65; max-width: 380px; }
        .site-footer-h { font-size: 12px; color: var(--ink-3); margin-bottom: 10px; }
        .site-footer ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; font-size: 13px; }
        .site-footer .link { color: var(--ink-2); }
        .site-footer .link:hover { color: var(--ink-1); }
        .site-footer-facts li { color: var(--ink-2); }
        .site-footer-base {
          display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          padding: 14px 0 22px; border-top: 1px solid var(--hairline); font-size: 12px; color: var(--ink-3);
        }
        .site-footer-legal { display: flex; gap: 16px; }
      `}</style>
    </footer>
  );
}
