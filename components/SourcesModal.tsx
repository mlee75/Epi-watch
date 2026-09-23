'use client';

import { useState, useEffect } from 'react';
import { SourceCard } from './SourceCard';
import type { OutbreakSource } from '@/lib/types';

type FilterTab = 'all' | 'official' | 'news' | 'translated';

interface Props {
  outbreakId: string;
  disease: string;
  country: string;
  onClose: () => void;
}

export function SourcesModal({ outbreakId, disease, country, onClose }: Props) {
  const [sources, setSources] = useState<OutbreakSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    fetch(`/api/outbreaks/${outbreakId}/sources`)
      .then((r) => r.json())
      .then((j) => setSources(j.data ?? []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, [outbreakId]);

  const filtered = sources.filter((s) => {
    if (tab === 'official') return s.sourceType === 'official';
    if (tab === 'news') return s.sourceType !== 'official';
    if (tab === 'translated') return s.sourceLanguage !== 'en';
    return true;
  });

  const counts = {
    official: sources.filter((s) => s.sourceType === 'official').length,
    news: sources.filter((s) => s.sourceType !== 'official').length,
    translated: sources.filter((s) => s.sourceLanguage !== 'en').length,
  };
  const tabs: { key: FilterTab; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: sources.length },
    { key: 'official', label: 'Health agencies', n: counts.official },
    { key: 'news', label: 'Media', n: counts.news },
    { key: 'translated', label: 'Translated', n: counts.translated },
  ];

  return (
    <>
      <div className="overlay-backdrop" style={{ zIndex: 60 }} onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Sources: ${disease}`}
        onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h2 className="drawer-title">Sources: {disease}</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              {country} · {sources.length} report{sources.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button type="button" className="ct-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="ob-seg" style={{ padding: '0 20px 12px', flexWrap: 'wrap' }}>
          {tabs.filter((t) => t.key === 'all' || t.n > 0).map((t) => (
            <button key={t.key} type="button" className="chip" aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}>
              {t.label} ({t.n})
            </button>
          ))}
        </div>
        <div className="drawer-body">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No sources in this category.</p>
          ) : (
            filtered.map((s) => <SourceCard key={s.id} source={s} expanded />)
          )}
        </div>
      </div>
    </>
  );
}
