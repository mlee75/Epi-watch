import type { Severity, ScrapedOutbreak } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Severity Classification
// ─────────────────────────────────────────────────────────────────────────────

export function classifySeverity(cases: number, deaths: number): Severity {
  if (cases > 10000 || deaths > 1000) return 'CRITICAL';
  if (cases > 1000 || deaths > 100) return 'HIGH';
  if (cases > 100 || deaths > 10) return 'MEDIUM';
  return 'LOW';
}

// ─────────────────────────────────────────────────────────────────────────────
// WHO Region Mapping
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRY_REGION_MAP: Record<string, string> = {
  // AFRO — African Region
  Angola: 'AFRO', Benin: 'AFRO', Botswana: 'AFRO', 'Burkina Faso': 'AFRO',
  Burundi: 'AFRO', 'Cabo Verde': 'AFRO', Cameroon: 'AFRO', 'Central African Republic': 'AFRO',
  Chad: 'AFRO', Comoros: 'AFRO', Congo: 'AFRO', 'Democratic Republic of Congo': 'AFRO',
  'Côte d\'Ivoire': 'AFRO', 'Equatorial Guinea': 'AFRO', Eritrea: 'AFRO', Eswatini: 'AFRO',
  Ethiopia: 'AFRO', Gabon: 'AFRO', Gambia: 'AFRO', Ghana: 'AFRO', Guinea: 'AFRO',
  'Guinea-Bissau': 'AFRO', Kenya: 'AFRO', Lesotho: 'AFRO', Liberia: 'AFRO',
  Madagascar: 'AFRO', Malawi: 'AFRO', Mali: 'AFRO', Mauritania: 'AFRO',
  Mauritius: 'AFRO', Mozambique: 'AFRO', Namibia: 'AFRO', Niger: 'AFRO',
  Nigeria: 'AFRO', Rwanda: 'AFRO', 'São Tomé and Príncipe': 'AFRO', Senegal: 'AFRO',
  Seychelles: 'AFRO', 'Sierra Leone': 'AFRO', Somalia: 'AFRO', 'South Africa': 'AFRO',
  'South Sudan': 'AFRO', Sudan: 'AFRO', Tanzania: 'AFRO', Togo: 'AFRO',
  Uganda: 'AFRO', Zambia: 'AFRO', Zimbabwe: 'AFRO',

  // AMRO — Americas
  'Antigua and Barbuda': 'AMRO', Argentina: 'AMRO', Bahamas: 'AMRO', Barbados: 'AMRO',
  Belize: 'AMRO', Bolivia: 'AMRO', Brazil: 'AMRO', Canada: 'AMRO', Chile: 'AMRO',
  Colombia: 'AMRO', 'Costa Rica': 'AMRO', Cuba: 'AMRO', Dominica: 'AMRO',
  'Dominican Republic': 'AMRO', Ecuador: 'AMRO', 'El Salvador': 'AMRO', Grenada: 'AMRO',
  Guatemala: 'AMRO', Guyana: 'AMRO', Haiti: 'AMRO', Honduras: 'AMRO', Jamaica: 'AMRO',
  Mexico: 'AMRO', Nicaragua: 'AMRO', Panama: 'AMRO', Paraguay: 'AMRO', Peru: 'AMRO',
  'Saint Kitts and Nevis': 'AMRO', 'Saint Lucia': 'AMRO', 'Saint Vincent and the Grenadines': 'AMRO',
  Suriname: 'AMRO', 'Trinidad and Tobago': 'AMRO', Uruguay: 'AMRO',
  'United States': 'AMRO', Venezuela: 'AMRO',

  // EMRO — Eastern Mediterranean
  Afghanistan: 'EMRO', Bahrain: 'EMRO', Djibouti: 'EMRO', Egypt: 'EMRO',
  Iran: 'EMRO', Iraq: 'EMRO', Jordan: 'EMRO', Kuwait: 'EMRO', Lebanon: 'EMRO',
  Libya: 'EMRO', Morocco: 'EMRO', Oman: 'EMRO', Pakistan: 'EMRO', Qatar: 'EMRO',
  'Saudi Arabia': 'EMRO', Somalia: 'EMRO', Sudan: 'EMRO', Syria: 'EMRO',
  Tunisia: 'EMRO', UAE: 'EMRO', 'United Arab Emirates': 'EMRO', Yemen: 'EMRO',

  // EURO — European Region
  Albania: 'EURO', Andorra: 'EURO', Armenia: 'EURO', Austria: 'EURO',
  Azerbaijan: 'EURO', Belarus: 'EURO', Belgium: 'EURO', 'Bosnia and Herzegovina': 'EURO',
  Bulgaria: 'EURO', Croatia: 'EURO', Cyprus: 'EURO', Czechia: 'EURO',
  Denmark: 'EURO', Estonia: 'EURO', Finland: 'EURO', France: 'EURO',
  Georgia: 'EURO', Germany: 'EURO', Greece: 'EURO', Hungary: 'EURO',
  Iceland: 'EURO', Ireland: 'EURO', Israel: 'EURO', Italy: 'EURO',
  Kazakhstan: 'EURO', Kyrgyzstan: 'EURO', Latvia: 'EURO', Liechtenstein: 'EURO',
  Lithuania: 'EURO', Luxembourg: 'EURO', Malta: 'EURO', Moldova: 'EURO',
  Monaco: 'EURO', Montenegro: 'EURO', Netherlands: 'EURO', 'North Macedonia': 'EURO',
  Norway: 'EURO', Poland: 'EURO', Portugal: 'EURO', Romania: 'EURO',
  Russia: 'EURO', 'San Marino': 'EURO', Serbia: 'EURO', Slovakia: 'EURO',
  Slovenia: 'EURO', Spain: 'EURO', Sweden: 'EURO', Switzerland: 'EURO',
  Tajikistan: 'EURO', Turkey: 'EURO', Turkmenistan: 'EURO', Ukraine: 'EURO',
  'United Kingdom': 'EURO', Uzbekistan: 'EURO',

  // SEARO — South-East Asia
  Bangladesh: 'SEARO', Bhutan: 'SEARO', 'DPR Korea': 'SEARO', India: 'SEARO',
  Indonesia: 'SEARO', Maldives: 'SEARO', Myanmar: 'SEARO', Nepal: 'SEARO',
  'Sri Lanka': 'SEARO', Thailand: 'SEARO', 'Timor-Leste': 'SEARO',

  // WPRO — Western Pacific
  Australia: 'WPRO', Brunei: 'WPRO', Cambodia: 'WPRO', China: 'WPRO',
  'Cook Islands': 'WPRO', Fiji: 'WPRO', Japan: 'WPRO', Kiribati: 'WPRO',
  'Lao PDR': 'WPRO', Malaysia: 'WPRO', 'Marshall Islands': 'WPRO', Micronesia: 'WPRO',
  Mongolia: 'WPRO', Nauru: 'WPRO', 'New Zealand': 'WPRO', Niue: 'WPRO',
  Palau: 'WPRO', 'Papua New Guinea': 'WPRO', Philippines: 'WPRO', Samoa: 'WPRO',
  Singapore: 'WPRO', 'Solomon Islands': 'WPRO', 'South Korea': 'WPRO',
  Tonga: 'WPRO', Tuvalu: 'WPRO', Vanuatu: 'WPRO', Vietnam: 'WPRO',
};

export function getRegionForCountry(country: string): string {
  return COUNTRY_REGION_MAP[country] ?? 'OTHER';
}

// ─────────────────────────────────────────────────────────────────────────────
// Trend Detection
// ─────────────────────────────────────────────────────────────────────────────

export function detectTrend(text: string): string {
  const lower = text.toLowerCase();
  const risingTerms = ['increas', 'rising', 'surge', 'spike', 'escalat', 'climb', 'rapid', 'doubl'];
  const fallingTerms = ['decreas', 'declin', 'fall', 'drop', 'slow', 'control', 'contain', 'reduc'];

  const risingScore = risingTerms.filter(t => lower.includes(t)).length;
  const fallingScore = fallingTerms.filter(t => lower.includes(t)).length;

  if (risingScore > fallingScore) return 'increasing';
  if (fallingScore > risingScore) return 'decreasing';
  return 'stable';
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Generation (rule-based, no AI key required)
// ─────────────────────────────────────────────────────────────────────────────

export function generateSummary(outbreak: ScrapedOutbreak): string {
  const { disease, country, cases, deaths, trend } = outbreak;

  const cfr = cases > 0 ? ((deaths / cases) * 100).toFixed(1) : '0';
  const trendPhrase =
    trend === 'increasing' ? 'Cases are increasing.' :
    trend === 'decreasing' ? 'Cases appear to be declining.' :
    'The situation remains active.';

  const severityWord =
    cases > 10000 || deaths > 1000 ? 'large-scale' :
    cases > 1000 || deaths > 100 ? 'significant' :
    cases > 100 || deaths > 10 ? 'moderate' : 'small-scale';

  return (
    `A ${severityWord} ${disease} outbreak has been reported in ${country}, ` +
    `with ${cases.toLocaleString()} confirmed cases and ${deaths.toLocaleString()} deaths ` +
    `(case fatality rate: ${cfr}%). ${trendPhrase} ` +
    `Health authorities and international partners are monitoring the situation closely.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication Key
// ─────────────────────────────────────────────────────────────────────────────

export function buildDedupeKey(disease: string, country: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${disease.toLowerCase().replace(/\s+/g, '-')}_${country.toLowerCase().replace(/\s+/g, '-')}_${dateStr}`;
}
