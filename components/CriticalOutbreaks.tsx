'use client';

import type { Outbreak } from '@/lib/types';

const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

interface Props { outbreaks: Outbreak[]; }

export default function CriticalOutbreaks({ outbreaks }: Props) {
  return (
    <section className="px-12 pb-12">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-10">

        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-white">
            Critical Situations Requiring Attention
          </h3>
          <span className="text-sm text-white/50">
            {outbreaks.length} active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outbreaks.slice(0, 6).map((outbreak) => (
            <OutbreakCard key={outbreak.id} outbreak={outbreak} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OutbreakCard({ outbreak }: { outbreak: Outbreak }) {
  return (
    <div
      className="bg-white/5 border border-white/10 rounded-2xl p-6 transition-all cursor-pointer"
      style={{ transition: 'background 0.2s ease, border-color 0.2s ease' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)';
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-bold text-white mb-1">{outbreak.disease}</h4>
          <p className="text-sm text-white/60">{outbreak.country}</p>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-bold border"
          style={severityStyle(outbreak.severity)}
        >
          {outbreak.severity}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-white/40 mb-1">Cases</p>
          <p className="text-xl font-bold text-white">{fmtNum(outbreak.cases)}</p>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-1">Deaths</p>
          <p className="text-xl font-bold" style={{ color: 'rgba(239,68,68,0.9)' }}>
            {fmtNum(outbreak.deaths)}
          </p>
        </div>
      </div>

      {/* Region */}
      {outbreak.region && (
        <p className="text-xs text-white/50">{outbreak.region}</p>
      )}
    </div>
  );
}

function severityStyle(severity: string): React.CSSProperties {
  switch (severity) {
    case 'CRITICAL': return { background: 'rgba(239,68,68,0.15)',  color: '#f87171', borderColor: 'rgba(239,68,68,0.3)'  };
    case 'HIGH':     return { background: 'rgba(249,115,22,0.15)', color: '#fb923c', borderColor: 'rgba(249,115,22,0.3)' };
    case 'MEDIUM':   return { background: 'rgba(234,179,8,0.15)',  color: '#facc15', borderColor: 'rgba(234,179,8,0.3)'  };
    default:         return { background: 'rgba(34,197,94,0.15)',  color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)'  };
  }
}
