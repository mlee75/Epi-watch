'use client';

import { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, XCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';

const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

interface RiskBreakdown {
  diseaseRisk: number;
  healthcareRisk: number;
  infrastructureRisk: number;
  personalRisk: number;
  travelAdvisoryRisk: number;
}

interface RiskAssessment {
  destination: string;
  riskScore: number;
  riskLevel: string;
  breakdown: RiskBreakdown;
  activeOutbreaks: number;
  outbreaks: { disease: string; cases: number; deaths: number; severity: string }[];
  recommendations: string[];
  requiredVaccinations: string[];
  warnings: string[];
  countryData: {
    healthcareQualityIndex: number;
    hospitalBedsPerCapita: number;
    sanitationAccess: number;
    cleanWaterAccess: number;
    malariaRisk: string;
    dengueRisk: string;
    cdcTravelLevel: number;
    whoRiskLevel: string;
  };
  aiSummary: string | null;
}

const VACCINE_KEYS = [
  { key: 'yellowFever', label: 'Yellow Fever' },
  { key: 'hepatitisA', label: 'Hepatitis A' },
  { key: 'hepatitisB', label: 'Hepatitis B' },
  { key: 'typhoid', label: 'Typhoid' },
  { key: 'rabies', label: 'Rabies' },
  { key: 'measles', label: 'MMR (Measles)' },
  { key: 'polio', label: 'Polio' },
] as const;

const ACTIVITY_OPTIONS = [
  { value: 'urban', label: 'Urban / City' },
  { value: 'rural', label: 'Rural / Countryside' },
  { value: 'adventure', label: 'Adventure / Outdoor' },
  { value: 'business', label: 'Business' },
  { value: 'medical', label: 'Medical Tourism' },
] as const;

function getRiskColor(level: string) {
  switch (level) {
    case 'CRITICAL': return 'text-red-400';
    case 'HIGH':     return 'text-orange-400';
    case 'MODERATE': return 'text-yellow-400';
    case 'LOW':      return 'text-green-400';
    default:         return 'text-white';
  }
}

function getRiskBadge(level: string) {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500/20 text-red-400 border border-red-500/30';
    case 'HIGH':     return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    case 'MODERATE':
    case 'MEDIUM':   return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    case 'LOW':      return 'bg-green-500/20 text-green-400 border border-green-500/30';
    default:         return 'bg-white/10 text-white border border-white/20';
  }
}

function getRiskBarColor(level: string) {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500';
    case 'HIGH':     return 'bg-orange-500';
    case 'MODERATE': return 'bg-yellow-500';
    case 'LOW':      return 'bg-green-500';
    default:         return 'bg-white/30';
  }
}

export default function TravelRiskCalculator() {
  // ── Form state ──────────────────────────────────────────────────────
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [duration, setDuration] = useState('7');

  // Traveler profile
  const [age, setAge] = useState('35');
  const [hasChronicConditions, setHasChronicConditions] = useState(false);
  const [isPregnant, setIsPregnant] = useState(false);
  const [activities, setActivities] = useState<string[]>(['urban']);
  const [vaccinations, setVaccinations] = useState({
    yellowFever: false,
    hepatitisA: false,
    hepatitisB: false,
    typhoid: false,
    rabies: false,
    measles: true,
    polio: true,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleActivity = (act: string) => {
    setActivities((prev) =>
      prev.includes(act) ? prev.filter((a) => a !== act) : [...prev, act],
    );
  };

  const toggleVaccine = (key: string) => {
    setVaccinations((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const calculateRisk = async () => {
    if (!destination) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/travel/risk-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          origin: origin || 'United States',
          travelDate: travelDate || new Date().toISOString().split('T')[0],
          duration: parseInt(duration) || 7,
          travelerProfile: {
            age: parseInt(age) || 35,
            hasChronicConditions,
            isPregnant,
            vaccinationStatus: vaccinations,
            travelDuration: parseInt(duration) || 7,
            activities,
          },
        }),
      });

      if (!response.ok) throw new Error('Assessment failed');
      const data = await response.json();
      setRiskAssessment(data);
    } catch {
      setError('Unable to compute risk assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const breakdownItems = riskAssessment ? [
    { label: 'Disease Risk', score: riskAssessment.breakdown.diseaseRisk, max: 35 },
    { label: 'Healthcare', score: riskAssessment.breakdown.healthcareRisk, max: 25 },
    { label: 'Infrastructure', score: riskAssessment.breakdown.infrastructureRisk, max: 15 },
    { label: 'Personal Risk', score: riskAssessment.breakdown.personalRisk, max: 15 },
    { label: 'Travel Advisory', score: riskAssessment.breakdown.travelAdvisoryRisk, max: 10 },
  ] : [];

  return (
    <section id="travel-risk" className="px-4 sm:px-6 lg:px-12 py-12">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <span style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono), Space Mono, monospace',
            fontWeight: 700,
            color: '#60a5fa', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            Travel Intelligence
          </span>
          <h2 style={{
            fontSize: 28, fontWeight: 700, color: '#ffffff',
            marginTop: 8, letterSpacing: '0.02em',
            textShadow: '0 0 40px rgba(96,165,250,0.1)',
          }}>
            Travel Risk Assessment
          </h2>
          <p className="text-sm text-white/50 mt-3 max-w-lg mx-auto">
            Personalized health risk analysis based on live outbreak data, healthcare infrastructure, and your traveler profile
          </p>
        </div>

        {/* ── Input Form ────────────────────────────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 mb-8">

          {/* Basic fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                Traveling From
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g., United States"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm
                         placeholder-white/30 focus:outline-none focus:border-blue-500/60 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                Destination *
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Brazil"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm
                         placeholder-white/30 focus:outline-none focus:border-blue-500/60 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                Travel Date
              </label>
              <input
                type="date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm
                         focus:outline-none focus:border-blue-500/60 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                Duration (days)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="1"
                max="365"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm
                         focus:outline-none focus:border-blue-500/60 transition"
              />
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition mb-4 font-medium uppercase tracking-wider"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Traveler Profile {showAdvanced ? '(hide)' : '(customize for better accuracy)'}
          </button>

          {/* Advanced: Traveler Profile */}
          {showAdvanced && (
            <div className="border-t border-white/10 pt-5 mb-5 space-y-5">

              {/* Age + Conditions row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                    Age
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min="0"
                    max="120"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm
                             focus:outline-none focus:border-blue-500/60 transition"
                  />
                </div>
                <div className="flex items-center gap-3 pt-5 md:pt-0 md:self-end md:pb-1">
                  <label className="relative flex items-center cursor-pointer gap-3">
                    <input
                      type="checkbox"
                      checked={hasChronicConditions}
                      onChange={(e) => setHasChronicConditions(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/15 rounded-full peer peer-checked:bg-blue-500/60 transition-colors
                                  after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full
                                  after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
                    <span className="text-xs text-white/60">Chronic Conditions</span>
                  </label>
                </div>
                <div className="flex items-center gap-3 md:self-end md:pb-1">
                  <label className="relative flex items-center cursor-pointer gap-3">
                    <input
                      type="checkbox"
                      checked={isPregnant}
                      onChange={(e) => setIsPregnant(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/15 rounded-full peer peer-checked:bg-blue-500/60 transition-colors
                                  after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full
                                  after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
                    <span className="text-xs text-white/60">Pregnant</span>
                  </label>
                </div>
              </div>

              {/* Activities */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-3 uppercase tracking-wider">
                  Travel Activities
                </label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => toggleActivity(value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                        activities.includes(value)
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : 'bg-white/5 text-white/40 border-white/10 hover:text-white/60 hover:border-white/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vaccinations */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-3 uppercase tracking-wider">
                  Current Vaccinations
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {VACCINE_KEYS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleVaccine(key)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition border text-left ${
                        vaccinations[key as keyof typeof vaccinations]
                          ? 'bg-green-500/15 text-green-400 border-green-500/30'
                          : 'bg-white/5 text-white/35 border-white/10 hover:text-white/50 hover:border-white/20'
                      }`}
                    >
                      {vaccinations[key as keyof typeof vaccinations] ? '✓ ' : ''}{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={calculateRisk}
            disabled={!destination || loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600
                     hover:from-blue-500 hover:to-purple-500
                     disabled:from-gray-700 disabled:to-gray-800
                     text-white font-semibold py-3.5 rounded-xl
                     transition-all flex items-center justify-center gap-2
                     disabled:cursor-not-allowed text-sm"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Assess Travel Risk
              </>
            )}
          </button>

          {error && (
            <p className="text-red-400 text-sm mt-3 text-center">{error}</p>
          )}
        </div>

        {/* ── Results ────────────────────────────────────────────────────── */}
        {riskAssessment && (
          <div className="space-y-6 animate-in fade-in duration-500">

            {/* Warnings banner */}
            {riskAssessment.warnings.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">Warnings</h3>
                </div>
                <ul className="space-y-1.5">
                  {riskAssessment.warnings.map((w, i) => (
                    <li key={i} className="text-red-300/80 text-sm flex items-start gap-2">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">!</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Overall Score + Breakdown */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Overall Travel Risk</h3>
                  <p className="text-white/50 text-sm">{riskAssessment.destination}</p>
                </div>
                <div className="text-left sm:text-right">
                  <div className={`text-5xl font-bold mb-2 ${getRiskColor(riskAssessment.riskLevel)}`}>
                    {riskAssessment.riskScore}<span className="text-2xl text-white/30">/100</span>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getRiskBadge(riskAssessment.riskLevel)}`}>
                    {riskAssessment.riskLevel} Risk
                  </span>
                </div>
              </div>

              {/* Score breakdown bars */}
              <div className="border-t border-white/10 pt-5 space-y-3">
                <h4 className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-3">Risk Breakdown</h4>
                {breakdownItems.map(({ label, score, max }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-white/50 w-28 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${getRiskBarColor(
                          score / max > 0.7 ? 'CRITICAL' : score / max > 0.45 ? 'HIGH' : score / max > 0.2 ? 'MODERATE' : 'LOW'
                        )}`}
                        style={{ width: `${(score / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/40 w-12 text-right font-mono">{score}/{max}</span>
                  </div>
                ))}
              </div>

              {/* Country indicators */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/10">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Healthcare Quality</p>
                  <p className="text-lg font-bold text-white">{riskAssessment.countryData.healthcareQualityIndex}<span className="text-xs text-white/30">/100</span></p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">CDC Level</p>
                  <p className="text-lg font-bold text-white">Level {riskAssessment.countryData.cdcTravelLevel}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Malaria Risk</p>
                  <p className={`text-lg font-bold ${
                    riskAssessment.countryData.malariaRisk === 'HIGH' ? 'text-red-400' :
                    riskAssessment.countryData.malariaRisk === 'MODERATE' ? 'text-yellow-400' : 'text-green-400'
                  }`}>{riskAssessment.countryData.malariaRisk}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Dengue Risk</p>
                  <p className={`text-lg font-bold ${
                    riskAssessment.countryData.dengueRisk === 'HIGH' ? 'text-red-400' :
                    riskAssessment.countryData.dengueRisk === 'MODERATE' ? 'text-yellow-400' : 'text-green-400'
                  }`}>{riskAssessment.countryData.dengueRisk}</p>
                </div>
              </div>
            </div>

            {/* Active Outbreaks */}
            {riskAssessment.outbreaks.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
                <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Active Outbreaks ({riskAssessment.activeOutbreaks})
                </h3>
                <div className="space-y-3">
                  {riskAssessment.outbreaks.map((ob, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start justify-between">
                      <div>
                        <h4 className="text-white font-semibold text-sm mb-1">{ob.disease}</h4>
                        <p className="text-xs text-white/50">
                          {fmtNum(ob.cases)} cases &middot; {fmtNum(ob.deaths)} deaths
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getRiskBadge(ob.severity)}`}>
                        {ob.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vaccinations */}
            {riskAssessment.requiredVaccinations.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
                <h3 className="text-lg font-bold text-white mb-5">
                  Vaccination Requirements
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {riskAssessment.requiredVaccinations.map((vax, i) => {
                    const isRequired = vax.includes('REQUIRED');
                    const isRecommended = vax.includes('Recommended') || vax.includes('Highly');
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 rounded-lg p-3 ${
                          isRequired
                            ? 'bg-red-500/10 border border-red-500/20'
                            : isRecommended
                            ? 'bg-yellow-500/10 border border-yellow-500/20'
                            : 'bg-blue-500/10 border border-blue-500/20'
                        }`}
                      >
                        {isRequired ? (
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        ) : isRecommended ? (
                          <Info className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        )}
                        <p className="text-white font-medium text-sm">{vax}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {riskAssessment.recommendations.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
                <h3 className="text-lg font-bold text-white mb-5">
                  Personalized Recommendations
                </h3>
                <ul className="space-y-2.5">
                  {riskAssessment.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/70 text-sm leading-relaxed">
                      <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Summary */}
            {riskAssessment.aiSummary && (
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6 sm:p-8">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">AI</span> Travel Health Advisor
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {riskAssessment.aiSummary}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
