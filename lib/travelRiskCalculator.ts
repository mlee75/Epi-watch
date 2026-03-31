// ─── Travel Risk Calculator Engine ──────────────────────────────────────────
// Comprehensive scoring system: disease burden, healthcare quality,
// infrastructure, personal risk factors, and travel advisories.

export interface CountryHealthData {
  countryCode: string;
  countryName: string;

  // Disease burden
  activeOutbreaks: number;
  criticalOutbreaks: number;
  highRiskOutbreaks: number;
  totalCases: number;
  totalDeaths: number;
  caseFatalityRate: number;

  // Healthcare system
  hospitalBedsPerCapita: number;
  doctorsPerCapita: number;
  healthcareQualityIndex: number; // 0-100
  vaccineCoverage: number; // percentage

  // Infrastructure
  sanitationAccess: number; // percentage
  cleanWaterAccess: number; // percentage
  airQualityIndex: number; // 0-500 (lower is better)

  // Endemic diseases
  malariaRisk: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
  dengueRisk: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
  yellowFeverRequired: boolean;

  // Recent trends
  casesLast7Days: number;
  casesLast30Days: number;
  deathsLast7Days: number;

  // Travel advisories
  cdcTravelLevel: 1 | 2 | 3 | 4;
  whoRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
}

export interface TravelerProfile {
  age: number;
  hasChronicConditions: boolean;
  isPregnant: boolean;
  vaccinationStatus: {
    yellowFever: boolean;
    hepatitisA: boolean;
    hepatitisB: boolean;
    typhoid: boolean;
    rabies: boolean;
    measles: boolean;
    polio: boolean;
  };
  travelDuration: number; // days
  activities: ('urban' | 'rural' | 'adventure' | 'business' | 'medical')[];
}

export interface TravelRiskResult {
  totalScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  breakdown: {
    diseaseRisk: number;
    healthcareRisk: number;
    infrastructureRisk: number;
    personalRisk: number;
    travelAdvisoryRisk: number;
  };
  recommendations: string[];
  requiredVaccinations: string[];
  warnings: string[];
}

export function calculateTravelRiskScore(
  countryData: CountryHealthData,
  travelerProfile: TravelerProfile,
): TravelRiskResult {
  const diseaseRisk = calculateDiseaseRisk(countryData, travelerProfile);
  const healthcareRisk = calculateHealthcareRisk(countryData);
  const infrastructureRisk = calculateInfrastructureRisk(countryData);
  const personalRisk = calculatePersonalRisk(travelerProfile, countryData);
  const travelAdvisoryRisk = calculateTravelAdvisoryRisk(countryData);

  const totalScore =
    diseaseRisk + healthcareRisk + infrastructureRisk + personalRisk + travelAdvisoryRisk;

  const riskLevel = getRiskLevel(totalScore);
  const recommendations = generateRecommendations(countryData, travelerProfile, totalScore);
  const requiredVaccinations = getRequiredVaccinations(countryData, travelerProfile);
  const warnings = generateWarnings(countryData, travelerProfile, totalScore);

  return {
    totalScore,
    riskLevel,
    breakdown: { diseaseRisk, healthcareRisk, infrastructureRisk, personalRisk, travelAdvisoryRisk },
    recommendations,
    requiredVaccinations,
    warnings,
  };
}

// ─── 1. DISEASE RISK (0-35) ─────────────────────────────────────────────────

function calculateDiseaseRisk(country: CountryHealthData, traveler: TravelerProfile): number {
  let score = 0;

  // Active outbreaks severity (0-15)
  score += country.criticalOutbreaks * 5;
  score += country.highRiskOutbreaks * 2;
  score += Math.min(country.activeOutbreaks * 0.5, 5);

  // Case fatality rate (0-10)
  if (country.caseFatalityRate > 0.1) score += 10;
  else if (country.caseFatalityRate > 0.05) score += 7;
  else if (country.caseFatalityRate > 0.02) score += 4;
  else if (country.caseFatalityRate > 0.01) score += 2;

  // Recent trend (0-5)
  const weeklyAvg = country.casesLast30Days / 4;
  const weeklyGrowth = weeklyAvg > 0 ? country.casesLast7Days / weeklyAvg : 0;
  if (weeklyGrowth > 2) score += 5;
  else if (weeklyGrowth > 1.5) score += 3;
  else if (weeklyGrowth > 1.2) score += 1;

  // Endemic disease risks (0-5)
  if (country.malariaRisk === 'HIGH') score += 3;
  else if (country.malariaRisk === 'MODERATE') score += 2;
  if (country.dengueRisk === 'HIGH') score += 2;
  else if (country.dengueRisk === 'MODERATE') score += 1;

  // Activity-based adjustment
  if (traveler.activities.includes('rural')) score += 2;
  if (traveler.activities.includes('adventure')) score += 1;

  return Math.min(score, 35);
}

// ─── 2. HEALTHCARE QUALITY RISK (0-25) ──────────────────────────────────────

function calculateHealthcareRisk(country: CountryHealthData): number {
  let score = 0;

  // Quality index (0-10)
  if (country.healthcareQualityIndex < 30) score += 10;
  else if (country.healthcareQualityIndex < 50) score += 7;
  else if (country.healthcareQualityIndex < 70) score += 4;
  else if (country.healthcareQualityIndex < 85) score += 2;

  // Hospital capacity (0-8)
  if (country.hospitalBedsPerCapita < 1) score += 8;
  else if (country.hospitalBedsPerCapita < 2) score += 5;
  else if (country.hospitalBedsPerCapita < 3) score += 3;
  else if (country.hospitalBedsPerCapita < 5) score += 1;

  // Doctor availability (0-7)
  if (country.doctorsPerCapita < 0.5) score += 7;
  else if (country.doctorsPerCapita < 1) score += 5;
  else if (country.doctorsPerCapita < 2) score += 3;
  else if (country.doctorsPerCapita < 3) score += 1;

  return Math.min(score, 25);
}

// ─── 3. INFRASTRUCTURE RISK (0-15) ──────────────────────────────────────────

function calculateInfrastructureRisk(country: CountryHealthData): number {
  let score = 0;

  // Sanitation (0-6)
  if (country.sanitationAccess < 50) score += 6;
  else if (country.sanitationAccess < 70) score += 4;
  else if (country.sanitationAccess < 85) score += 2;
  else if (country.sanitationAccess < 95) score += 1;

  // Clean water (0-6)
  if (country.cleanWaterAccess < 60) score += 6;
  else if (country.cleanWaterAccess < 75) score += 4;
  else if (country.cleanWaterAccess < 90) score += 2;
  else if (country.cleanWaterAccess < 98) score += 1;

  // Air quality (0-3)
  if (country.airQualityIndex > 200) score += 3;
  else if (country.airQualityIndex > 150) score += 2;
  else if (country.airQualityIndex > 100) score += 1;

  return Math.min(score, 15);
}

// ─── 4. PERSONAL RISK FACTORS (0-15) ────────────────────────────────────────

function calculatePersonalRisk(traveler: TravelerProfile, country: CountryHealthData): number {
  let score = 0;

  // Age risk (0-5)
  if (traveler.age < 2) score += 5;
  else if (traveler.age < 5) score += 4;
  else if (traveler.age > 70) score += 5;
  else if (traveler.age > 60) score += 3;
  else if (traveler.age > 50) score += 2;

  // Chronic conditions (0-5)
  if (traveler.hasChronicConditions) score += 5;

  // Pregnancy (0-5, plus extra for dengue areas)
  if (traveler.isPregnant) {
    score += 5;
    if (country.dengueRisk === 'HIGH' || country.dengueRisk === 'MODERATE') score += 3;
  }

  // Vaccination gaps (0-5)
  let missingVaccines = 0;
  if (country.yellowFeverRequired && !traveler.vaccinationStatus.yellowFever) missingVaccines += 2;
  if (!traveler.vaccinationStatus.hepatitisA) missingVaccines += 1;
  if (!traveler.vaccinationStatus.typhoid) missingVaccines += 1;
  if (!traveler.vaccinationStatus.measles) missingVaccines += 1;
  score += Math.min(missingVaccines, 5);

  // Duration adjustment
  if (traveler.travelDuration > 30) score += 2;
  else if (traveler.travelDuration > 14) score += 1;

  return Math.min(score, 15);
}

// ─── 5. TRAVEL ADVISORY RISK (0-10) ─────────────────────────────────────────

function calculateTravelAdvisoryRisk(country: CountryHealthData): number {
  let score = 0;

  switch (country.cdcTravelLevel) {
    case 4: score += 6; break;
    case 3: score += 4; break;
    case 2: score += 2; break;
  }

  switch (country.whoRiskLevel) {
    case 'VERY_HIGH': score += 4; break;
    case 'HIGH': score += 3; break;
    case 'MODERATE': score += 1; break;
  }

  return Math.min(score, 10);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRiskLevel(score: number): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  if (score >= 70) return 'CRITICAL';
  if (score >= 45) return 'HIGH';
  if (score >= 20) return 'MODERATE';
  return 'LOW';
}

function generateRecommendations(
  country: CountryHealthData,
  traveler: TravelerProfile,
  score: number,
): string[] {
  const recs: string[] = [];

  if (score >= 70) {
    recs.push('URGENT: Consider postponing travel if possible');
    recs.push('Purchase comprehensive medical evacuation insurance');
  }

  if (country.criticalOutbreaks > 0) {
    recs.push(`Avoid areas with active ${country.criticalOutbreaks} critical outbreak(s)`);
  }

  if (country.healthcareQualityIndex < 50) {
    recs.push('Identify nearest quality medical facilities before arrival');
    recs.push('Carry emergency medical kit and medications');
  }

  if (country.sanitationAccess < 70 || country.cleanWaterAccess < 70) {
    recs.push('Drink only bottled or purified water');
    recs.push('Avoid raw/undercooked food and street vendors');
  }

  if (country.malariaRisk === 'HIGH' || country.malariaRisk === 'MODERATE') {
    recs.push('Take antimalarial prophylaxis (consult doctor)');
    recs.push('Use insect repellent (DEET 30%+) and sleep under mosquito nets');
  }

  if (country.dengueRisk === 'HIGH' || country.dengueRisk === 'MODERATE') {
    recs.push('Wear long sleeves/pants, especially dawn and dusk');
    recs.push('Stay in air-conditioned accommodations when possible');
  }

  if (traveler.hasChronicConditions || traveler.age > 60) {
    recs.push('Consult travel medicine specialist before departure');
    recs.push('Carry extra supply of all medications');
    recs.push('Keep medical records and prescriptions accessible');
  }

  if (traveler.activities.includes('rural')) {
    recs.push('Consider rabies pre-exposure vaccination');
    recs.push('Avoid contact with animals');
  }

  recs.push('Register with embassy/consulate upon arrival');
  recs.push('Download offline maps and emergency contacts');

  return recs;
}

function getRequiredVaccinations(
  country: CountryHealthData,
  traveler: TravelerProfile,
): string[] {
  const required: string[] = [];

  if (country.yellowFeverRequired && !traveler.vaccinationStatus.yellowFever) {
    required.push('Yellow Fever (REQUIRED FOR ENTRY)');
  }
  if (!traveler.vaccinationStatus.hepatitisA) {
    required.push('Hepatitis A (Highly Recommended)');
  }
  if (!traveler.vaccinationStatus.typhoid) {
    required.push('Typhoid (Recommended)');
  }
  if (
    (country.malariaRisk === 'HIGH' || country.malariaRisk === 'MODERATE') &&
    traveler.activities.includes('rural')
  ) {
    required.push('Malaria Prophylaxis (Recommended)');
  }
  if (!traveler.vaccinationStatus.rabies && traveler.activities.includes('rural')) {
    required.push('Rabies (Consider if rural travel)');
  }
  if (!traveler.vaccinationStatus.hepatitisB && traveler.travelDuration > 30) {
    required.push('Hepatitis B (For extended stays)');
  }
  if (!traveler.vaccinationStatus.measles) {
    required.push('Measles-Mumps-Rubella (Ensure up-to-date)');
  }

  return required;
}

function generateWarnings(
  country: CountryHealthData,
  traveler: TravelerProfile,
  score: number,
): string[] {
  const warnings: string[] = [];

  if (score >= 70) {
    warnings.push('CRITICAL RISK: This destination poses severe health risks');
  }
  if (country.criticalOutbreaks > 0) {
    warnings.push(`${country.criticalOutbreaks} critical disease outbreak(s) active`);
  }
  if (country.caseFatalityRate > 0.05) {
    warnings.push(`High mortality rate: ${(country.caseFatalityRate * 100).toFixed(1)}% case fatality`);
  }
  if (traveler.isPregnant && (country.dengueRisk === 'HIGH' || country.dengueRisk === 'MODERATE')) {
    warnings.push('Zika/Dengue risk area — pregnancy travel NOT recommended');
  }
  if (country.healthcareQualityIndex < 30) {
    warnings.push('Very limited healthcare infrastructure');
  }
  if (country.cdcTravelLevel === 4) {
    warnings.push('CDC Level 4: DO NOT TRAVEL advisory in effect');
  }

  return warnings;
}

// ─── Country static data for healthcare / infrastructure / endemic risks ────
// Source approximations from WHO, World Bank, CDC. Updated periodically.

interface CountryStaticData {
  hospitalBedsPerCapita: number;
  doctorsPerCapita: number;
  healthcareQualityIndex: number;
  vaccineCoverage: number;
  sanitationAccess: number;
  cleanWaterAccess: number;
  airQualityIndex: number;
  malariaRisk: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
  dengueRisk: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
  yellowFeverRequired: boolean;
  cdcTravelLevel: 1 | 2 | 3 | 4;
  whoRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
}

// WHO-region-based defaults when a specific country isn't listed
const REGION_DEFAULTS: Record<string, CountryStaticData> = {
  EURO: {
    hospitalBedsPerCapita: 5.0, doctorsPerCapita: 3.5, healthcareQualityIndex: 78,
    vaccineCoverage: 92, sanitationAccess: 97, cleanWaterAccess: 99, airQualityIndex: 40,
    malariaRisk: 'NONE', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'LOW',
  },
  AMRO: {
    hospitalBedsPerCapita: 2.2, doctorsPerCapita: 2.0, healthcareQualityIndex: 62,
    vaccineCoverage: 85, sanitationAccess: 88, cleanWaterAccess: 95, airQualityIndex: 55,
    malariaRisk: 'LOW', dengueRisk: 'MODERATE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'MODERATE',
  },
  AFRO: {
    hospitalBedsPerCapita: 0.8, doctorsPerCapita: 0.3, healthcareQualityIndex: 32,
    vaccineCoverage: 60, sanitationAccess: 42, cleanWaterAccess: 55, airQualityIndex: 90,
    malariaRisk: 'HIGH', dengueRisk: 'MODERATE', yellowFeverRequired: true,
    cdcTravelLevel: 2, whoRiskLevel: 'HIGH',
  },
  EMRO: {
    hospitalBedsPerCapita: 1.5, doctorsPerCapita: 1.0, healthcareQualityIndex: 48,
    vaccineCoverage: 75, sanitationAccess: 72, cleanWaterAccess: 80, airQualityIndex: 120,
    malariaRisk: 'LOW', dengueRisk: 'LOW', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  SEARO: {
    hospitalBedsPerCapita: 1.0, doctorsPerCapita: 0.8, healthcareQualityIndex: 42,
    vaccineCoverage: 78, sanitationAccess: 60, cleanWaterAccess: 75, airQualityIndex: 140,
    malariaRisk: 'MODERATE', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  WPRO: {
    hospitalBedsPerCapita: 3.0, doctorsPerCapita: 1.8, healthcareQualityIndex: 65,
    vaccineCoverage: 88, sanitationAccess: 82, cleanWaterAccess: 90, airQualityIndex: 80,
    malariaRisk: 'LOW', dengueRisk: 'MODERATE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'LOW',
  },
};

// Per-country overrides for commonly searched destinations
const COUNTRY_DATA: Record<string, Partial<CountryStaticData>> = {
  'Brazil': {
    hospitalBedsPerCapita: 2.2, doctorsPerCapita: 2.1, healthcareQualityIndex: 68,
    vaccineCoverage: 85, sanitationAccess: 88, cleanWaterAccess: 98, airQualityIndex: 45,
    malariaRisk: 'LOW', dengueRisk: 'HIGH', yellowFeverRequired: true,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'India': {
    hospitalBedsPerCapita: 0.5, doctorsPerCapita: 0.9, healthcareQualityIndex: 41,
    vaccineCoverage: 72, sanitationAccess: 55, cleanWaterAccess: 70, airQualityIndex: 180,
    malariaRisk: 'MODERATE', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'Nigeria': {
    hospitalBedsPerCapita: 0.5, doctorsPerCapita: 0.4, healthcareQualityIndex: 28,
    vaccineCoverage: 57, sanitationAccess: 35, cleanWaterAccess: 47, airQualityIndex: 110,
    malariaRisk: 'HIGH', dengueRisk: 'MODERATE', yellowFeverRequired: true,
    cdcTravelLevel: 3, whoRiskLevel: 'HIGH',
  },
  'Democratic Republic of the Congo': {
    hospitalBedsPerCapita: 0.8, doctorsPerCapita: 0.1, healthcareQualityIndex: 22,
    vaccineCoverage: 45, sanitationAccess: 20, cleanWaterAccess: 35, airQualityIndex: 85,
    malariaRisk: 'HIGH', dengueRisk: 'LOW', yellowFeverRequired: true,
    cdcTravelLevel: 3, whoRiskLevel: 'VERY_HIGH',
  },
  'Thailand': {
    hospitalBedsPerCapita: 2.1, doctorsPerCapita: 0.8, healthcareQualityIndex: 71,
    vaccineCoverage: 90, sanitationAccess: 93, cleanWaterAccess: 98, airQualityIndex: 90,
    malariaRisk: 'LOW', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'LOW',
  },
  'Indonesia': {
    hospitalBedsPerCapita: 1.0, doctorsPerCapita: 0.4, healthcareQualityIndex: 48,
    vaccineCoverage: 75, sanitationAccess: 65, cleanWaterAccess: 78, airQualityIndex: 100,
    malariaRisk: 'MODERATE', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'Mexico': {
    hospitalBedsPerCapita: 1.5, doctorsPerCapita: 2.4, healthcareQualityIndex: 61,
    vaccineCoverage: 88, sanitationAccess: 88, cleanWaterAccess: 96, airQualityIndex: 70,
    malariaRisk: 'LOW', dengueRisk: 'MODERATE', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'South Africa': {
    hospitalBedsPerCapita: 2.3, doctorsPerCapita: 0.9, healthcareQualityIndex: 52,
    vaccineCoverage: 76, sanitationAccess: 70, cleanWaterAccess: 85, airQualityIndex: 50,
    malariaRisk: 'LOW', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'Kenya': {
    hospitalBedsPerCapita: 1.4, doctorsPerCapita: 0.2, healthcareQualityIndex: 35,
    vaccineCoverage: 68, sanitationAccess: 30, cleanWaterAccess: 50, airQualityIndex: 60,
    malariaRisk: 'HIGH', dengueRisk: 'MODERATE', yellowFeverRequired: true,
    cdcTravelLevel: 2, whoRiskLevel: 'HIGH',
  },
  'Egypt': {
    hospitalBedsPerCapita: 1.6, doctorsPerCapita: 0.8, healthcareQualityIndex: 52,
    vaccineCoverage: 80, sanitationAccess: 85, cleanWaterAccess: 90, airQualityIndex: 130,
    malariaRisk: 'NONE', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'Bangladesh': {
    hospitalBedsPerCapita: 0.8, doctorsPerCapita: 0.6, healthcareQualityIndex: 35,
    vaccineCoverage: 82, sanitationAccess: 48, cleanWaterAccess: 65, airQualityIndex: 200,
    malariaRisk: 'MODERATE', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'HIGH',
  },
  'Pakistan': {
    hospitalBedsPerCapita: 0.6, doctorsPerCapita: 1.0, healthcareQualityIndex: 38,
    vaccineCoverage: 66, sanitationAccess: 50, cleanWaterAccess: 60, airQualityIndex: 190,
    malariaRisk: 'MODERATE', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'HIGH',
  },
  'Yemen': {
    hospitalBedsPerCapita: 0.7, doctorsPerCapita: 0.3, healthcareQualityIndex: 18,
    vaccineCoverage: 30, sanitationAccess: 25, cleanWaterAccess: 30, airQualityIndex: 100,
    malariaRisk: 'HIGH', dengueRisk: 'MODERATE', yellowFeverRequired: false,
    cdcTravelLevel: 4, whoRiskLevel: 'VERY_HIGH',
  },
  'Sudan': {
    hospitalBedsPerCapita: 0.7, doctorsPerCapita: 0.3, healthcareQualityIndex: 20,
    vaccineCoverage: 40, sanitationAccess: 25, cleanWaterAccess: 35, airQualityIndex: 95,
    malariaRisk: 'HIGH', dengueRisk: 'LOW', yellowFeverRequired: true,
    cdcTravelLevel: 4, whoRiskLevel: 'VERY_HIGH',
  },
  'Ethiopia': {
    hospitalBedsPerCapita: 0.3, doctorsPerCapita: 0.1, healthcareQualityIndex: 25,
    vaccineCoverage: 52, sanitationAccess: 28, cleanWaterAccess: 42, airQualityIndex: 70,
    malariaRisk: 'HIGH', dengueRisk: 'MODERATE', yellowFeverRequired: true,
    cdcTravelLevel: 3, whoRiskLevel: 'HIGH',
  },
  'Philippines': {
    hospitalBedsPerCapita: 1.0, doctorsPerCapita: 0.6, healthcareQualityIndex: 55,
    vaccineCoverage: 70, sanitationAccess: 72, cleanWaterAccess: 85, airQualityIndex: 75,
    malariaRisk: 'LOW', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'Colombia': {
    hospitalBedsPerCapita: 1.7, doctorsPerCapita: 2.1, healthcareQualityIndex: 67,
    vaccineCoverage: 88, sanitationAccess: 85, cleanWaterAccess: 92, airQualityIndex: 50,
    malariaRisk: 'LOW', dengueRisk: 'HIGH', yellowFeverRequired: true,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'Peru': {
    hospitalBedsPerCapita: 1.6, doctorsPerCapita: 1.3, healthcareQualityIndex: 58,
    vaccineCoverage: 82, sanitationAccess: 76, cleanWaterAccess: 87, airQualityIndex: 55,
    malariaRisk: 'MODERATE', dengueRisk: 'HIGH', yellowFeverRequired: true,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'Vietnam': {
    hospitalBedsPerCapita: 2.6, doctorsPerCapita: 0.8, healthcareQualityIndex: 60,
    vaccineCoverage: 85, sanitationAccess: 78, cleanWaterAccess: 90, airQualityIndex: 110,
    malariaRisk: 'LOW', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'MODERATE',
  },
  'Japan': {
    hospitalBedsPerCapita: 13.0, doctorsPerCapita: 2.5, healthcareQualityIndex: 95,
    vaccineCoverage: 96, sanitationAccess: 100, cleanWaterAccess: 100, airQualityIndex: 30,
    malariaRisk: 'NONE', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'LOW',
  },
  'United Kingdom': {
    hospitalBedsPerCapita: 2.5, doctorsPerCapita: 3.0, healthcareQualityIndex: 85,
    vaccineCoverage: 94, sanitationAccess: 99, cleanWaterAccess: 100, airQualityIndex: 35,
    malariaRisk: 'NONE', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'LOW',
  },
  'Germany': {
    hospitalBedsPerCapita: 8.0, doctorsPerCapita: 4.3, healthcareQualityIndex: 92,
    vaccineCoverage: 93, sanitationAccess: 99, cleanWaterAccess: 100, airQualityIndex: 30,
    malariaRisk: 'NONE', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'LOW',
  },
  'France': {
    hospitalBedsPerCapita: 5.9, doctorsPerCapita: 3.2, healthcareQualityIndex: 90,
    vaccineCoverage: 92, sanitationAccess: 99, cleanWaterAccess: 100, airQualityIndex: 35,
    malariaRisk: 'NONE', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'LOW',
  },
  'Australia': {
    hospitalBedsPerCapita: 3.8, doctorsPerCapita: 3.7, healthcareQualityIndex: 93,
    vaccineCoverage: 95, sanitationAccess: 100, cleanWaterAccess: 100, airQualityIndex: 25,
    malariaRisk: 'NONE', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'LOW',
  },
  'China': {
    hospitalBedsPerCapita: 4.3, doctorsPerCapita: 2.0, healthcareQualityIndex: 72,
    vaccineCoverage: 90, sanitationAccess: 85, cleanWaterAccess: 92, airQualityIndex: 150,
    malariaRisk: 'NONE', dengueRisk: 'LOW', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'Russia': {
    hospitalBedsPerCapita: 7.1, doctorsPerCapita: 4.0, healthcareQualityIndex: 58,
    vaccineCoverage: 80, sanitationAccess: 88, cleanWaterAccess: 92, airQualityIndex: 60,
    malariaRisk: 'NONE', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 3, whoRiskLevel: 'MODERATE',
  },
  'Turkey': {
    hospitalBedsPerCapita: 2.8, doctorsPerCapita: 1.9, healthcareQualityIndex: 68,
    vaccineCoverage: 88, sanitationAccess: 95, cleanWaterAccess: 98, airQualityIndex: 65,
    malariaRisk: 'NONE', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'LOW',
  },
  'Argentina': {
    hospitalBedsPerCapita: 5.0, doctorsPerCapita: 4.0, healthcareQualityIndex: 70,
    vaccineCoverage: 86, sanitationAccess: 90, cleanWaterAccess: 97, airQualityIndex: 40,
    malariaRisk: 'NONE', dengueRisk: 'MODERATE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'MODERATE',
  },
  'Morocco': {
    hospitalBedsPerCapita: 1.1, doctorsPerCapita: 0.7, healthcareQualityIndex: 50,
    vaccineCoverage: 78, sanitationAccess: 80, cleanWaterAccess: 85, airQualityIndex: 70,
    malariaRisk: 'NONE', dengueRisk: 'NONE', yellowFeverRequired: false,
    cdcTravelLevel: 1, whoRiskLevel: 'LOW',
  },
  'Tanzania': {
    hospitalBedsPerCapita: 0.7, doctorsPerCapita: 0.1, healthcareQualityIndex: 30,
    vaccineCoverage: 62, sanitationAccess: 30, cleanWaterAccess: 45, airQualityIndex: 60,
    malariaRisk: 'HIGH', dengueRisk: 'MODERATE', yellowFeverRequired: true,
    cdcTravelLevel: 2, whoRiskLevel: 'HIGH',
  },
  'Uganda': {
    hospitalBedsPerCapita: 0.5, doctorsPerCapita: 0.1, healthcareQualityIndex: 28,
    vaccineCoverage: 58, sanitationAccess: 20, cleanWaterAccess: 38, airQualityIndex: 65,
    malariaRisk: 'HIGH', dengueRisk: 'LOW', yellowFeverRequired: true,
    cdcTravelLevel: 2, whoRiskLevel: 'HIGH',
  },
  'Cambodia': {
    hospitalBedsPerCapita: 0.8, doctorsPerCapita: 0.2, healthcareQualityIndex: 38,
    vaccineCoverage: 72, sanitationAccess: 50, cleanWaterAccess: 60, airQualityIndex: 85,
    malariaRisk: 'MODERATE', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'Nepal': {
    hospitalBedsPerCapita: 0.3, doctorsPerCapita: 0.7, healthcareQualityIndex: 35,
    vaccineCoverage: 70, sanitationAccess: 45, cleanWaterAccess: 55, airQualityIndex: 160,
    malariaRisk: 'LOW', dengueRisk: 'MODERATE', yellowFeverRequired: false,
    cdcTravelLevel: 2, whoRiskLevel: 'MODERATE',
  },
  'Ghana': {
    hospitalBedsPerCapita: 0.9, doctorsPerCapita: 0.2, healthcareQualityIndex: 38,
    vaccineCoverage: 65, sanitationAccess: 25, cleanWaterAccess: 55, airQualityIndex: 75,
    malariaRisk: 'HIGH', dengueRisk: 'LOW', yellowFeverRequired: true,
    cdcTravelLevel: 2, whoRiskLevel: 'HIGH',
  },
  'Myanmar': {
    hospitalBedsPerCapita: 0.9, doctorsPerCapita: 0.7, healthcareQualityIndex: 30,
    vaccineCoverage: 60, sanitationAccess: 45, cleanWaterAccess: 55, airQualityIndex: 95,
    malariaRisk: 'HIGH', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 4, whoRiskLevel: 'HIGH',
  },
  'Afghanistan': {
    hospitalBedsPerCapita: 0.4, doctorsPerCapita: 0.3, healthcareQualityIndex: 15,
    vaccineCoverage: 35, sanitationAccess: 18, cleanWaterAccess: 25, airQualityIndex: 170,
    malariaRisk: 'HIGH', dengueRisk: 'MODERATE', yellowFeverRequired: false,
    cdcTravelLevel: 4, whoRiskLevel: 'VERY_HIGH',
  },
  'Haiti': {
    hospitalBedsPerCapita: 0.7, doctorsPerCapita: 0.2, healthcareQualityIndex: 20,
    vaccineCoverage: 42, sanitationAccess: 22, cleanWaterAccess: 35, airQualityIndex: 65,
    malariaRisk: 'MODERATE', dengueRisk: 'HIGH', yellowFeverRequired: false,
    cdcTravelLevel: 4, whoRiskLevel: 'VERY_HIGH',
  },
  'Somalia': {
    hospitalBedsPerCapita: 0.9, doctorsPerCapita: 0.02, healthcareQualityIndex: 12,
    vaccineCoverage: 25, sanitationAccess: 15, cleanWaterAccess: 20, airQualityIndex: 80,
    malariaRisk: 'HIGH', dengueRisk: 'MODERATE', yellowFeverRequired: true,
    cdcTravelLevel: 4, whoRiskLevel: 'VERY_HIGH',
  },
};

/**
 * Resolve static country health data. Checks per-country overrides first,
 * then falls back to WHO-region defaults.
 */
export function getCountryStaticData(
  countryName: string,
  region: string,
): CountryStaticData {
  // Exact match
  if (COUNTRY_DATA[countryName]) {
    const defaults = REGION_DEFAULTS[region] ?? REGION_DEFAULTS.AMRO;
    return { ...defaults, ...COUNTRY_DATA[countryName] } as CountryStaticData;
  }

  // Fuzzy match
  const lower = countryName.toLowerCase();
  for (const [name, data] of Object.entries(COUNTRY_DATA)) {
    if (
      lower.includes(name.toLowerCase()) ||
      name.toLowerCase().includes(lower)
    ) {
      const defaults = REGION_DEFAULTS[region] ?? REGION_DEFAULTS.AMRO;
      return { ...defaults, ...data } as CountryStaticData;
    }
  }

  // Region default
  return REGION_DEFAULTS[region] ?? REGION_DEFAULTS.AMRO;
}

/** Default traveler profile for when traveler details are not provided */
export function defaultTravelerProfile(duration: number): TravelerProfile {
  return {
    age: 35,
    hasChronicConditions: false,
    isPregnant: false,
    vaccinationStatus: {
      yellowFever: false,
      hepatitisA: false,
      hepatitisB: false,
      typhoid: false,
      rabies: false,
      measles: true,
      polio: true,
    },
    travelDuration: duration,
    activities: ['urban'],
  };
}
