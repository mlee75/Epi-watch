import * as cheerio from 'cheerio';

/**
 * Official health alerts, fetched live from agency feeds and cached for
 * ALERTS_REVALIDATE seconds. Nothing is stored.
 *
 * Two kinds of source:
 *  - International and regional agencies with their own feeds or APIs
 *    (WHO Disease Outbreak News, ECDC, PAHO, WHO Africa, CDC travel notices,
 *    UKHSA).
 *  - National health authorities, most of which publish no usable feed. For
 *    those we search Google News restricted to the authority's own domain in
 *    its own language, and keep only results whose publisher URL is on that
 *    domain, so a newspaper quoting a ministry never counts as the ministry.
 *
 * Health-workforce items (deployments of response teams, health-worker
 * infections, strikes and shortages) are tagged from the title. A separate
 * media search adds workforce reporting and is labelled as media, not agency.
 */

export const ALERTS_REVALIDATE = 1800;
const TIMEOUT_MS = 12_000;
const MAX_AGE_DAYS = 60;
const NATIONAL_MAX_AGE_DAYS = 21;

export type AlertTier = 'international' | 'national' | 'media';

export interface Alert {
  id: string;
  title: string;
  /** English title when the original is in another language and translation ran. */
  titleEn: string | null;
  url: string;
  publisher: string;
  /** Country the alert is about (international) or issued by (national). */
  country: string | null;
  language: string;
  publishedAt: string | null;
  tier: AlertTier;
  kind: 'outbreak-notice' | 'travel-notice' | 'threat-report' | 'news';
  workforce: boolean;
}

export interface AlertSourceStatus {
  name: string;
  tier: AlertTier;
  ok: boolean;
  count: number;
}

export interface AlertsData {
  alerts: Alert[];
  sources: AlertSourceStatus[];
  translated: boolean;
  fetchedAt: string;
}

// ─── Relevance and tagging ───────────────────────────────────────────────────

// General agency newsrooms also publish budgets, appointments and research
// news; only items that read as disease or outbreak related are kept.
const RELEVANT = new RegExp(
  [
    'outbreak', 'epidemic', 'pandemic', 'cases?', 'deaths?', 'virus', 'infect', 'disease', 'vaccin', 'immunis', 'immuniz',
    'surveillance', 'alert', 'cholera', 'ebola', 'marburg', 'mpox', 'measles', 'dengue', 'malaria', 'influenza', 'avian',
    'h5n1', 'polio', 'yellow fever', 'chikungunya', 'zika', 'meningitis', 'diphtheria', 'pertussis', 'tuberculosis',
    'covid', 'sars', 'mers', 'rsv', 'hepatitis', 'plague', 'anthrax', 'lassa', 'nipah', 'oropouche', 'west nile', 'rabies',
    'antimicrobial', 'pathogen', 'hospital', 'health emergency', 'response team', 'health workers?',
  ].join('|'),
  'i'
);

const WORKFORCE = new RegExp(
  [
    // English
    'deploy', 'rapid response team', 'response teams?', 'emergency medical teams?', '\\bEMTs?\\b', 'GOARN',
    'health ?workers?', 'healthcare workers?', 'health personnel', 'medical staff', 'nurses?', 'doctors?', 'clinicians?',
    'staff shortage', 'workforce', 'strike', 'walkout', 'surge staff', 'experts to', 'medical teams?', 'field hospital',
    // Portuguese, Spanish, French
    'profissionais de saúde', 'trabalhadores da saúde', 'greve', 'personal sanitario', 'trabajadores de la salud',
    'brigadas?', 'huelga', 'soignants', 'personnel de santé', 'renforts?', 'grève',
  ].join('|'),
  'i'
);

// ─── Fetch helpers ───────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (compatible; EpiWatch/2.0; +https://epi-watch-three.vercel.app)';

export async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json' },
    next: { revalidate: ALERTS_REVALIDATE },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

export interface FeedItem {
  title: string;
  url: string;
  publishedAt: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
}

function toIso(s: string | undefined | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseFeed(xml: string): FeedItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: FeedItem[] = [];
  $('item').each((_, el) => {
    const it = $(el);
    items.push({
      title: it.find('title').first().text().trim(),
      url: (it.find('link').first().text() || it.find('guid').first().text()).trim(),
      publishedAt: toIso(it.find('pubDate').first().text().trim() || it.find('dc\\:date').first().text().trim()),
      sourceName: it.find('source').first().text().trim() || null,
      sourceUrl: it.find('source').first().attr('url') ?? null,
    });
  });
  $('entry').each((_, el) => {
    const it = $(el);
    items.push({
      title: it.find('title').first().text().trim(),
      url: (it.find('link[rel="alternate"]').attr('href') ?? it.find('link').first().attr('href') ?? '').trim(),
      publishedAt: toIso(it.find('published').first().text().trim() || it.find('updated').first().text().trim()),
      sourceName: null,
      sourceUrl: null,
    });
  });
  return items.filter((i) => i.title && i.url);
}

function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function makeAlert(a: Omit<Alert, 'id' | 'titleEn' | 'workforce'>): Alert {
  return { ...a, id: hashId(a.url), titleEn: null, workforce: WORKFORCE.test(a.title) };
}

// ─── International and regional agencies ────────────────────────────────────

interface FeedSource {
  name: string;
  url: string;
  kind: Alert['kind'];
  tier: AlertTier;
  filter: boolean; // apply the relevance filter
  country?: (title: string) => string | null;
}

// "Level 2 - Yellow Fever in Colombia" → Colombia
const travelCountry = (t: string) => t.match(/\bin (.+)$/)?.[1]?.trim() ?? null;

const FEEDS: FeedSource[] = [
  { name: 'ECDC', url: 'https://www.ecdc.europa.eu/en/taxonomy/term/1307/feed', kind: 'news', tier: 'international', filter: true },
  { name: 'ECDC threat report', url: 'https://www.ecdc.europa.eu/en/taxonomy/term/1505/feed', kind: 'threat-report', tier: 'international', filter: false },
  { name: 'CDC travel notices', url: 'https://wwwnc.cdc.gov/travel/rss/notices.xml', kind: 'travel-notice', tier: 'international', filter: false, country: travelCountry },
  { name: 'PAHO', url: 'https://www.paho.org/en/rss.xml', kind: 'news', tier: 'international', filter: true },
  { name: 'WHO Africa', url: 'https://www.afro.who.int/rss/featured-news.xml', kind: 'news', tier: 'international', filter: true },
  { name: 'WHO', url: 'https://www.who.int/rss-feeds/news-english.xml', kind: 'news', tier: 'international', filter: true },
  { name: 'UKHSA', url: 'https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=uk-health-security-agency', kind: 'news', tier: 'national', filter: true, country: () => 'United Kingdom' },
];

async function fetchFeed(src: FeedSource): Promise<Alert[]> {
  const items = parseFeed(await getText(src.url));
  return items
    .filter((i) => !isJunkTitle(i.title) && (!src.filter || RELEVANT.test(i.title)))
    .map((i) =>
      makeAlert({
        title: i.title,
        url: i.url,
        publisher: src.name === 'ECDC threat report' ? 'ECDC' : src.name.replace(/ travel notices$/, ''),
        country: src.country ? src.country(i.title) : null,
        language: 'en',
        publishedAt: i.publishedAt,
        tier: src.tier,
        kind: src.kind,
      })
    );
}

export async function fetchWhoDon(): Promise<Alert[]> {
  const params = new URLSearchParams({ $top: '30', $orderby: 'PublicationDateAndTime desc', $select: 'Title,UrlName,PublicationDateAndTime,OverrideTitle,UseOverrideTitle' });
  const json = JSON.parse(await getText(`https://www.who.int/api/news/diseaseoutbreaknews?${params}`)) as {
    value: Array<{ Title: string; OverrideTitle: string | null; UseOverrideTitle: boolean; UrlName: string; PublicationDateAndTime: string }>;
  };
  return json.value.map((d) => {
    const title = (d.UseOverrideTitle && d.OverrideTitle) || d.Title;
    // DON titles end in " - <Country>" (or a list of countries).
    const country = title.includes(' - ') ? title.split(' - ').pop()!.trim() : null;
    return makeAlert({
      title,
      url: `https://www.who.int/emergencies/disease-outbreak-news/item/${d.UrlName}`,
      publisher: 'WHO',
      country,
      language: 'en',
      publishedAt: toIso(d.PublicationDateAndTime),
      tier: 'international',
      kind: 'outbreak-notice',
    });
  });
}

// ─── National health authorities ────────────────────────────────────────────

export interface NationalSource {
  country: string;
  /** Natural Earth / ISO 3166 alpha-3 code, used by the country pages. */
  iso3: string;
  authority: string;
  /** Hostnames the publisher URL must end with. The first is used in the query. */
  domains: string[];
  lang: string; // ISO 639-1
  hl: string;
  gl: string;
  ceid: string;
}

// Disease and outbreak vocabulary per language, OR-ed into the search. Generic
// words such as "alert", "cases" or "surveillance" are left out: on a
// government domain they mostly return weather warnings and court statistics.
export const TERMS: Record<string, string> = {
  en: 'outbreak OR measles OR cholera OR dengue OR mpox OR influenza OR Ebola OR "infectious disease" OR epidemiological',
  pt: 'surto OR dengue OR sarampo OR chikungunya OR febre OR gripe OR "doença infecciosa" OR epidemiológica',
  es: 'brote OR dengue OR sarampión OR cólera OR influenza OR "enfermedad infecciosa" OR epidemiológica',
  fr: 'épidémie OR rougeole OR dengue OR choléra OR grippe OR "maladie infectieuse" OR épidémiologique',
  de: 'Ausbruch OR Masern OR Influenza OR Infektionskrankheit OR Epidemiologisches',
  it: 'focolaio OR morbillo OR dengue OR influenza OR "malattie infettive" OR arbovirosi',
  id: 'wabah OR KLB OR "demam berdarah" OR campak OR "penyakit menular"',
  vi: 'dịch OR "sốt xuất huyết" OR sởi OR cúm OR "truyền nhiễm"',
  ja: '感染症 OR インフルエンザ OR 麻しん OR 集団発生',
  ko: '감염병 OR 인플루엔자 OR 홍역 OR 유행',
  zh: '疫情 OR 传染病 OR 流感 OR 登革热',
  ar: 'تفشي OR وباء OR الحصبة OR الكوليرا OR الإنفلونزا',
  th: 'โรคระบาด OR ไข้เลือดออก OR หัด OR ไข้หวัดใหญ่ OR โรคติดต่อ',
  ms: 'wabak OR denggi OR campak OR influenza OR penyakit',
  fa: 'شیوع OR سرخک OR وبا OR آنفلوآنزا',
  he: 'התפרצות OR חצבת OR שפעת',
  tr: 'salgın OR kızamık OR grip OR kolera OR aşı',
  nl: 'uitbraak OR mazelen OR griep OR infectieziekte',
  sv: 'utbrott OR mässling OR influensa OR smitta',
  no: 'utbrudd OR meslinger OR influensa OR smitte',
  da: 'udbrud OR mæslinger OR influenza OR smitte',
  fi: 'epidemia OR tuhkarokko OR influenssa OR tartunta',
  pl: 'ognisko OR odra OR grypa OR zakażenie',
  el: 'κρούσματα OR ιλαρά OR γρίπη OR επιδημία',
  ro: 'focar OR rujeolă OR gripă OR epidemie',
  cs: 'ohnisko OR spalničky OR chřipka OR nákaza',
  hu: 'járvány OR kanyaró OR influenza OR fertőzés',
  uk: 'спалах OR кір OR грип OR епідемі',
  ru: 'вспышка OR корь OR грипп OR эпидеми OR инфекц',
  bn: 'প্রাদুর্ভাব OR ডেঙ্গু OR হাম OR সংক্রামক',
  'zh-Hant': '疫情 OR 傳染病 OR 流感 OR 登革熱 OR 病例',
};

// A title must name a disease or an outbreak-type event to be kept from a
// national source. Covers the languages in NATIONAL_SOURCES.
export const DISEASE = new RegExp(
  [
    // outbreak / epidemic words
    'outbreak', 'epidemi', 'épidémi', 'pandemi', 'surto', 'brote', 'focolai', 'ausbruch', 'infectious', 'infeccios',
    'infectieu', 'infettiv', 'infektions', 'arbovir', 'zoonos', 'notifiable', 'contagio',
    // diseases (Latin script)
    'dengue', 'measles', 'sarampi', 'sarampo', 'rougeole', 'masern', 'morbillo', 'campak', 'cholera', 'cólera', 'choléra',
    'colera', 'influenza', 'grippe', 'gripe', '\bflu\b', 'covid', 'coronavirus', 'sars-cov', 'mpox', 'monkeypox',
    'viruela', 'variole', 'ebola', 'ébola', 'marburg', 'malaria', 'paludisme', 'malária', 'chikungunya', 'zika',
    'yellow fever', 'fiebre amarilla', 'febre amarela', 'fièvre jaune', 'febbre gialla', 'pertussis', 'whooping',
    'tos ferina', 'coqueluche', 'pertosse', 'keuchhusten', 'diphther', 'difteri', 'diphtérie', 'polio', 'tubercul',
    'hepatit', 'meningit', 'méningite', 'meningococ', 'rabies', 'rabia', 'raiva', 'antirráb', 'tollwut', 'legionel',
    'legionnaire', 'leptospir', 'hantavir', 'west nile', 'nilo occidental', 'oropouche', 'avian', 'aviar', 'aviaire',
    'h5n1', 'bird flu', 'vogelgrippe', 'rsv', 'syncytial', 'sincicial', 'varicel', 'leishmani', 'plague', 'peste',
    'shigell', 'salmonel', 'listeri', 'e\. ?coli', 'botulis', 'anthrax', 'lassa', 'nipah', 'mers', 'typhoid', 'tifoidea',
    'scarlet fever', 'hand, foot', 'mouth disease', 'demam berdarah', '\bdbd\b', '\bklb\b', 'wabah', 'penyakit menular',
    // Vietnamese
    // (bare "dịch" also means "solution" and "service", so only compounds)
    'dịch bệnh', 'bệnh dịch', 'ổ dịch', 'chống dịch', 'dịch tả', 'dịch sốt', 'sốt xuất huyết', 'bệnh sởi', 'cúm a',
    'truyền nhiễm', 'tay chân miệng',
    // Japanese, Korean, Chinese
    '感染症', 'インフルエンザ', '麻しん', '麻疹', '集団発生', 'コロナ', 'デング', '감염병', '인플루엔자', '홍역', '코로나',
    '엠폭스', '유행', '疫情', '传染病', '病例', '流感', '登革热', '霍乱', '猴痘', '传染',
    // Arabic
    'تفشي', 'وباء', 'الحصبة', 'الكوليرا', 'الإنفلونزا', 'كورونا', 'حمى',
    // Thai, Malay, Persian, Hebrew, Turkish, Bengali, traditional Chinese
    'โรคระบาด', 'ไข้เลือดออก', 'หัด', 'ไข้หวัดใหญ่', 'โรคติดต่อ', 'wabak', 'denggi', 'شیوع', 'سرخک', 'وبا', 'آنفلوآنزا',
    'התפרצות', 'חצבת', 'שפעת', 'salgın', 'kızamık', 'kolera', '\\bgrip\\b', 'প্রাদুর্ভাব', 'ডেঙ্গু', 'হাম', 'সংক্রামক', '傳染病', '登革熱',
    // Dutch, Scandinavian, Finnish, Polish, Romanian, Czech, Hungarian
    'uitbraak', 'mazelen', 'griep', 'infectieziekte', 'utbrott', 'mässling', 'influensa', 'utbrudd', 'meslinger',
    'udbrud', 'mæslinger', 'tuhkarokko', 'influenssa', 'ognisko', 'odra', 'odry', 'grypa', 'grypy', 'zakażen', 'focar',
    'rujeol', 'gripă', 'gripa', 'spalničk', 'chřipk', 'nákaz', 'járvány', 'kanyaró',
    // Greek, Ukrainian, Russian
    'κρούσματα', 'ιλαρά', 'γρίπη', 'επιδημ', 'спалах', 'кір', 'грип', 'епідемі', 'вспышк', 'корь', 'грипп', 'эпидеми', 'инфекц',
  ].join('|'),
  'i'
);

/**
 * Search-result pages, attachments, signed product labels and job notices
 * rather than health notices.
 */
export function isJunkTitle(t: string): boolean {
  return (
    t.length < 16 ||
    /^page \d+$/i.test(t) ||
    /\.(xlsx?|docx?|pdf)$/i.test(t) ||
    /^(reports?|press release|actualidad|resources?)\b/i.test(t) ||
    /^(người ký|digitally signed|nhãn|công ty)/i.test(t) ||
    /\b(selection results?|selezione pubblica|assunzion|recruitment|vacanc(y|ies)|convocatoria|concurso|internship|^stage -|plt direktur|채용)/i.test(t) ||
    // Candidate lists, tenders, login and appointment pages on ministry sites.
    /(บัญชีรายชื่อ|ผู้ผ่านการคัดเลือก|รับสมัคร|ประกวดราคา|invitation for bid|\btender\b|\bappointments?\b|\blogin\b|dhis ?2)/i.test(t)
  );
}

export const NATIONAL_SOURCES: NationalSource[] = [
  { country: 'United States', iso3: 'USA', authority: 'CDC', domains: ['cdc.gov'], lang: 'en', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  { country: 'Canada', iso3: 'CAN', authority: 'Public Health Agency of Canada', domains: ['canada.ca'], lang: 'en', hl: 'en-CA', gl: 'CA', ceid: 'CA:en' },
  { country: 'Mexico', iso3: 'MEX', authority: 'Secretaría de Salud', domains: ['gob.mx'], lang: 'es', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { country: 'Brazil', iso3: 'BRA', authority: 'Ministério da Saúde', domains: ['gov.br'], lang: 'pt', hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' },
  { country: 'Argentina', iso3: 'ARG', authority: 'Ministerio de Salud', domains: ['argentina.gob.ar'], lang: 'es', hl: 'es-419', gl: 'AR', ceid: 'AR:es-419' },
  { country: 'Colombia', iso3: 'COL', authority: 'Ministerio de Salud / INS', domains: ['minsalud.gov.co', 'ins.gov.co'], lang: 'es', hl: 'es-419', gl: 'CO', ceid: 'CO:es-419' },
  { country: 'Peru', iso3: 'PER', authority: 'Ministerio de Salud', domains: ['gob.pe'], lang: 'es', hl: 'es-419', gl: 'PE', ceid: 'PE:es-419' },
  { country: 'Spain', iso3: 'ESP', authority: 'Ministerio de Sanidad', domains: ['sanidad.gob.es', 'isciii.es'], lang: 'es', hl: 'es', gl: 'ES', ceid: 'ES:es' },
  { country: 'France', iso3: 'FRA', authority: 'Santé publique France', domains: ['santepubliquefrance.fr', 'sante.gouv.fr'], lang: 'fr', hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  { country: 'Germany', iso3: 'DEU', authority: 'Robert Koch Institute', domains: ['rki.de'], lang: 'de', hl: 'de', gl: 'DE', ceid: 'DE:de' },
  { country: 'Italy', iso3: 'ITA', authority: 'Ministero della Salute / ISS', domains: ['salute.gov.it', 'iss.it'], lang: 'it', hl: 'it', gl: 'IT', ceid: 'IT:it' },
  { country: 'Nigeria', iso3: 'NGA', authority: 'NCDC', domains: ['ncdc.gov.ng'], lang: 'en', hl: 'en-NG', gl: 'NG', ceid: 'NG:en' },
  { country: 'Kenya', iso3: 'KEN', authority: 'Ministry of Health', domains: ['health.go.ke'], lang: 'en', hl: 'en-KE', gl: 'KE', ceid: 'KE:en' },
  { country: 'Uganda', iso3: 'UGA', authority: 'Ministry of Health', domains: ['health.go.ug'], lang: 'en', hl: 'en-UG', gl: 'UG', ceid: 'UG:en' },
  { country: 'South Africa', iso3: 'ZAF', authority: 'NICD', domains: ['nicd.ac.za', 'health.gov.za'], lang: 'en', hl: 'en-ZA', gl: 'ZA', ceid: 'ZA:en' },
  { country: 'India', iso3: 'IND', authority: 'Ministry of Health / PIB', domains: ['mohfw.gov.in', 'pib.gov.in'], lang: 'en', hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  { country: 'Pakistan', iso3: 'PAK', authority: 'National Institute of Health', domains: ['nih.org.pk'], lang: 'en', hl: 'en-PK', gl: 'PK', ceid: 'PK:en' },
  { country: 'Bangladesh', iso3: 'BGD', authority: 'DGHS / IEDCR', domains: ['dghs.gov.bd', 'iedcr.gov.bd'], lang: 'bn', hl: 'bn', gl: 'BD', ceid: 'BD:bn' },
  { country: 'Indonesia', iso3: 'IDN', authority: 'Kementerian Kesehatan', domains: ['kemkes.go.id'], lang: 'id', hl: 'id', gl: 'ID', ceid: 'ID:id' },
  { country: 'Philippines', iso3: 'PHL', authority: 'Department of Health', domains: ['doh.gov.ph'], lang: 'en', hl: 'en-PH', gl: 'PH', ceid: 'PH:en' },
  { country: 'Viet Nam', iso3: 'VNM', authority: 'Bộ Y tế', domains: ['moh.gov.vn'], lang: 'vi', hl: 'vi', gl: 'VN', ceid: 'VN:vi' },
  { country: 'Singapore', iso3: 'SGP', authority: 'MOH / CDA', domains: ['moh.gov.sg', 'cda.gov.sg'], lang: 'en', hl: 'en-SG', gl: 'SG', ceid: 'SG:en' },
  { country: 'Hong Kong SAR', iso3: 'HKG', authority: 'Centre for Health Protection', domains: ['chp.gov.hk', 'info.gov.hk'], lang: 'en', hl: 'en-HK', gl: 'HK', ceid: 'HK:en' },
  { country: 'China', iso3: 'CHN', authority: 'National Health Commission / China CDC', domains: ['nhc.gov.cn', 'chinacdc.cn'], lang: 'zh', hl: 'zh-CN', gl: 'CN', ceid: 'CN:zh-Hans' },
  { country: 'Japan', iso3: 'JPN', authority: 'MHLW / JIHS', domains: ['mhlw.go.jp', 'jihs.go.jp'], lang: 'ja', hl: 'ja', gl: 'JP', ceid: 'JP:ja' },
  { country: 'South Korea', iso3: 'KOR', authority: 'KDCA', domains: ['kdca.go.kr'], lang: 'ko', hl: 'ko', gl: 'KR', ceid: 'KR:ko' },
  { country: 'Australia', iso3: 'AUS', authority: 'Department of Health', domains: ['health.gov.au'], lang: 'en', hl: 'en-AU', gl: 'AU', ceid: 'AU:en' },
  { country: 'Saudi Arabia', iso3: 'SAU', authority: 'Ministry of Health', domains: ['moh.gov.sa'], lang: 'ar', hl: 'ar', gl: 'SA', ceid: 'SA:ar' },
  // Added after testing each domain against the search (results on the
  // authority's own domain within 120 days); see git history for the list
  // of candidates that returned nothing and were left out.
  { country: 'Ghana', iso3: 'GHA', authority: 'Ghana Health Service', domains: ['ghs.gov.gh', 'moh.gov.gh'], lang: 'en', hl: 'en', gl: 'GH', ceid: 'GH:en' },
  { country: 'Ethiopia', iso3: 'ETH', authority: 'Ministry of Health / EPHI', domains: ['moh.gov.et', 'ephi.gov.et'], lang: 'en', hl: 'en', gl: 'ET', ceid: 'ET:en' },
  { country: 'Tanzania', iso3: 'TZA', authority: 'Ministry of Health', domains: ['moh.go.tz'], lang: 'en', hl: 'en', gl: 'TZ', ceid: 'TZ:en' },
  { country: 'Rwanda', iso3: 'RWA', authority: 'Rwanda Biomedical Centre', domains: ['rbc.gov.rw', 'moh.gov.rw'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Zambia', iso3: 'ZMB', authority: 'Ministry of Health / ZNPHI', domains: ['moh.gov.zm', 'znphi.co.zm'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Malawi', iso3: 'MWI', authority: 'Ministry of Health', domains: ['health.gov.mw'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Mozambique', iso3: 'MOZ', authority: 'Ministério da Saúde', domains: ['misau.gov.mz'], lang: 'pt', hl: 'pt-150', gl: 'PT', ceid: 'PT:pt-150' },
  { country: 'Angola', iso3: 'AGO', authority: 'Ministério da Saúde', domains: ['minsa.gov.ao'], lang: 'pt', hl: 'pt-150', gl: 'PT', ceid: 'PT:pt-150' },
  { country: 'Democratic Republic of the Congo', iso3: 'COD', authority: 'Ministère de la Santé', domains: ['sante.gouv.cd'], lang: 'fr', hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  { country: 'Cameroon', iso3: 'CMR', authority: 'Ministère de la Santé publique', domains: ['minsante.cm'], lang: 'fr', hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  { country: 'Senegal', iso3: 'SEN', authority: 'Ministère de la Santé', domains: ['sante.gouv.sn'], lang: 'fr', hl: 'fr', gl: 'SN', ceid: 'SN:fr' },
  { country: 'Ivory Coast', iso3: 'CIV', authority: 'Ministère de la Santé', domains: ['sante.gouv.ci'], lang: 'fr', hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  { country: 'Mali', iso3: 'MLI', authority: 'Ministère de la Santé', domains: ['sante.gov.ml'], lang: 'fr', hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  { country: 'Guinea', iso3: 'GIN', authority: 'ANSS', domains: ['anss-guinee.org', 'sante.gov.gn'], lang: 'fr', hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  { country: 'Sierra Leone', iso3: 'SLE', authority: 'Ministry of Health / NPHA', domains: ['mohs.gov.sl', 'nphaa.gov.sl'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Liberia', iso3: 'LBR', authority: 'NPHIL / Ministry of Health', domains: ['nphil.gov.lr', 'moh.gov.lr'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Somalia', iso3: 'SOM', authority: 'Ministry of Health', domains: ['moh.gov.so'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Egypt', iso3: 'EGY', authority: 'Ministry of Health and Population', domains: ['mohp.gov.eg'], lang: 'ar', hl: 'ar', gl: 'EG', ceid: 'EG:ar' },
  { country: 'Morocco', iso3: 'MAR', authority: 'Ministère de la Santé', domains: ['sante.gov.ma'], lang: 'fr', hl: 'fr', gl: 'MA', ceid: 'MA:fr' },
  { country: 'Tunisia', iso3: 'TUN', authority: 'Ministère de la Santé', domains: ['santetunisie.rns.tn'], lang: 'fr', hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  { country: 'Thailand', iso3: 'THA', authority: 'Department of Disease Control', domains: ['ddc.moph.go.th', 'moph.go.th'], lang: 'th', hl: 'th', gl: 'TH', ceid: 'TH:th' },
  { country: 'Malaysia', iso3: 'MYS', authority: 'Ministry of Health', domains: ['moh.gov.my'], lang: 'ms', hl: 'en', gl: 'MY', ceid: 'MY:en' },
  { country: 'Nepal', iso3: 'NPL', authority: 'Ministry of Health / EDCD', domains: ['mohp.gov.np', 'edcd.gov.np'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Sri Lanka', iso3: 'LKA', authority: 'Ministry of Health / Epidemiology Unit', domains: ['health.gov.lk', 'epid.gov.lk'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Cambodia', iso3: 'KHM', authority: 'Ministry of Health / CDC', domains: ['moh.gov.kh', 'cdcmoh.gov.kh'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Taiwan', iso3: 'TWN', authority: 'Taiwan CDC', domains: ['cdc.gov.tw'], lang: 'zh-Hant', hl: 'zh-Hant', gl: 'TW', ceid: 'TW:zh-Hant' },
  { country: 'Afghanistan', iso3: 'AFG', authority: 'Ministry of Public Health', domains: ['moph.gov.af'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Iran', iso3: 'IRN', authority: 'Ministry of Health', domains: ['behdasht.gov.ir'], lang: 'fa', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Iraq', iso3: 'IRQ', authority: 'Ministry of Health', domains: ['moh.gov.iq'], lang: 'ar', hl: 'ar', gl: 'SA', ceid: 'SA:ar' },
  { country: 'Israel', iso3: 'ISR', authority: 'Ministry of Health', domains: ['health.gov.il'], lang: 'he', hl: 'he', gl: 'IL', ceid: 'IL:he' },
  { country: 'Turkey', iso3: 'TUR', authority: 'Ministry of Health', domains: ['saglik.gov.tr'], lang: 'tr', hl: 'tr', gl: 'TR', ceid: 'TR:tr' },
  { country: 'United Arab Emirates', iso3: 'ARE', authority: 'Ministry of Health and Prevention', domains: ['mohap.gov.ae'], lang: 'en', hl: 'ar', gl: 'AE', ceid: 'AE:ar' },
  { country: 'Qatar', iso3: 'QAT', authority: 'Ministry of Public Health', domains: ['moph.gov.qa'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Kuwait', iso3: 'KWT', authority: 'Ministry of Health', domains: ['moh.gov.kw'], lang: 'ar', hl: 'ar', gl: 'SA', ceid: 'SA:ar' },
  { country: 'Jordan', iso3: 'JOR', authority: 'Ministry of Health', domains: ['moh.gov.jo'], lang: 'ar', hl: 'ar', gl: 'SA', ceid: 'SA:ar' },
  { country: 'Lebanon', iso3: 'LBN', authority: 'Ministry of Public Health', domains: ['moph.gov.lb'], lang: 'ar', hl: 'ar', gl: 'LB', ceid: 'LB:ar' },
  { country: 'Oman', iso3: 'OMN', authority: 'Ministry of Health', domains: ['moh.gov.om'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Kazakhstan', iso3: 'KAZ', authority: 'Ministry of Health', domains: ['gov.kz'], lang: 'ru', hl: 'ru', gl: 'RU', ceid: 'RU:ru' },
  { country: 'Ireland', iso3: 'IRL', authority: 'HPSC / HSE', domains: ['hpsc.ie', 'hse.ie'], lang: 'en', hl: 'en', gl: 'IE', ceid: 'IE:en' },
  { country: 'Netherlands', iso3: 'NLD', authority: 'RIVM', domains: ['rivm.nl'], lang: 'nl', hl: 'nl', gl: 'NL', ceid: 'NL:nl' },
  { country: 'Belgium', iso3: 'BEL', authority: 'Sciensano', domains: ['sciensano.be'], lang: 'nl', hl: 'nl', gl: 'BE', ceid: 'BE:nl' },
  { country: 'Switzerland', iso3: 'CHE', authority: 'Federal Office of Public Health', domains: ['bag.admin.ch'], lang: 'de', hl: 'de', gl: 'CH', ceid: 'CH:de' },
  { country: 'Austria', iso3: 'AUT', authority: 'AGES / Ministry of Health', domains: ['ages.at', 'sozialministerium.at'], lang: 'de', hl: 'de', gl: 'AT', ceid: 'AT:de' },
  { country: 'Sweden', iso3: 'SWE', authority: 'Public Health Agency of Sweden', domains: ['folkhalsomyndigheten.se'], lang: 'sv', hl: 'sv', gl: 'SE', ceid: 'SE:sv' },
  { country: 'Norway', iso3: 'NOR', authority: 'Norwegian Institute of Public Health', domains: ['fhi.no'], lang: 'no', hl: 'no', gl: 'NO', ceid: 'NO:no' },
  { country: 'Denmark', iso3: 'DNK', authority: 'Statens Serum Institut', domains: ['ssi.dk', 'sst.dk'], lang: 'da', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Finland', iso3: 'FIN', authority: 'Finnish Institute for Health and Welfare', domains: ['thl.fi'], lang: 'fi', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Poland', iso3: 'POL', authority: 'Chief Sanitary Inspectorate / NIZP', domains: ['gis.gov.pl', 'pzh.gov.pl'], lang: 'pl', hl: 'pl', gl: 'PL', ceid: 'PL:pl' },
  { country: 'Portugal', iso3: 'PRT', authority: 'Direção-Geral da Saúde', domains: ['dgs.pt', 'sns.gov.pt'], lang: 'pt', hl: 'pt-150', gl: 'PT', ceid: 'PT:pt-150' },
  { country: 'Greece', iso3: 'GRC', authority: 'National Public Health Organization', domains: ['eody.gov.gr'], lang: 'el', hl: 'el', gl: 'GR', ceid: 'GR:el' },
  { country: 'Romania', iso3: 'ROU', authority: 'National Institute of Public Health', domains: ['insp.gov.ro', 'ms.ro'], lang: 'ro', hl: 'ro', gl: 'RO', ceid: 'RO:ro' },
  { country: 'Czechia', iso3: 'CZE', authority: 'National Institute of Public Health', domains: ['szu.cz'], lang: 'cs', hl: 'cs', gl: 'CZ', ceid: 'CZ:cs' },
  { country: 'Hungary', iso3: 'HUN', authority: 'National Center for Public Health', domains: ['nngyk.gov.hu', 'nnk.gov.hu'], lang: 'hu', hl: 'hu', gl: 'HU', ceid: 'HU:hu' },
  { country: 'Ukraine', iso3: 'UKR', authority: 'Public Health Center', domains: ['phc.org.ua', 'moz.gov.ua'], lang: 'uk', hl: 'uk', gl: 'UA', ceid: 'UA:uk' },
  { country: 'Russia', iso3: 'RUS', authority: 'Rospotrebnadzor', domains: ['rospotrebnadzor.ru'], lang: 'ru', hl: 'ru', gl: 'RU', ceid: 'RU:ru' },
  { country: 'Chile', iso3: 'CHL', authority: 'Ministerio de Salud', domains: ['minsal.cl'], lang: 'es', hl: 'es-419', gl: 'CL', ceid: 'CL:es-419' },
  { country: 'Ecuador', iso3: 'ECU', authority: 'Ministerio de Salud Pública', domains: ['salud.gob.ec'], lang: 'es', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { country: 'Bolivia', iso3: 'BOL', authority: 'Ministerio de Salud', domains: ['minsalud.gob.bo'], lang: 'es', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { country: 'Paraguay', iso3: 'PRY', authority: 'Ministerio de Salud Pública', domains: ['mspbs.gov.py'], lang: 'es', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { country: 'Cuba', iso3: 'CUB', authority: 'Ministerio de Salud Pública', domains: ['salud.msp.gob.cu', 'sld.cu'], lang: 'es', hl: 'es-419', gl: 'CU', ceid: 'CU:es-419' },
  { country: 'Dominican Republic', iso3: 'DOM', authority: 'Ministerio de Salud Pública', domains: ['msp.gob.do'], lang: 'es', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { country: 'Guatemala', iso3: 'GTM', authority: 'Ministerio de Salud Pública', domains: ['mspas.gob.gt'], lang: 'es', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { country: 'Honduras', iso3: 'HND', authority: 'Secretaría de Salud', domains: ['salud.gob.hn'], lang: 'es', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { country: 'El Salvador', iso3: 'SLV', authority: 'Ministerio de Salud', domains: ['salud.gob.sv'], lang: 'es', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { country: 'Costa Rica', iso3: 'CRI', authority: 'Ministerio de Salud', domains: ['ministeriodesalud.go.cr'], lang: 'es', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { country: 'Panama', iso3: 'PAN', authority: 'Ministerio de Salud', domains: ['minsa.gob.pa'], lang: 'es', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { country: 'Haiti', iso3: 'HTI', authority: 'MSPP', domains: ['mspp.gouv.ht'], lang: 'fr', hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  { country: 'Jamaica', iso3: 'JAM', authority: 'Ministry of Health and Wellness', domains: ['moh.gov.jm'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
  { country: 'Venezuela', iso3: 'VEN', authority: 'Ministerio del Poder Popular para la Salud', domains: ['mpps.gob.ve'], lang: 'es', hl: 'es-419', gl: 'VE', ceid: 'VE:es-419' },
  { country: 'New Zealand', iso3: 'NZL', authority: 'Ministry of Health / Health NZ', domains: ['health.govt.nz', 'tewhatuora.govt.nz'], lang: 'en', hl: 'en', gl: 'NZ', ceid: 'NZ:en' },
  { country: 'Fiji', iso3: 'FJI', authority: 'Ministry of Health', domains: ['health.gov.fj'], lang: 'en', hl: 'en', gl: 'US', ceid: 'US:en' },
];

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Google News appends " - Publisher" to titles.
export function stripPublisher(title: string, publisher: string | null): string {
  if (publisher && title.endsWith(` - ${publisher}`)) return title.slice(0, -(publisher.length + 3)).trim();
  return title;
}

export const onDomain = (host: string | null, domains: string[]) =>
  !!host && domains.some((d) => host === d || host.endsWith(`.${d}`));

async function fetchNational(src: NationalSource): Promise<Alert[]> {
  const sites = src.domains.map((d) => `site:${d}`).join(' OR ');
  const q = `(${sites}) (${TERMS[src.lang] ?? TERMS.en}) when:21d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${src.hl}&gl=${src.gl}&ceid=${src.ceid}`;
  const items = parseFeed(await getText(url));
  const cutoff = Date.now() - NATIONAL_MAX_AGE_DAYS * 86_400_000;
  return items
    .map((i) => ({ ...i, title: stripPublisher(i.title, i.sourceName) }))
    .filter((i) => i.publishedAt && new Date(i.publishedAt).getTime() >= cutoff)
    .filter((i) => onDomain(hostOf(i.sourceUrl), src.domains) && !isJunkTitle(i.title) && DISEASE.test(i.title))
    .slice(0, 12)
    .map((i) =>
      makeAlert({
        title: i.title,
        url: i.url,
        publisher: i.sourceName || src.authority,
        country: src.country,
        language: src.lang,
        publishedAt: i.publishedAt,
        tier: 'national',
        kind: 'news',
      })
    );
}

// ─── Workforce reporting (media) ─────────────────────────────────────────────

// Three searches: outbreak-linked workforce events, deployments of medical
// teams, and hospital staff strikes and shortages. Google does not always
// honour when:, so results are also age-capped (MEDIA_MAX_AGE_DAYS).
const WORKFORCE_QUERIES = [
  '("health workers" OR "healthcare workers" OR nurses OR doctors OR "response team") (outbreak OR epidemic OR Ebola OR cholera OR mpox OR measles) (deployed OR strike OR infected OR shortage OR killed OR attacked) when:14d',
  '("medical team" OR "medical teams" OR "health workers" OR doctors OR nurses OR epidemiologists) (deployed OR dispatched OR "sent to" OR arrive) (outbreak OR epidemic OR emergency OR disaster) when:14d',
  '(nurses OR doctors OR "junior doctors" OR "health workers" OR "hospital staff") (strike OR walkout OR "staff shortage" OR understaffed) hospital when:10d',
];
const MEDIA_MAX_AGE_DAYS = 21;

async function fetchWorkforceMedia(): Promise<Alert[]> {
  const cutoff = Date.now() - MEDIA_MAX_AGE_DAYS * 86_400_000;
  const lists = await Promise.all(
    WORKFORCE_QUERIES.map(async (q) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      return parseFeed(await getText(url)).slice(0, 25);
    })
  );
  return lists
    .flat()
    .map((i) => ({ ...i, title: stripPublisher(i.title, i.sourceName) }))
    // Google's matching is loose (it returns crime and weather stories for
    // these queries), so the title itself must name a workforce term.
    .filter((i) => i.publishedAt && new Date(i.publishedAt).getTime() >= cutoff && WORKFORCE.test(i.title))
    .map((i) => ({
      ...makeAlert({
        title: i.title,
        url: i.url,
        publisher: i.sourceName || 'News',
        country: null,
        language: 'en',
        publishedAt: i.publishedAt,
        tier: 'media' as const,
        kind: 'news' as const,
      }),
      workforce: true,
    }));
}

// ─── Translation (optional) ──────────────────────────────────────────────────

/**
 * Translates non-English titles to English in one batched model call. Runs
 * only when ANTHROPIC_API_KEY is set; otherwise titles stay in the original
 * language and the page says so.
 */
async function translateTitles(alerts: Alert[]): Promise<boolean> {
  const key = process.env.ANTHROPIC_API_KEY;
  const todo = alerts.filter((a) => a.language !== 'en').slice(0, 80);
  if (!key || todo.length === 0) return false;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content:
            'Translate each public-health headline to plain English. Keep names, numbers and disease terms exact. ' +
            'Reply with only a JSON array of strings, same order and length as the input.\n\n' +
            JSON.stringify(todo.map((a) => a.title)),
        },
      ],
    });
    const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
    const out = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) as unknown;
    if (!Array.isArray(out) || out.length !== todo.length) return false;
    todo.forEach((a, i) => {
      if (typeof out[i] === 'string' && out[i].trim()) {
        a.titleEn = out[i].trim();
        a.workforce ||= WORKFORCE.test(a.titleEn!);
      }
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

export async function fetchAlerts({ translate = true }: { translate?: boolean } = {}): Promise<AlertsData> {
  type Job = { name: string; tier: AlertTier; run: () => Promise<Alert[]> };
  const jobs: Job[] = [
    { name: 'WHO Disease Outbreak News', tier: 'international', run: fetchWhoDon },
    ...FEEDS.map((f) => ({ name: f.name, tier: f.tier, run: () => fetchFeed(f) })),
    ...NATIONAL_SOURCES.map((s) => ({ name: `${s.authority} (${s.country})`, tier: 'national' as const, run: () => fetchNational(s) })),
    { name: 'Health-workforce news search', tier: 'media', run: fetchWorkforceMedia },
  ];

  const results = await mapLimit(jobs, 8, async (j) => {
    try {
      return { j, alerts: await j.run(), ok: true };
    } catch {
      return { j, alerts: [] as Alert[], ok: false };
    }
  });

  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const seen = new Set<string>();
  const alerts: Alert[] = [];
  for (const r of results) {
    for (const a of r.alerts) {
      if (a.publishedAt && new Date(a.publishedAt).getTime() < cutoff) continue;
      const key = a.title.toLowerCase().replace(/\W+/g, ' ').trim();
      if (seen.has(a.url) || seen.has(key)) continue;
      seen.add(a.url);
      seen.add(key);
      alerts.push(a);
    }
  }
  alerts.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  const translated = translate ? await translateTitles(alerts) : false;

  return {
    alerts,
    sources: results.map((r) => ({ name: r.j.name, tier: r.j.tier, ok: r.ok, count: r.alerts.length })),
    translated,
    fetchedAt: new Date().toISOString(),
  };
}
