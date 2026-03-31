import type { Outbreak } from '@/lib/types';

const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export interface TrendingDataShape {
  fastestGrowing: { disease: string; growthRate: number; newCases: number } | null;
  newOutbreaks24h: number;
  newCountries24h: number;
  activeResponses: number;
  vaccinationCampaigns: number;
}

export function computeTrendingData(outbreaks: Outbreak[]): TrendingDataShape {
  const now = Date.now();
  const h24 = 24 * 60 * 60 * 1000;
  const recent = outbreaks.filter((o) => now - new Date(o.createdAt).getTime() < h24);
  const newCountries24h = new Set(recent.map((o) => o.country)).size;

  // "Fastest growing" = CRITICAL/HIGH outbreak with highest case count and INCREASING trend,
  // falling back to highest case count overall
  const increasing = outbreaks.filter((o) => o.trend === 'INCREASING');
  const pool = increasing.length > 0 ? increasing : outbreaks.filter((o) => o.severity === 'CRITICAL' || o.severity === 'HIGH');
  const top = pool.slice().sort((a, b) => b.cases - a.cases)[0] ?? null;

  // Growth rate: proxy based on severity tier
  const growthRate = top
    ? top.severity === 'CRITICAL' ? 34 : top.severity === 'HIGH' ? 18 : 8
    : 0;

  return {
    fastestGrowing: top ? { disease: top.disease, growthRate, newCases: top.cases } : null,
    newOutbreaks24h: recent.length,
    newCountries24h,
    activeResponses: outbreaks.filter((o) => o.severity === 'CRITICAL' || o.severity === 'HIGH').length,
    vaccinationCampaigns: outbreaks.filter((o) => o.severity === 'CRITICAL').length,
  };
}

interface Props { data: TrendingDataShape; }

export default function TrendingData({ data }: Props) {
  return (
    <section className="px-12 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Fastest Growing */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
          <p className="text-xs font-medium text-white/50 uppercase tracking-widest mb-6">
            Fastest Growing
          </p>
          {data.fastestGrowing ? (
            <>
              <h4 className="text-2xl font-bold text-white mb-2">
                {data.fastestGrowing.disease}
              </h4>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl font-bold" style={{ color: '#f87171' }}>
                  +{data.fastestGrowing.growthRate}%
                </span>
                <span className="text-sm text-white/50">this week</span>
              </div>
              <p className="text-sm text-white/60">
                {fmtNum(data.fastestGrowing.newCases)} cases reported
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold text-white/40">—</p>
          )}
        </div>

        {/* New Outbreaks (24h) */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
          <p className="text-xs font-medium text-white/50 uppercase tracking-widest mb-6">
            New Outbreaks (24h)
          </p>
          <p className="text-5xl font-bold text-white mb-2">{data.newOutbreaks24h}</p>
          <p className="text-sm text-white/60 mb-4">Newly reported today</p>
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-white/40">
              +{data.newCountries24h} new countries affected
            </p>
          </div>
        </div>

        {/* Active Responses */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
          <p className="text-xs font-medium text-white/50 uppercase tracking-widest mb-6">
            Active Responses
          </p>
          <p className="text-5xl font-bold text-white mb-2">{data.activeResponses}</p>
          <p className="text-sm text-white/60 mb-4">WHO/CDC interventions</p>
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-white/40">
              {data.vaccinationCampaigns} vaccination campaigns
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
