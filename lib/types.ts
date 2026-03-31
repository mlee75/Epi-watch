export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type WHORegion = 'AFRO' | 'AMRO' | 'EMRO' | 'EURO' | 'SEARO' | 'WPRO' | 'OTHER';

export interface Outbreak {
  id: string;
  disease: string;
  pathogen?: string | null;
  country: string;
  region: string;
  subregion?: string | null;
  lat?: number | null;
  lng?: number | null;
  cases: number;
  deaths: number;
  recovered: number;
  severity: Severity;
  summary?: string | null;
  trend?: string | null;
  verified: boolean;
  language: string;
  titleOrig?: string | null;
  sourceUrl: string;
  sourceName: string;
  isActive: boolean;
  dedupeKey: string;
  reportDate: string; // ISO string
  createdAt: string;
  updatedAt: string;
}

export interface OutbreakStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalCases: number;
  totalDeaths: number;
  countriesAffected: number;
  regionsAffected: number;
  lastUpdated: string;
  topDisease?: { name: string; count: number; cases: number; deaths: number } | null;
  regionBreakdown?: Array<{ region: string; count: number }>;
}

export interface ScrapedOutbreak {
  disease: string;
  pathogen?: string;
  country: string;
  region?: string;
  subregion?: string;
  lat?: number;
  lng?: number;
  cases: number;
  deaths: number;
  recovered?: number;
  summary?: string;
  trend?: string;
  verified?: boolean;
  language?: string;
  titleOrig?: string;
  sourceUrl: string;
  sourceName: string;
  reportDate: Date;
}

export interface OutbreakSource {
  id: string;
  outbreakId: string;
  sourceName: string;
  sourceType: string;       // official | major-news | local-news | academic | news
  sourceLanguage: string;
  sourceCountry?: string | null;
  articleTitle: string;
  articleUrl: string;
  articleExcerpt?: string | null;
  publishedAt?: string | null;  // ISO string
  scrapedAt: string;
  reliabilityScore: number; // 1-5
  isVerified: boolean;
  verifiedBy?: string | null;
  originalText?: string | null;
  translatedText?: string | null;
  author?: string | null;
}

export interface CountryIntelligence {
  country: {
    name: string;
    threatLevel: string;
    threatScore: number;
    lastUpdated: string;
  };
  overview: {
    activeOutbreaks: number;
    totalCases: number;
    totalDeaths: number;
    affectedRegions: string[];
  };
  outbreaks: Array<Outbreak & { sources: OutbreakSource[]; totalSources: number }>;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface OutbreakFilters {
  severity?: Severity | 'ALL';
  region?: string;
  search?: string;
  sort?: 'recent' | 'severity' | 'cases' | 'deaths';
  limit?: number;
  offset?: number;
}
