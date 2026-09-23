/**
 * Hospital intake data, fetched live from public surveillance systems.
 *
 * Nothing here is stored in the database: each source is fetched through
 * Next's data cache (HOSPITAL_REVALIDATE seconds), so pages show the latest
 * published figures without a cron job. The sources themselves publish
 * weekly or daily, with a reporting lag of one to three weeks, so "live"
 * means "as current as the publisher", not real time.
 *
 * Sources
 *  - WHO FluID: severe acute respiratory infection (SARI) cases at sentinel
 *    hospitals, weekly, ~90 countries. Sentinel coverage differs by country,
 *    so counts are comparable over time within a country, not between them.
 *  - CDC NHSN Hospital Respiratory Data: new COVID-19, influenza and RSV
 *    admissions and bed occupancy, weekly, US national and by state.
 *  - UKHSA data dashboard: England COVID-19 admissions (daily) and influenza
 *    and RSV admission rates (weekly, reported in season only).
 */

export const HOSPITAL_REVALIDATE = 3600;
const TIMEOUT_MS = 20_000;

export interface SourceStatus {
  ok: boolean;
  error?: string;
}

// ─── WHO FluID (SARI) ────────────────────────────────────────────────────────

export interface SariWeek {
  week: string; // ISO week start date, YYYY-MM-DD
  cases: number | null;
  inpatients: number | null;
  deaths: number | null;
}

export interface SariCountry {
  iso3: string;
  country: string;
  whoRegion: string;
  weeks: SariWeek[]; // ascending by week
  /** Newest week reported, which may still be incomplete. */
  latest: SariWeek;
  /** Newest settled week (at least SARI_SETTLE_DAYS old); change is computed on it. */
  reference: SariWeek | null;
  /** Reported weeks newer than the reference week. */
  provisionalWeeks: number;
  /** Mean of the four settled weeks before the reference week. */
  priorMean: number | null;
  /** Percent change of reference vs priorMean; null when counts are too small to compare. */
  change: number | null;
}

export interface SariData extends SourceStatus {
  countries: SariCountry[];
}

/** Below this 4-week mean a percent change is mostly noise, so none is shown. */
export const SARI_MIN_BASE = 10;

/**
 * Weeks younger than this are provisional. Sentinel sites keep reporting for
 * weeks afterwards: comparing the newest week produced drops of 50–100% in
 * about a fifth of countries (Brazil's newest week read 783 against a run of
 * about 3,000) that were reporting lag, not declines.
 */
export const SARI_SETTLE_DAYS = 21;

const WEEKS_BACK = 16;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

// FluID's country names include UN long forms; these read better in a table.
const SHORT_NAME: Record<string, string> = {
  BOL: 'Bolivia',
  IRN: 'Iran',
  LAO: 'Laos',
  MDA: 'Moldova',
  PRK: 'North Korea',
  KOR: 'South Korea',
  RUS: 'Russia',
  SYR: 'Syria',
  TZA: 'Tanzania',
  VEN: 'Venezuela',
  VNM: 'Viet Nam',
  XKX: 'Kosovo',
  HKG: 'Hong Kong SAR',
  GBR: 'United Kingdom',
  USA: 'United States',
};

function shortName(iso3: string, name: string): string {
  if (SHORT_NAME[iso3]) return SHORT_NAME[iso3];
  return name.replace(/\s*\(.*\)\s*$/, '').replace(/^China, /, '');
}

export async function fetchSari(): Promise<SariData> {
  const since = isoDaysAgo(WEEKS_BACK * 7);
  const params = new URLSearchParams({
    $filter: `ISO_WEEKSTARTDATE ge ${since} and AGEGROUP_CODE eq 'All'`,
    $select: 'COUNTRY_CODE,COUNTRY_AREA_TERRITORY,WHOREGION,ISO_WEEKSTARTDATE,SARI_CASE,SARI_INPATIENTS,SARI_DEATHS',
    $format: 'json',
  });
  try {
    const res = await fetch(`https://xmart-api-public.who.int/FLUMART/VIW_FID_EPI?${params}`, {
      next: { revalidate: HOSPITAL_REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS * 2),
    });
    if (!res.ok) throw new Error(`WHO FluID returned ${res.status}`);
    const json = (await res.json()) as {
      value: Array<{
        COUNTRY_CODE: string;
        COUNTRY_AREA_TERRITORY: string;
        WHOREGION: string;
        ISO_WEEKSTARTDATE: string;
        SARI_CASE: number | null;
        SARI_INPATIENTS: number | null;
        SARI_DEATHS: number | null;
      }>;
    };

    const byCountry = new Map<string, { name: string; region: string; weeks: Map<string, SariWeek> }>();
    for (const r of json.value) {
      if (r.SARI_CASE == null) continue;
      const week = r.ISO_WEEKSTARTDATE.slice(0, 10);
      let c = byCountry.get(r.COUNTRY_CODE);
      if (!c) {
        c = { name: r.COUNTRY_AREA_TERRITORY, region: r.WHOREGION, weeks: new Map() };
        byCountry.set(r.COUNTRY_CODE, c);
      }
      // A country can report more than one row per week (e.g. separate
      // sentinel systems); sum them so the week has one figure.
      const prev = c.weeks.get(week);
      const add = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0));
      c.weeks.set(week, prev
        ? { week, cases: add(prev.cases, r.SARI_CASE), inpatients: add(prev.inpatients, r.SARI_INPATIENTS), deaths: add(prev.deaths, r.SARI_DEATHS) }
        : { week, cases: r.SARI_CASE, inpatients: r.SARI_INPATIENTS, deaths: r.SARI_DEATHS });
    }

    const countries: SariCountry[] = [];
    const settleCutoff = isoDaysAgo(SARI_SETTLE_DAYS);
    for (const [iso3, c] of byCountry) {
      const weeks = [...c.weeks.values()].sort((a, b) => a.week.localeCompare(b.week));
      // A trailing 0 after weeks with cases is a placeholder row, not a count.
      const last = weeks[weeks.length - 1];
      const before = weeks.slice(-5, -1).map((w) => w.cases ?? 0);
      if (last.cases === 0 && before.length && before.reduce((a, b) => a + b, 0) / before.length >= 5) {
        weeks[weeks.length - 1] = { ...last, cases: null };
      }
      const reported = weeks.filter((w) => w.cases != null);
      if (reported.length === 0) continue;
      const latest = reported[reported.length - 1];
      const settled = reported.filter((w) => w.week <= settleCutoff);
      const reference = settled[settled.length - 1] ?? null;
      const prior = settled.slice(-5, -1).map((w) => w.cases ?? 0);
      const priorMean = reference && prior.length ? prior.reduce((sum, v) => sum + v, 0) / prior.length : null;
      const change =
        reference && priorMean != null && priorMean >= SARI_MIN_BASE && reference.cases != null
          ? ((reference.cases - priorMean) / priorMean) * 100
          : null;
      countries.push({
        iso3,
        country: shortName(iso3, c.name),
        whoRegion: c.region,
        weeks,
        latest,
        reference,
        provisionalWeeks: reference ? reported.filter((w) => w.week > reference.week).length : reported.length,
        priorMean,
        change,
      });
    }
    countries.sort((a, b) => a.country.localeCompare(b.country));
    return { ok: true, countries };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'WHO FluID unavailable', countries: [] };
  }
}

// ─── CDC NHSN (United States) ────────────────────────────────────────────────

export interface NhsnWeek {
  week: string; // week ending date
  covid: number | null;
  flu: number | null;
  rsv: number | null;
  bedOccPct: number | null;
  icuOccPct: number | null;
  reportingPct: number | null;
}

export interface NhsnJurisdiction {
  code: string; // "USA" or a two-letter state/territory code
  weeks: NhsnWeek[]; // ascending
}

export interface NhsnData extends SourceStatus {
  national: NhsnJurisdiction | null;
  states: NhsnJurisdiction[];
}

const num = (v: string | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function fetchNhsn(): Promise<NhsnData> {
  const since = isoDaysAgo(WEEKS_BACK * 7);
  const params = new URLSearchParams({
    $select: 'weekendingdate,jurisdiction,totalconfc19newadm,totalconfflunewadm,totalconfrsvnewadm,pctinptbedsocc,pcticubedsocc,totalconfc19newadmperchosprep',
    $where: `weekendingdate >= '${since}T00:00:00'`,
    $order: 'weekendingdate ASC',
    $limit: '5000',
  });
  try {
    const res = await fetch(`https://data.cdc.gov/resource/ua7e-t2fy.json?${params}`, {
      next: { revalidate: HOSPITAL_REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`CDC NHSN returned ${res.status}`);
    const rows = (await res.json()) as Record<string, string>[];

    const byCode = new Map<string, NhsnWeek[]>();
    for (const r of rows) {
      const code = r.jurisdiction;
      if (!code) continue;
      const list = byCode.get(code) ?? [];
      list.push({
        week: r.weekendingdate.slice(0, 10),
        covid: num(r.totalconfc19newadm),
        flu: num(r.totalconfflunewadm),
        rsv: num(r.totalconfrsvnewadm),
        bedOccPct: num(r.pctinptbedsocc),
        icuOccPct: num(r.pcticubedsocc),
        reportingPct: num(r.totalconfc19newadmperchosprep),
      });
      byCode.set(code, list);
    }
    // NHSN also publishes HHS-region aggregates (Region 1 … Region 10).
    const states = [...byCode.entries()]
      .filter(([code]) => code !== 'USA' && /^[A-Z]{2}$/.test(code))
      .map(([code, weeks]) => ({ code, weeks }))
      .sort((a, b) => a.code.localeCompare(b.code));
    const nat = byCode.get('USA');
    return { ok: true, national: nat ? { code: 'USA', weeks: nat } : null, states };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'CDC NHSN unavailable', national: null, states: [] };
  }
}

// ─── UKHSA (England) ─────────────────────────────────────────────────────────

export interface UkPoint {
  date: string;
  value: number;
}

export interface UkSeries {
  key: 'covid' | 'flu' | 'rsv';
  label: string;
  unit: string;
  cadence: string;
  points: UkPoint[]; // ascending
}

export interface UkData extends SourceStatus {
  series: UkSeries[];
}

const UKHSA_BASE = 'https://api.ukhsa-dashboard.data.gov.uk/themes/infectious_disease/sub_themes/respiratory/topics';

const UK_METRICS: Array<Omit<UkSeries, 'points'> & { path: string }> = [
  {
    key: 'covid',
    label: 'COVID-19 admissions',
    unit: 'patients admitted per day',
    cadence: 'Daily',
    path: 'COVID-19/geography_types/Nation/geographies/England/metrics/COVID-19_healthcare_admissionByDay',
  },
  {
    key: 'flu',
    label: 'Influenza admissions',
    unit: 'per 100,000 population per week',
    cadence: 'Weekly, in season',
    path: 'Influenza/geography_types/Nation/geographies/England/metrics/influenza_healthcare_hospitalAdmissionRateByWeek',
  },
  {
    key: 'rsv',
    label: 'RSV admissions',
    unit: 'per 100,000 population per week',
    cadence: 'Weekly, in season',
    path: 'RSV/geography_types/Nation/geographies/England/metrics/RSV_healthcare_admissionRateByWeek',
  },
];

async function fetchUkSeries(m: (typeof UK_METRICS)[number]): Promise<UkSeries> {
  const year = new Date().getUTCFullYear();
  const points: UkPoint[] = [];
  // Two calendar years so a series that stopped in spring still shows its
  // last season rather than an empty chart.
  for (const y of [year - 1, year]) {
    const res = await fetch(`${UKHSA_BASE}/${m.path}?year=${y}&age=all&page_size=365&format=json`, {
      next: { revalidate: HOSPITAL_REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`UKHSA returned ${res.status}`);
    const json = (await res.json()) as { results: Array<{ date: string; metric_value: number; stratum: string; sex: string }> };
    for (const r of json.results) {
      if (r.stratum === 'default' && r.sex === 'all' && r.metric_value != null) {
        points.push({ date: r.date, value: r.metric_value });
      }
    }
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  const { path: _path, ...meta } = m;
  return { ...meta, points };
}

export async function fetchUk(): Promise<UkData> {
  try {
    const series = await Promise.all(UK_METRICS.map(fetchUkSeries));
    return { ok: true, series };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UKHSA unavailable', series: [] };
  }
}
