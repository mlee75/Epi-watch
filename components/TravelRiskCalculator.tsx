'use client';

import { useState } from 'react';
import { SeverityBadge } from '@/components/SeverityBadge';
import { fmtCount } from '@/lib/format';

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
    <section id="travel-risk" className="panel" style={{ marginTop: 20 }} aria-labelledby="travel-title">
      <div className="panel-header">
        <h2 id="travel-title" className="panel-title">Travel risk estimate</h2>
        <span className="panel-meta">Orientation only — not medical advice</span>
      </div>

      <div className="panel-body">
        <p className="muted" style={{ fontSize: 13, marginBottom: 16, maxWidth: 760 }}>
          Combines outbreak records for the destination with Epi-watch&rsquo;s static country
          estimates and the profile you enter. Inputs are used for this one calculation and
          are not stored.
        </p>

        <div className="trc-fields">
          <div>
            <label className="field-label" htmlFor="trc-origin">Travelling from</label>
            <input id="trc-origin" className="input" style={{ width: '100%' }} value={origin}
              onChange={(e) => setOrigin(e.target.value)} placeholder="United States" />
          </div>
          <div>
            <label className="field-label" htmlFor="trc-dest">Destination</label>
            <input id="trc-dest" className="input" style={{ width: '100%' }} value={destination}
              onChange={(e) => setDestination(e.target.value)} placeholder="Brazil" required />
          </div>
          <div>
            <label className="field-label" htmlFor="trc-date">Travel date</label>
            <input id="trc-date" type="date" className="input" style={{ width: '100%' }} value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="trc-days">Duration (days)</label>
            <input id="trc-days" type="number" min="1" max="365" className="input" style={{ width: '100%' }}
              value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>

        <button type="button" className="link trc-toggle" onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}>
          {showAdvanced ? 'Hide traveller profile' : 'Add traveller profile'}
        </button>

        {showAdvanced && (
          <div className="trc-profile">
            <div className="trc-fields" style={{ gridTemplateColumns: 'minmax(0,140px) auto auto', alignItems: 'end' }}>
              <div>
                <label className="field-label" htmlFor="trc-age">Age</label>
                <input id="trc-age" type="number" min="0" max="120" className="input" style={{ width: '100%' }}
                  value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <label className="trc-check">
                <input type="checkbox" checked={hasChronicConditions}
                  onChange={(e) => setHasChronicConditions(e.target.checked)} />
                Chronic condition
              </label>
              <label className="trc-check">
                <input type="checkbox" checked={isPregnant} onChange={(e) => setIsPregnant(e.target.checked)} />
                Pregnant
              </label>
            </div>

            <div>
              <span className="field-label">Activities</span>
              <div className="trc-chips">
                {ACTIVITY_OPTIONS.map(({ value, label }) => (
                  <button key={value} type="button" className="chip" aria-pressed={activities.includes(value)}
                    onClick={() => toggleActivity(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="field-label">Vaccinations already received</span>
              <div className="trc-chips">
                {VACCINE_KEYS.map(({ key, label }) => {
                  const on = vaccinations[key as keyof typeof vaccinations];
                  return (
                    <button key={key} type="button" className="chip" aria-pressed={on}
                      onClick={() => toggleVaccine(key)}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={calculateRisk} disabled={!destination || loading}>
            {loading ? 'Calculating…' : 'Calculate estimate'}
          </button>
          {error && <span style={{ fontSize: 13, color: '#f0a3ab' }}>{error}</span>}
        </div>
      </div>

      {riskAssessment && (
        <div className="trc-results">
          <div className="trc-score">
            <div className="kpi-label">Estimated risk · {riskAssessment.destination}</div>
            <div className="trc-score-row">
              <span className="kpi-value" style={{ fontSize: 34 }}>{riskAssessment.riskScore}</span>
              <span className="muted">/ 100</span>
              <SeverityBadge severity={riskAssessment.riskLevel} />
            </div>

            <table className="dt" style={{ marginTop: 14 }}>
              <thead>
                <tr><th>Component</th><th className="num">Score</th><th style={{ width: '40%' }} /></tr>
              </thead>
              <tbody>
                {breakdownItems.map(({ label, score, max }) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="num">{score} / {max}</td>
                    <td>
                      {/* Sub-scores are magnitudes, not severity levels, so they use
                          one neutral hue rather than the severity scale. */}
                      <div className="trc-bar"><span style={{ width: `${(score / max) * 100}%` }} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="trc-baseline">
              <div className="kpi-label" style={{ marginBottom: 6 }}>
                Country baseline — Epi-watch estimates, static, not issued by CDC or WHO
              </div>
              <dl>
                <div><dt>Healthcare index</dt><dd>{riskAssessment.countryData.healthcareQualityIndex} / 100</dd></div>
                <div><dt>Advisory tier</dt><dd>{riskAssessment.countryData.cdcTravelLevel} / 4</dd></div>
                <div><dt>Malaria</dt><dd>{riskAssessment.countryData.malariaRisk.toLowerCase()}</dd></div>
                <div><dt>Dengue</dt><dd>{riskAssessment.countryData.dengueRisk.toLowerCase()}</dd></div>
              </dl>
            </div>
          </div>

          <div className="trc-detail">
            {riskAssessment.warnings.length > 0 && (
              <div className="note" style={{ borderLeftColor: 'var(--sev-critical)' }}>
                <strong>Warnings</strong>
                <ul>{riskAssessment.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}

            {riskAssessment.outbreaks.length > 0 && (
              <div>
                <h3 className="trc-h">Records for this destination ({riskAssessment.activeOutbreaks})</h3>
                <table className="dt">
                  <thead>
                    <tr><th>Disease</th><th className="num">Cases</th><th className="num">Deaths</th><th>Severity</th></tr>
                  </thead>
                  <tbody>
                    {riskAssessment.outbreaks.map((ob, i) => (
                      <tr key={i}>
                        <td>{ob.disease}</td>
                        <td className="num">{fmtCount(ob.cases)}</td>
                        <td className="num">{fmtCount(ob.deaths)}</td>
                        <td><SeverityBadge severity={ob.severity} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {riskAssessment.requiredVaccinations.length > 0 && (
              <div>
                <h3 className="trc-h">Vaccinations to discuss with a clinician</h3>
                <ul className="trc-list">
                  {riskAssessment.requiredVaccinations.map((vax, i) => <li key={i}>{vax}</li>)}
                </ul>
              </div>
            )}

            {riskAssessment.recommendations.length > 0 && (
              <div>
                <h3 className="trc-h">General precautions</h3>
                <ul className="trc-list">
                  {riskAssessment.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                </ul>
              </div>
            )}

            {riskAssessment.aiSummary && (
              <div>
                <h3 className="trc-h">Model-generated summary</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{riskAssessment.aiSummary}</p>
              </div>
            )}

            <div className="note">
              <strong>Not medical advice.</strong> Outbreak records are live, but the country
              baseline is a static estimate and may be out of date. Suggestions are generic and
              take no account of your medical history. Consult a clinician or travel health
              clinic, and check the current{' '}
              <a className="link" href="https://wwwnc.cdc.gov/travel/notices" target="_blank" rel="noopener noreferrer">
                CDC travel health notices
              </a>{' '}and{' '}
              <a className="link" href="https://www.who.int/emergencies/disease-outbreak-news" target="_blank" rel="noopener noreferrer">
                WHO disease outbreak news
              </a>.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
