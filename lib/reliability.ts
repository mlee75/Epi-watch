const OFFICIAL_SOURCES = new Set([
  'WHO', 'CDC', 'ECDC', 'UNICEF', 'MSF', 'PAHO', 'ProMED',
]);

const MAJOR_NEWS_SOURCES = new Set([
  'Reuters', 'AP', 'AFP', 'BBC', 'Al Jazeera', 'New York Times',
  'Washington Post', 'Guardian', 'Le Monde',
]);

export function getSourceType(sourceName: string): string {
  const name = sourceName.toUpperCase();
  if (OFFICIAL_SOURCES.has(sourceName) || name.includes('WHO') || name.includes('CDC') || name.includes('ECDC')) {
    return 'official';
  }
  if (MAJOR_NEWS_SOURCES.has(sourceName) || name.includes('REUTERS') || name.includes('BBC')) {
    return 'major-news';
  }
  return 'news';
}

interface ReliabilityInput {
  sourceType: string;
  isVerified: boolean;
  language: string;
  publishedAt: Date;
}

export function calculateReliabilityScore(input: ReliabilityInput): number {
  let score = 3;

  if (input.sourceType === 'official')    score += 2;
  else if (input.sourceType === 'major-news') score += 1.5;
  else if (input.sourceType === 'academic')   score += 1.5;
  else if (input.sourceType === 'local-news') score += 0.5;

  if (input.isVerified) score += 0.5;

  if (input.language !== 'en' && !input.isVerified) score -= 0.5;

  const ageInDays = (Date.now() - input.publishedAt.getTime()) / 86_400_000;
  if (ageInDays > 7) score -= 0.5;

  return Math.max(1, Math.min(5, Math.round(score)));
}

export function formatReliability(score: number): string {
  return '★'.repeat(score) + '☆'.repeat(5 - score);
}
