'use client';

import { useMemo, useState } from 'react';
import type { Alert, AlertsData, AlertTier } from '@/lib/live/alerts';
import { fmtDateShort } from '@/lib/format';

type View = 'all' | AlertTier | 'workforce';

const VIEWS: { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'international', label: 'International agencies' },
  { value: 'national', label: 'National authorities' },
  { value: 'workforce', label: 'Response and workforce' },
];

const KIND_LABEL: Record<Alert['kind'], string> = {
  'outbreak-notice': 'Outbreak notice',
  'travel-notice': 'Travel notice',
  'threat-report': 'Threat report',
  news: 'Agency news',
};

const LANG_NAME: Record<string, string> = {
  en: 'English', pt: 'Portuguese', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', id: 'Indonesian',
  vi: 'Vietnamese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', 'zh-Hant': 'Chinese (traditional)', ar: 'Arabic',
  th: 'Thai', ms: 'Malay', fa: 'Persian', he: 'Hebrew', tr: 'Turkish', nl: 'Dutch', sv: 'Swedish', no: 'Norwegian',
  da: 'Danish', fi: 'Finnish', pl: 'Polish', el: 'Greek', ro: 'Romanian', cs: 'Czech', hu: 'Hungarian',
  uk: 'Ukrainian', ru: 'Russian', bn: 'Bengali',
};

const PAGE = 60;

export default function AlertsFeed({ data }: { data: AlertsData }) {
  const [view, setView] = useState<View>('all');
  const [country, setCountry] = useState('ALL');
  const [lang, setLang] = useState('ALL');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);

  const countries = useMemo(
    () => [...new Set(data.alerts.map((a) => a.country).filter((c): c is string => !!c))].sort(),
    [data.alerts]
  );
  const langs = useMemo(() => [...new Set(data.alerts.map((a) => a.language))].sort(), [data.alerts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.alerts.filter((a) => {
      if (view === 'workforce' ? !a.workforce : view !== 'all' && a.tier !== view) return false;
      // Media items exist only to cover workforce events; outside that view
      // they would blur the line between agency notices and journalism.
      if (view !== 'workforce' && a.tier === 'media') return false;
      if (country !== 'ALL' && a.country !== country) return false;
      if (lang !== 'ALL' && a.language !== lang) return false;
      if (q && !`${a.title} ${a.titleEn ?? ''} ${a.publisher} ${a.country ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.alerts, view, country, lang, query]);

  const okSources = data.sources.filter((s) => s.ok).length;
  const nonEnglish = data.alerts.filter((a) => a.language !== 'en').length;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Official alerts</h1>
        <p className="page-lede">
          Notices from international health agencies and from {data.sources.filter((s) => s.tier === 'national').length}{' '}
          national health authorities, collected every 30 minutes and shown in their original language.
          National items come from each authority&rsquo;s own website; a news story quoting a ministry is not included.
        </p>
      </header>

      <div className="news-layout">
        <section aria-label="Alerts">
          <div className="ob-toolbar">
            <div className="ob-seg" role="group" aria-label="Source type" style={{ flexWrap: 'wrap' }}>
              {VIEWS.map((v) => (
                <button key={v.value} type="button" className="chip" aria-pressed={view === v.value}
                  onClick={() => { setView(v.value); setShown(PAGE); }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ob-toolbar">
            <input className="input ob-search" type="search" placeholder="Search alerts" value={query}
              onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} aria-label="Search alerts" />
            <select className="select" value={country} onChange={(e) => { setCountry(e.target.value); setShown(PAGE); }} aria-label="Country">
              <option value="ALL">All countries</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="select" value={lang} onChange={(e) => { setLang(e.target.value); setShown(PAGE); }} aria-label="Language">
              <option value="ALL">All languages</option>
              {langs.map((l) => <option key={l} value={l}>{LANG_NAME[l] ?? l}</option>)}
            </select>
          </div>

          <div className="ob-summary">
            <span><strong>{filtered.length}</strong> {view === 'workforce' ? 'items' : 'alerts'}</span>
            <span className="muted">Collected {fmtDateShort(data.fetchedAt)}, {new Date(data.fetchedAt).toISOString().slice(11, 16)} UTC</span>
          </div>

          {view === 'workforce' && (
            <div className="note" style={{ marginBottom: 12 }}>
              Deployments of response teams, infections among health workers, strikes and staffing shortages, found
              by keyword in agency notices and in a news search. Items marked <em>Media</em> are journalism, not
              agency statements. This is event reporting only: Epi-watch does not track where individual health
              workers are, and no public source publishes that.
            </div>
          )}

          <div className="panel">
            {filtered.length === 0 ? (
              <p className="muted" style={{ padding: 20 }}>No alerts match.</p>
            ) : (
              <ol className="news-list">
                {filtered.slice(0, shown).map((a) => (
                  <li key={a.id}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="news-title"
                      lang={a.language !== 'en' && !a.titleEn ? a.language : undefined}>
                      {a.titleEn ?? a.title}
                    </a>
                    {a.titleEn && <span className="alert-orig" lang={a.language}>{a.title}</span>}
                    <div className="news-meta">
                      <span>{a.publisher}</span>
                      {a.country && <span>{a.country}</span>}
                      {a.publishedAt && <span>{fmtDateShort(a.publishedAt)}</span>}
                      <span className="tag">
                        {a.tier === 'media' ? 'Media' : a.tier === 'national' ? 'National authority' : KIND_LABEL[a.kind]}
                      </span>
                      {a.language !== 'en' && (
                        <span className="tag">{LANG_NAME[a.language] ?? a.language}{a.titleEn ? ', translated' : ''}</span>
                      )}
                      {a.workforce && view !== 'workforce' && <span className="tag">Workforce</span>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {filtered.length > shown && (
              <div className="panel-foot">
                <button type="button" className="btn" onClick={() => setShown((s) => s + PAGE)}>
                  Show {Math.min(PAGE, filtered.length - shown)} more
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className="panel" aria-label="Sources" style={{ alignSelf: 'start' }}>
          <div className="panel-header">
            <h2 className="panel-title">Sources</h2>
            <span className="panel-meta">{okSources} of {data.sources.length} reachable</span>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
            {!data.translated && nonEnglish > 0 && (
              <p className="muted" style={{ fontSize: 12 }}>
                {nonEnglish} items are in their original language. Automatic translation runs only when an Anthropic
                API key is configured.
              </p>
            )}
            {(['international', 'national', 'media'] as const).map((tier) => (
              <div key={tier}>
                <h3 className="ct-h">
                  {tier === 'international' ? 'International agencies' : tier === 'national' ? 'National authorities' : 'News search (workforce only)'}
                </h3>
                <ul className="src-list">
                  {data.sources.filter((s) => s.tier === tier).map((s) => (
                    <li key={s.name}>
                      <span>{s.name}</span>
                      <span className="muted tabular-nums">{s.ok ? s.count : 'unreachable'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
              Counts are items that name a disease or outbreak, from the last 60 days (21 for national authorities
              and news). A zero means nothing matched in that window, not that the source failed.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
