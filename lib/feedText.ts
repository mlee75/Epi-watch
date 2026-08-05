/**
 * Shared text extraction for anything ingested from a feed — RSS articles and
 * video metadata alike. Kept in one place so the disease and country
 * vocabularies cannot drift between ingestion paths.
 */

// The CDC "Outbreaks — US Based" feed is predominantly foodborne, so the
// foodborne block is load-bearing: without it every CDC item fell through to
// the "Infectious Disease" fallback.
export const DISEASES = [
  'Ebola', 'Marburg', 'Lassa', 'Dengue', 'Zika', 'Chikungunya',
  'Cholera', 'Typhoid', 'Malaria', 'Yellow Fever', 'Measles',
  'COVID-19', 'COVID', 'Mpox', 'Monkeypox', 'Plague', 'Anthrax',
  'Avian Influenza', 'Bird Flu', 'H5N1', 'Rabies', 'Polio',
  'Salmonella', 'Listeria', 'Cyclospora', 'Norovirus', 'Botulism',
  'Hepatitis A', 'Shigella', 'Campylobacter', 'Legionnaires', 'E. coli',
  'Diphtheria', 'Pertussis', 'Meningitis', 'Tuberculosis', 'Nipah',
  'Hantavirus', 'Rift Valley Fever', 'West Nile', 'MERS', 'Leishmaniasis',
] as const;

export const COUNTRIES = [
  'Afghanistan', 'Angola', 'Argentina', 'Australia', 'Bangladesh',
  'Brazil', 'Cameroon', 'Chad', 'China', 'Colombia', 'Congo', 'DRC',
  'Ecuador', 'Egypt', 'Ethiopia', 'France', 'Germany', 'Ghana',
  'Haiti', 'India', 'Indonesia', 'Iran', 'Iraq', 'Italy', 'Japan',
  'Kenya', 'Lebanon', 'Liberia', 'Libya', 'Madagascar', 'Mali',
  'Mexico', 'Mozambique', 'Myanmar', 'Nepal', 'Niger', 'Nigeria',
  'Pakistan', 'Peru', 'Philippines', 'Somalia', 'South Africa',
  'South Sudan', 'Spain', 'Sudan', 'Syria', 'Tanzania', 'Thailand',
  'Turkey', 'Uganda', 'Ukraine', 'United States', 'USA', 'Venezuela',
  'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
] as const;

export const UNKNOWN_DISEASE = 'Infectious Disease';
export const UNKNOWN_COUNTRY = 'Multiple Countries';

/**
 * Feeds embed markup and escaped entities in titles — CDC italicises pathogen
 * names ("<em>Salmonella</em> Outbreak Linked to Shell Eggs"). Titles are
 * rendered as plain text, so the markup has to come off before anything else
 * reads them.
 */
export function cleanTitle(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#8217;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Non-English names for diseases, keyed by the canonical English label that
 * gets stored. WHO and PAHO publish in Spanish, French and Arabic, so an
 * English-only vocabulary silently ignores much of what those sources report.
 * Only terms whose canonical form already exists in DISEASES are listed.
 */
export const DISEASE_ALIASES: Record<string, string[]> = {
  Measles: ['sarampión', 'sarampion', 'rougeole', 'الحصبة'],
  Cholera: ['cólera', 'colera', 'choléra', 'الكوليرا'],
  Dengue: ['dengue', 'الضنك'],
  Malaria: ['paludisme', 'الملاريا'],
  Ebola: ['ébola', 'الإيبولا'],
  Polio: ['poliomielitis', 'poliomyélite', 'شلل الأطفال'],
  Tuberculosis: ['tuberculose', 'السل'],
  Diphtheria: ['difteria', 'diphtérie', 'الدفتيريا'],
  'Yellow Fever': ['fiebre amarilla', 'fièvre jaune', 'الحمى الصفراء'],
  Mpox: ['viruela símica', 'variole simienne', 'جدري القردة'],
  Rabies: ['rabia', 'الكلب'],
  Zika: ['zika'],
  Chikungunya: ['chikungunya'],
  Pertussis: ['tos ferina', 'coqueluche', 'السعال الديكي'],
  Meningitis: ['meningitis', 'méningite', 'التهاب السحايا'],
};

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Unicode-aware word boundaries.
 *
 * JavaScript's \b is defined against [A-Za-z0-9_], which breaks in both
 * directions here: it misfires across non-Latin scripts, and it fails outright
 * on accented terms — `\bépidémie` never matches a string starting "Épidémie",
 * because "É" is not a \w character so no boundary exists before it.
 *
 * Lookarounds against \p{L}\p{N} under the 'u' flag give a boundary that holds
 * for every script the feeds actually publish in.
 *
 * `prefix` mode drops the trailing boundary so a stem matches its inflections
 * ("epidemiolog" → "epidemiological"); the leading boundary is always kept,
 * since that is what stops "MERS" matching inside "consumers".
 */
export function termMatcher(term: string, mode: 'word' | 'prefix' = 'word'): RegExp {
  const escaped = escapeRegex(term);
  const trailing = mode === 'word' ? '(?![\\p{L}\\p{N}])' : '';
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}${trailing}`, 'iu');
}

/**
 * Whole-word matching, not substring.
 *
 * Bare `includes()` produced false positives that read as real data: "MERS"
 * matches inside "consumers" and "farmers", which tagged a conference preview
 * as a MERS report. Short acronyms in the vocabulary (MERS, DRC, USA) make
 * this failure mode routine rather than rare.
 *
 * \b is used on both ends, with the term escaped so entries containing regex
 * metacharacters ("E. coli") are matched literally.
 */
function buildMatchers<T extends readonly string[]>(terms: T): Array<[T[number], RegExp]> {
  return terms.map((term) => [term, termMatcher(term)]);
}

const COUNTRY_MATCHERS = buildMatchers(COUNTRIES);

// English names first so an English title in a multilingual feed still yields
// the canonical label by the most direct route.
const DISEASE_MATCHERS: Array<[string, RegExp]> = [
  ...DISEASES.map((d) => [d, termMatcher(d)] as [string, RegExp]),
  ...Object.entries(DISEASE_ALIASES).flatMap(([canonical, aliases]) =>
    aliases.map((alias) => [canonical, termMatcher(alias)] as [string, RegExp])
  ),
];

export function extractDisease(text: string): string {
  for (const [disease, pattern] of DISEASE_MATCHERS) {
    if (pattern.test(text)) return disease;
  }
  return UNKNOWN_DISEASE;
}

export function extractCountry(text: string): string {
  for (const [country, pattern] of COUNTRY_MATCHERS) {
    if (pattern.test(text)) return country;
  }
  return UNKNOWN_COUNTRY;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Feed timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Deliberately matched against the headline only. Article bodies mention many
// incidental figures ("73 new cases this week", "31% fatality rate"), and
// scanning them reliably picks the wrong one — a plausible but false total is
// worse here than no total at all. In a headline the number sitting next to
// "cases"/"deaths" is the figure the story is actually about.
const COUNT = String.raw`(\d[\d,]*)`;
// Repeated as whitespace-separated words so multi-word lead-ins like
// "rise to" / "climb past" are matched, not just single connectives.
const LEAD = String.raw`(?:\s*(?:rise|rises|risen|climb|climbs|climbed|reach|reaches|reached|pass|passes|passed|past|surpass|surpasses|hit|hits|top|tops|topped|now|stand|stands|at|to|:)){1,3}`;

export const CASE_PATTERNS = [
  new RegExp(String.raw`${COUNT}\s+(?:confirmed|suspected|probable|reported|new|total)?\s*(?:cases|infections)`, 'i'),
  new RegExp(String.raw`(?:cases|infections)\s*${LEAD}\s*${COUNT}`, 'i'),
];

export const DEATH_PATTERNS = [
  new RegExp(String.raw`${COUNT}\s+(?:confirmed|reported|new|total)?\s*(?:deaths|fatalities|dead)`, 'i'),
  new RegExp(String.raw`(?:deaths|fatalities)\s*${LEAD}\s*${COUNT}`, 'i'),
];

export function extractCount(text: string, patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const value = parseInt(match[1].replace(/,/g, ''), 10);
    // Guard against a stray year or ID being read as a count.
    if (Number.isFinite(value) && value >= 0 && value < 100_000_000) {
      return value;
    }
  }
  return 0;
}
