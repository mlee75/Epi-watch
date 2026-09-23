'use client';

import { useEffect, useState } from 'react';
import { SeverityBadge } from './SeverityBadge';
import { SourceCard } from './SourceCard';
import { SourcesModal } from './SourcesModal';
import { AIOverview } from './AIOverview';
import { fmtCfr, fmtCount, fmtDate, regionLabel } from '@/lib/format';
import type { Outbreak, OutbreakSource } from '@/lib/types';

const TREND_LABEL: Record<string, string> = {
  increasing: 'Increasing',
  decreasing: 'Decreasing',
  stable: 'Stable',
};

interface Props {
  outbreak: Outbreak | null;
  onClose: () => void;
  aiEnabled?: boolean;
}

/**
 * Record detail drawer, opened from the globe.
 *
 * "Verified" is now "Curated": the flag marks a record entered from agency
 * reporting, not an independent verification. CFR shows a dash unless both
 * figures were reported, instead of "0.00%" for records with no case count.
 */
export function OutbreakDetailPanel({ outbreak, onClose, aiEnabled = false }: Props) {
  const [sources, setSources] = useState<OutbreakSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!outbreak) { setSources([]); return; }
    setSourcesLoading(true);
    setSources([]);
    fetch(`/api/outbreaks/${outbreak.id}/sources`)
      .then((r) => r.json())
      .then((j) => setSources(j.data ?? []))
      .catch(() => setSources([]))
      .finally(() => setSourcesLoading(false));
  }, [outbreak?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!outbreak) return null;

  const o = outbreak;
  const lang = o.language || 'en';
  const sourceDomain = (() => {
    try { return new URL(o.sourceUrl).hostname.replace('www.', ''); }
    catch { return o.sourceName; }
  })();

  return (
    <>
      <div className="overlay-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${o.disease}, ${o.country}`}>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <SeverityBadge severity={o.severity} />
              <span className="tag">{o.verified ? 'Curated' : 'Automated, not reviewed'}</span>
            </div>
            <h2 className="drawer-title">{o.disease}</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              {o.country}
              {o.subregion && ` · ${o.subregion}`}
              {o.region && ` · ${regionLabel(o.region)}`}
            </p>
          </div>
          <button type="button" className="ct-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="drawer-body">
          <dl className="drawer-stats">
            <div><dt>Cases</dt><dd>{fmtCount(o.cases)}</dd></div>
            <div><dt>Deaths</dt><dd>{fmtCount(o.deaths)}</dd></div>
            <div><dt>CFR</dt><dd>{fmtCfr(o.cases, o.deaths)}</dd></div>
          </dl>

          <dl className="drawer-facts">
            <dt>Reported</dt><dd>{fmtDate(o.reportDate)}</dd>
            {o.pathogen && (<><dt>Pathogen</dt><dd><em>{o.pathogen}</em></dd></>)}
            {o.trend && (<><dt>Trend (as reported)</dt><dd>{TREND_LABEL[o.trend] ?? o.trend}</dd></>)}
            <dt>Source</dt><dd>{o.sourceName}</dd>
          </dl>

          {!o.verified && (
            <div className="note">
              Extracted automatically from a news headline and not reviewed. Figures, location and
              severity may be wrong, and the same event may appear as several records.
            </div>
          )}

          {o.titleOrig && lang !== 'en' && (
            <section className="drawer-section">
              <h3 className="ct-h">Original headline ({lang.toUpperCase()})</h3>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic' }}>{o.titleOrig}</p>
            </section>
          )}

          {o.summary && (
            <section className="drawer-section">
              <h3 className="ct-h">Summary</h3>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{o.summary}</p>
            </section>
          )}

          {aiEnabled && <AIOverview outbreakId={o.id} />}

          <section className="drawer-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 className="ct-h">
                Source reports{!sourcesLoading && <span className="muted" style={{ fontWeight: 400 }}> · {sources.length}</span>}
              </h3>
              {sources.length > 3 && (
                <button type="button" className="link ob-clear" onClick={() => setShowModal(true)}>
                  View all {sources.length}
                </button>
              )}
            </div>
            {sourcesLoading ? (
              <p className="muted" style={{ fontSize: 12.5 }}>Loading…</p>
            ) : sources.length === 0 ? (
              <p className="muted" style={{ fontSize: 12.5 }}>No further reports linked. The primary source is below.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {sources.slice(0, 3).map((s) => <SourceCard key={s.id} source={s} />)}
              </div>
            )}
          </section>
        </div>

        <div className="drawer-foot">
          <a className="btn btn-primary" href={o.sourceUrl} target="_blank" rel="noopener noreferrer"
            style={{ width: '100%', justifyContent: 'center' }}>
            Open source report · {sourceDomain}
          </a>
        </div>
      </aside>

      {showModal && (
        <SourcesModal outbreakId={o.id} disease={o.disease} country={o.country}
          onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
