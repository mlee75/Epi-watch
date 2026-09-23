'use client';

import { useMemo, useState } from 'react';
import type { BriefGroup, CountryBrief } from '@/lib/live/countryBrief';
import { fmtDateShort } from '@/lib/format';

const GROUP_LABEL: Record<BriefGroup, string> = {
  national: 'National health authority',
  agencies: 'WHO and international agencies',
  humanitarian: 'Humanitarian organisations',
  press: 'Established press',
};
const GROUP_ORDER: BriefGroup[] = ['national', 'agencies', 'humanitarian', 'press'];
const PAGE = 40;

export default function CountryReports({ brief }: { brief: CountryBrief }) {
  const [group, setGroup] = useState<BriefGroup | 'all'>('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of brief.items) c[it.group] = (c[it.group] ?? 0) + 1;
    return c;
  }, [brief.items]);

  const items = brief.items.filter((it) =>
    (group === 'all' || it.group === group) &&
    (!query.trim() || `${it.title} ${it.publisher}`.toLowerCase().includes(query.trim().toLowerCase()))
  );

  return (
    <section className="panel" aria-label="Verified reporting">
      <div className="panel-header">
        <h2 className="panel-title">Verified reporting</h2>
        <span className="panel-meta">Collected {fmtDateShort(brief.fetchedAt)}, {brief.fetchedAt.slice(11, 16)} UTC</span>
      </div>
      <div className="panel-body" style={{ paddingBottom: 8 }}>
        <div className="ob-toolbar" style={{ marginBottom: 0 }}>
          <div className="ob-seg" role="group" aria-label="Source type" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="chip" aria-pressed={group === 'all'} onClick={() => { setGroup('all'); setShown(PAGE); }}>
              All {brief.items.length}
            </button>
            {GROUP_ORDER.filter((g) => counts[g]).map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={group === g} onClick={() => { setGroup(g); setShown(PAGE); }}>
                {GROUP_LABEL[g]} {counts[g]}
              </button>
            ))}
          </div>
          <input className="input ob-search" type="search" placeholder="Search reports" value={query}
            onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} aria-label="Search reports" />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="panel-body muted" style={{ fontSize: 13 }}>No verified reports match.</p>
      ) : (
        <ol className="news-list">
          {items.slice(0, shown).map((it) => (
            <li key={it.id}>
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="news-title"
                lang={it.language !== 'en' ? it.language : undefined}>
                {it.title}
              </a>
              <div className="news-meta">
                <span>{it.publisher}</span>
                {it.publishedAt && <span>{fmtDateShort(it.publishedAt)}</span>}
                <span className="tag">
                  {it.kind === 'outbreak-notice' ? 'WHO outbreak notice' : it.kind === 'travel-notice' ? 'Travel notice' : GROUP_LABEL[it.group]}
                </span>
                {it.language !== 'en' && <span className="tag">{it.language.toUpperCase()}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {items.length > shown && (
        <div className="panel-foot">
          <button type="button" className="btn" onClick={() => setShown((s) => s + PAGE)}>Show {Math.min(PAGE, items.length - shown)} more</button>
        </div>
      )}

      <details className="panel-foot cx-sources">
        <summary>What was searched</summary>
        <ul>
          {brief.sources.map((s, i) => (
            <li key={i}>
              <span>
                <strong>{s.label}</strong> · {GROUP_LABEL[s.group]} · last {s.windowDays >= 365 ? `${Math.round(s.windowDays / 365)} yr` : `${s.windowDays} days`}
                <span className="muted"> · {s.domains.join(', ')}</span>
              </span>
              <span className="muted tabular-nums">{s.ok ? s.count : 'unreachable'}</span>
            </li>
          ))}
        </ul>
        <p>
          Only items whose publisher is on these domains are kept, and for agencies, humanitarian organisations and the
          press the headline must name {brief.name} and a health subject. National items must name a disease or
          outbreak. Titles are shown in their original language.
        </p>
      </details>
    </section>
  );
}
