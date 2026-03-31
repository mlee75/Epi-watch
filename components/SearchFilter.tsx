'use client';

import { useState, useTransition } from 'react';
import type { Severity } from '@/lib/types';

export interface FilterState {
  search: string;
  severity: Severity | 'ALL';
  region: string;
  sort: 'recent' | 'severity' | 'cases' | 'deaths';
}

interface SearchFilterProps {
  onFilterChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}

const SEVERITY_OPTIONS: { value: Severity | 'ALL'; label: string }[] = [
  { value: 'ALL',      label: 'All Severities' },
  { value: 'CRITICAL', label: '● Critical'      },
  { value: 'HIGH',     label: '● High'           },
  { value: 'MEDIUM',   label: '● Medium'         },
  { value: 'LOW',      label: '● Low'            },
];

const REGION_OPTIONS = [
  { value: 'ALL',   label: 'All Regions'              },
  { value: 'AFRO',  label: 'Africa (AFRO)'            },
  { value: 'AMRO',  label: 'Americas (AMRO)'          },
  { value: 'EMRO',  label: 'E. Mediterranean (EMRO)'  },
  { value: 'EURO',  label: 'Europe (EURO)'            },
  { value: 'SEARO', label: 'S-E Asia (SEARO)'         },
  { value: 'WPRO',  label: 'W. Pacific (WPRO)'        },
];

const SORT_OPTIONS = [
  { value: 'recent'   as const, label: 'Most Recent'      },
  { value: 'severity' as const, label: 'Highest Severity' },
  { value: 'cases'    as const, label: 'Most Cases'       },
  { value: 'deaths'   as const, label: 'Most Deaths'      },
];

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#ffffff',
  fontSize: 13,
  padding: '8px 12px',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

export function SearchFilter({ onFilterChange, totalCount, filteredCount }: SearchFilterProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '', severity: 'ALL', region: 'ALL', sort: 'severity',
  });
  const [, startTransition] = useTransition();

  const update = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    startTransition(() => onFilterChange(next));
  };

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: '#6b7280' }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Search disease, country…"
            style={{ ...inputStyle, paddingLeft: 36, width: '100%' }}
            onFocus={(e)  => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.5)'; }}
            onBlur={(e)   => { e.currentTarget.style.borderColor = '#1e2749'; }}
          />
        </div>

        {/* Severity */}
        <select
          value={filters.severity}
          onChange={(e) => update({ severity: e.target.value as Severity | 'ALL' })}
          style={{ ...inputStyle, cursor: 'pointer', minWidth: 160 }}
        >
          {SEVERITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Region */}
        <select
          value={filters.region}
          onChange={(e) => update({ region: e.target.value })}
          style={{ ...inputStyle, cursor: 'pointer', minWidth: 200 }}
        >
          {REGION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value as FilterState['sort'] })}
          style={{ ...inputStyle, cursor: 'pointer', minWidth: 160 }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Count */}
        <div
          className="ml-auto whitespace-nowrap"
          style={{ fontSize: 12, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)' }}
        >
          <span style={{ color: '#a0a8c8', fontWeight: 700 }}>{filteredCount}</span>
          {' '}of{' '}
          <span style={{ color: '#a0a8c8', fontWeight: 700 }}>{totalCount}</span>
          {' '}outbreaks
        </div>
      </div>
    </div>
  );
}
