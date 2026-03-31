'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { OutbreakCard } from './OutbreakCard';
import { SearchFilter, type FilterState } from './SearchFilter';
import type { Outbreak, Severity } from '@/lib/types';

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const POLL_INTERVAL = 30_000; // 30 seconds

interface IntelligenceFeedProps {
  initialOutbreaks: Outbreak[];
}

export function IntelligenceFeed({ initialOutbreaks }: IntelligenceFeedProps) {
  const [outbreaks, setOutbreaks] = useState<Outbreak[]>(initialOutbreaks);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    severity: 'ALL',
    region: 'ALL',
    sort: 'severity',
  });
  const [loading, setLoading] = useState(false);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const [newCount, setNewCount] = useState(0);

  // Fetch updated outbreaks from the API
  const fetchOutbreaks = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch('/api/outbreaks?limit=200&active=true', {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      const fresh: Outbreak[] = json.data;

      setOutbreaks((prev) => {
        const prevIds = new Set(prev.map((o) => o.id));
        const added = fresh.filter((o) => !prevIds.has(o.id)).length;
        if (added > 0) setNewCount(added);
        return fresh;
      });
      setLastPoll(new Date());
    } catch {
      // Silently fail — keep showing stale data
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  // Set initial lastPoll on mount (avoids SSR hydration mismatch)
  useEffect(() => { setLastPoll(new Date()); }, []);

  // Poll every 30 seconds
  useEffect(() => {
    const id = setInterval(() => fetchOutbreaks(true), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchOutbreaks]);

  // Clear "new outbreaks" badge after 5 seconds
  useEffect(() => {
    if (newCount === 0) return;
    const id = setTimeout(() => setNewCount(0), 5000);
    return () => clearTimeout(id);
  }, [newCount]);

  // Apply filters client-side (fast, no network round-trip for simple filters)
  const filtered = useMemo(() => {
    let result = [...outbreaks];

    if (filters.severity !== 'ALL') {
      result = result.filter((o) => o.severity === filters.severity);
    }

    if (filters.region !== 'ALL') {
      result = result.filter((o) => o.region === filters.region);
    }

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (o) =>
          o.disease.toLowerCase().includes(q) ||
          o.country.toLowerCase().includes(q) ||
          (o.summary?.toLowerCase().includes(q) ?? false)
      );
    }

    // Sort
    switch (filters.sort) {
      case 'severity':
        result.sort(
          (a, b) =>
            (SEVERITY_ORDER[a.severity as Severity] ?? 4) -
            (SEVERITY_ORDER[b.severity as Severity] ?? 4)
        );
        break;
      case 'cases':
        result.sort((a, b) => b.cases - a.cases);
        break;
      case 'deaths':
        result.sort((a, b) => b.deaths - a.deaths);
        break;
      case 'recent':
      default:
        result.sort(
          (a, b) =>
            new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime()
        );
        break;
    }

    return result;
  }, [outbreaks, filters]);

  return (
    <div>
      {/* New outbreaks notification */}
      {newCount > 0 && (
        <div
          className="mb-4 flex items-center gap-2 animate-fade-in"
          style={{ padding: '8px 16px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 8, fontSize: 13, color: '#60a5fa' }}
        >
          <span className="relative flex" style={{ width: 8, height: 8 }}>
            <span className="animate-ping absolute inline-flex rounded-full opacity-75" style={{ inset: 0, background: '#60a5fa' }} />
            <span className="relative inline-flex rounded-full" style={{ width: 8, height: 8, background: '#60a5fa' }} />
          </span>
          {newCount} new outbreak report{newCount !== 1 ? 's' : ''} detected
        </div>
      )}

      {/* Filter controls */}
      <div className="mb-6">
        <SearchFilter
          onFilterChange={setFilters}
          totalCount={outbreaks.length}
          filteredCount={filtered.length}
        />
      </div>

      {/* Outbreak grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.06)',
                height: 208,
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div style={{ fontSize: 36, marginBottom: 16 }}>🔍</div>
          <h3 style={{ color: '#a0a8c8', fontWeight: 600, marginBottom: 4 }}>No outbreaks found</h3>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
            Try adjusting your filters or search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((outbreak) => (
            <OutbreakCard key={outbreak.id} outbreak={outbreak} />
          ))}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="mt-6 flex items-center justify-center gap-2" style={{ fontSize: 11, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)' }}>
        <span className="relative flex" style={{ width: 6, height: 6 }}>
          <span className="animate-ping absolute inline-flex rounded-full opacity-50" style={{ inset: 0, background: '#6b7280' }} />
          <span className="relative inline-flex rounded-full" style={{ width: 6, height: 6, background: '#6b7280' }} />
        </span>
        Auto-refreshes every 30s{lastPoll ? ` · Last polled ${lastPoll.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
      </div>
    </div>
  );
}
