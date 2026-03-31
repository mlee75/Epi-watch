/**
 * Comprehensive disease library seed.
 * Adds a wide range of disease outbreaks across all categories.
 * Run: npx tsx prisma/seed-complete-diseases.ts
 *
 * NOTE: This supplements the main seed.ts (which has curated real-world data).
 * Case numbers here are generated/approximate — use seed.ts for verified data.
 */
import { PrismaClient } from '@prisma/client';
import { classifySeverity, buildDedupeKey, getRegionForCountry } from '../lib/classifiers';
import { getCountryCoords } from '../lib/countryCoords';

const prisma = new PrismaClient();

// ─── Disease definitions ─────────────────────────────────────────────────────

interface DiseaseEntry {
  name: string;
  category: string;
  transmission: string;
  mortality: string;
}

const DISEASE_LIBRARY: Record<string, DiseaseEntry[]> = {

  // ===== VIRAL DISEASES =====
  viral: [
    // Hemorrhagic Fevers
    { name: 'Ebola Virus Disease', category: 'Hemorrhagic Fever', transmission: 'Contact', mortality: 'High' },
    { name: 'Marburg Virus Disease', category: 'Hemorrhagic Fever', transmission: 'Contact', mortality: 'High' },
    { name: 'Lassa Fever', category: 'Hemorrhagic Fever', transmission: 'Rodent', mortality: 'Moderate' },
    { name: 'Crimean-Congo Hemorrhagic Fever', category: 'Hemorrhagic Fever', transmission: 'Tick', mortality: 'High' },
    { name: 'Rift Valley Fever', category: 'Hemorrhagic Fever', transmission: 'Mosquito', mortality: 'Moderate' },
    { name: 'Yellow Fever', category: 'Hemorrhagic Fever', transmission: 'Mosquito', mortality: 'High' },
    { name: 'Dengue Hemorrhagic Fever', category: 'Hemorrhagic Fever', transmission: 'Mosquito', mortality: 'Moderate' },
    { name: 'Kyasanur Forest Disease', category: 'Hemorrhagic Fever', transmission: 'Tick', mortality: 'Moderate' },
    { name: 'Omsk Hemorrhagic Fever', category: 'Hemorrhagic Fever', transmission: 'Tick', mortality: 'Moderate' },
    { name: 'Alkhurma Hemorrhagic Fever', category: 'Hemorrhagic Fever', transmission: 'Tick', mortality: 'Moderate' },

    // Respiratory Viruses
    { name: 'COVID-19', category: 'Respiratory', transmission: 'Airborne', mortality: 'Moderate' },
    { name: 'Influenza A (H1N1)', category: 'Respiratory', transmission: 'Airborne', mortality: 'Low' },
    { name: 'Influenza A (H3N2)', category: 'Respiratory', transmission: 'Airborne', mortality: 'Low' },
    { name: 'Influenza A (H5N1) Bird Flu', category: 'Respiratory', transmission: 'Zoonotic', mortality: 'High' },
    { name: 'Influenza A (H7N9) Bird Flu', category: 'Respiratory', transmission: 'Zoonotic', mortality: 'High' },
    { name: 'SARS', category: 'Respiratory', transmission: 'Airborne', mortality: 'Moderate' },
    { name: 'MERS-CoV', category: 'Respiratory', transmission: 'Zoonotic', mortality: 'High' },
    { name: 'RSV', category: 'Respiratory', transmission: 'Airborne', mortality: 'Low' },
    { name: 'Adenovirus', category: 'Respiratory', transmission: 'Airborne', mortality: 'Low' },
    { name: 'Human Metapneumovirus', category: 'Respiratory', transmission: 'Airborne', mortality: 'Low' },
    { name: 'Parainfluenza', category: 'Respiratory', transmission: 'Airborne', mortality: 'Low' },

    // Arboviruses
    { name: 'Dengue Fever', category: 'Arbovirus', transmission: 'Mosquito', mortality: 'Low' },
    { name: 'Zika Virus', category: 'Arbovirus', transmission: 'Mosquito', mortality: 'Low' },
    { name: 'Chikungunya', category: 'Arbovirus', transmission: 'Mosquito', mortality: 'Low' },
    { name: 'West Nile Virus', category: 'Arbovirus', transmission: 'Mosquito', mortality: 'Low' },
    { name: 'Japanese Encephalitis', category: 'Arbovirus', transmission: 'Mosquito', mortality: 'Moderate' },
    { name: 'Tick-borne Encephalitis', category: 'Arbovirus', transmission: 'Tick', mortality: 'Low' },
    { name: 'Eastern Equine Encephalitis', category: 'Arbovirus', transmission: 'Mosquito', mortality: 'High' },
    { name: 'Powassan Virus', category: 'Arbovirus', transmission: 'Tick', mortality: 'Moderate' },
    { name: 'Ross River Virus', category: 'Arbovirus', transmission: 'Mosquito', mortality: 'Low' },
    { name: 'Mayaro Virus', category: 'Arbovirus', transmission: 'Mosquito', mortality: 'Low' },
    { name: 'Oropouche Fever', category: 'Arbovirus', transmission: 'Midge', mortality: 'Low' },

    // Zoonotic Viruses
    { name: 'Rabies', category: 'Zoonotic', transmission: 'Animal Bite', mortality: 'Very High' },
    { name: 'Nipah Virus', category: 'Zoonotic', transmission: 'Bat/Pig', mortality: 'High' },
    { name: 'Hendra Virus', category: 'Zoonotic', transmission: 'Horse', mortality: 'High' },
    { name: 'Hantavirus Pulmonary Syndrome', category: 'Zoonotic', transmission: 'Rodent', mortality: 'High' },
    { name: 'Monkeypox (Mpox)', category: 'Zoonotic', transmission: 'Contact', mortality: 'Low' },
    { name: 'Avian Influenza', category: 'Zoonotic', transmission: 'Bird', mortality: 'High' },

    // Childhood Diseases
    { name: 'Measles', category: 'Childhood', transmission: 'Airborne', mortality: 'Low' },
    { name: 'Mumps', category: 'Childhood', transmission: 'Airborne', mortality: 'Low' },
    { name: 'Rubella', category: 'Childhood', transmission: 'Airborne', mortality: 'Low' },
    { name: 'Chickenpox', category: 'Childhood', transmission: 'Airborne', mortality: 'Low' },
    { name: 'Hand, Foot and Mouth Disease', category: 'Childhood', transmission: 'Contact', mortality: 'Low' },

    // Hepatitis
    { name: 'Hepatitis A', category: 'Hepatitis', transmission: 'Fecal-Oral', mortality: 'Low' },
    { name: 'Hepatitis B', category: 'Hepatitis', transmission: 'Blood/Sexual', mortality: 'Moderate' },
    { name: 'Hepatitis C', category: 'Hepatitis', transmission: 'Blood', mortality: 'Moderate' },
    { name: 'Hepatitis E', category: 'Hepatitis', transmission: 'Fecal-Oral', mortality: 'Low' },

    // Retroviruses
    { name: 'HIV/AIDS', category: 'Retrovirus', transmission: 'Blood/Sexual', mortality: 'High' },

    // Enteroviruses
    { name: 'Poliomyelitis', category: 'Enterovirus', transmission: 'Fecal-Oral', mortality: 'Low' },
    { name: 'Enterovirus D68', category: 'Enterovirus', transmission: 'Respiratory', mortality: 'Low' },

    // Gastroenteric
    { name: 'Norovirus', category: 'Gastroenteric', transmission: 'Fecal-Oral', mortality: 'Low' },
    { name: 'Rotavirus', category: 'Gastroenteric', transmission: 'Fecal-Oral', mortality: 'Low' },

    // Emerging
    { name: 'Lujo Virus', category: 'Emerging', transmission: 'Contact', mortality: 'High' },
    { name: 'Sudan Virus', category: 'Emerging', transmission: 'Contact', mortality: 'High' },
    { name: 'Chapare Virus', category: 'Emerging', transmission: 'Rodent', mortality: 'High' },
  ],

  // ===== BACTERIAL DISEASES =====
  bacterial: [
    // Respiratory
    { name: 'Tuberculosis', category: 'Respiratory', transmission: 'Airborne', mortality: 'Moderate' },
    { name: 'Tuberculosis (MDR-TB)', category: 'Respiratory', transmission: 'Airborne', mortality: 'High' },
    { name: 'Tuberculosis (XDR-TB)', category: 'Respiratory', transmission: 'Airborne', mortality: 'Very High' },
    { name: 'Diphtheria', category: 'Respiratory', transmission: 'Airborne', mortality: 'Moderate' },
    { name: 'Pertussis', category: 'Respiratory', transmission: 'Airborne', mortality: 'Low' },
    { name: 'Legionnaires Disease', category: 'Respiratory', transmission: 'Water', mortality: 'Moderate' },

    // Meningitis & CNS
    { name: 'Meningococcal Meningitis', category: 'CNS', transmission: 'Respiratory', mortality: 'High' },
    { name: 'Tetanus', category: 'CNS', transmission: 'Wound', mortality: 'High' },
    { name: 'Botulism', category: 'CNS', transmission: 'Foodborne', mortality: 'High' },

    // Gastroenteric
    { name: 'Cholera', category: 'Gastroenteric', transmission: 'Fecal-Oral', mortality: 'High' },
    { name: 'Typhoid Fever', category: 'Gastroenteric', transmission: 'Fecal-Oral', mortality: 'Moderate' },
    { name: 'Shigellosis', category: 'Gastroenteric', transmission: 'Fecal-Oral', mortality: 'Low' },
    { name: 'Salmonellosis', category: 'Gastroenteric', transmission: 'Foodborne', mortality: 'Low' },
    { name: 'E. coli O157:H7', category: 'Gastroenteric', transmission: 'Foodborne', mortality: 'Low' },
    { name: 'Campylobacter', category: 'Gastroenteric', transmission: 'Foodborne', mortality: 'Low' },

    // Plague
    { name: 'Bubonic Plague', category: 'Plague', transmission: 'Flea', mortality: 'High' },
    { name: 'Pneumonic Plague', category: 'Plague', transmission: 'Airborne', mortality: 'Very High' },

    // Zoonotic
    { name: 'Anthrax', category: 'Zoonotic', transmission: 'Contact/Inhalation', mortality: 'High' },
    { name: 'Brucellosis', category: 'Zoonotic', transmission: 'Animal Products', mortality: 'Low' },
    { name: 'Q Fever', category: 'Zoonotic', transmission: 'Inhalation', mortality: 'Low' },
    { name: 'Tularemia', category: 'Zoonotic', transmission: 'Tick/Contact', mortality: 'Moderate' },
    { name: 'Leptospirosis', category: 'Zoonotic', transmission: 'Water', mortality: 'Low' },
    { name: 'Melioidosis', category: 'Zoonotic', transmission: 'Soil/Water', mortality: 'Moderate' },

    // Skin & Wound
    { name: 'Leprosy', category: 'Skin', transmission: 'Respiratory', mortality: 'Low' },
    { name: 'Necrotizing Fasciitis', category: 'Skin', transmission: 'Wound', mortality: 'High' },
    { name: 'Scarlet Fever', category: 'Skin', transmission: 'Respiratory', mortality: 'Low' },

    // Tick-borne
    { name: 'Lyme Disease', category: 'Tick-borne', transmission: 'Tick', mortality: 'Low' },
    { name: 'Rocky Mountain Spotted Fever', category: 'Tick-borne', transmission: 'Tick', mortality: 'Moderate' },
    { name: 'Ehrlichiosis', category: 'Tick-borne', transmission: 'Tick', mortality: 'Low' },

    // Healthcare-Associated
    { name: 'MRSA', category: 'Healthcare', transmission: 'Contact', mortality: 'Moderate' },
    { name: 'CRE', category: 'Healthcare', transmission: 'Contact', mortality: 'High' },

    // STI
    { name: 'Syphilis', category: 'STI', transmission: 'Sexual', mortality: 'Low' },
    { name: 'Gonorrhea', category: 'STI', transmission: 'Sexual', mortality: 'Low' },
  ],

  // ===== PARASITIC DISEASES =====
  parasitic: [
    // Protozoan
    { name: 'Malaria (P. falciparum)', category: 'Protozoan', transmission: 'Mosquito', mortality: 'High' },
    { name: 'Malaria (P. vivax)', category: 'Protozoan', transmission: 'Mosquito', mortality: 'Low' },
    { name: 'Leishmaniasis (Cutaneous)', category: 'Protozoan', transmission: 'Sandfly', mortality: 'Low' },
    { name: 'Leishmaniasis (Visceral)', category: 'Protozoan', transmission: 'Sandfly', mortality: 'High' },
    { name: 'African Sleeping Sickness', category: 'Protozoan', transmission: 'Tsetse Fly', mortality: 'High' },
    { name: 'Chagas Disease', category: 'Protozoan', transmission: 'Bug', mortality: 'Moderate' },
    { name: 'Giardiasis', category: 'Protozoan', transmission: 'Water', mortality: 'Low' },
    { name: 'Cryptosporidiosis', category: 'Protozoan', transmission: 'Water', mortality: 'Low' },
    { name: 'Amoebiasis', category: 'Protozoan', transmission: 'Fecal-Oral', mortality: 'Low' },

    // Helminth
    { name: 'Schistosomiasis', category: 'Helminth', transmission: 'Water', mortality: 'Low' },
    { name: 'Lymphatic Filariasis', category: 'Helminth', transmission: 'Mosquito', mortality: 'Low' },
    { name: 'Onchocerciasis', category: 'Helminth', transmission: 'Blackfly', mortality: 'Low' },
    { name: 'Guinea Worm Disease', category: 'Helminth', transmission: 'Water', mortality: 'Low' },
    { name: 'Ascariasis', category: 'Helminth', transmission: 'Fecal-Oral', mortality: 'Low' },
    { name: 'Hookworm', category: 'Helminth', transmission: 'Soil', mortality: 'Low' },
    { name: 'Strongyloidiasis', category: 'Helminth', transmission: 'Soil', mortality: 'Moderate' },
    { name: 'Echinococcosis', category: 'Helminth', transmission: 'Dog', mortality: 'Moderate' },
    { name: 'Trichinellosis', category: 'Helminth', transmission: 'Pork', mortality: 'Low' },
  ],

  // ===== FUNGAL DISEASES =====
  fungal: [
    { name: 'Candida auris', category: 'Systemic', transmission: 'Healthcare', mortality: 'High' },
    { name: 'Aspergillosis', category: 'Systemic', transmission: 'Inhalation', mortality: 'High' },
    { name: 'Cryptococcosis', category: 'Systemic', transmission: 'Inhalation', mortality: 'High' },
    { name: 'Histoplasmosis', category: 'Systemic', transmission: 'Inhalation', mortality: 'Moderate' },
    { name: 'Coccidioidomycosis', category: 'Systemic', transmission: 'Inhalation', mortality: 'Moderate' },
    { name: 'Blastomycosis', category: 'Systemic', transmission: 'Inhalation', mortality: 'Moderate' },
    { name: 'Mucormycosis', category: 'Systemic', transmission: 'Inhalation', mortality: 'Very High' },
    { name: 'Pneumocystis Pneumonia', category: 'Systemic', transmission: 'Inhalation', mortality: 'High' },
    { name: 'Sporotrichosis', category: 'Subcutaneous', transmission: 'Soil/Plants', mortality: 'Low' },
    { name: 'Mycetoma', category: 'Subcutaneous', transmission: 'Soil', mortality: 'Low' },
  ],

  // ===== PRION DISEASES =====
  prion: [
    { name: 'Creutzfeldt-Jakob Disease', category: 'Prion', transmission: 'Tissue/Hereditary', mortality: 'Very High' },
    { name: 'Variant CJD (Mad Cow Disease)', category: 'Prion', transmission: 'Foodborne', mortality: 'Very High' },
    { name: 'Kuru', category: 'Prion', transmission: 'Cannibalism', mortality: 'Very High' },
  ],
};

// ─── Country pools by region for realistic disease distribution ───────────────

const REGION_COUNTRIES: Record<string, string[]> = {
  AFRO: [
    'Nigeria', 'Democratic Republic of Congo', 'Ethiopia', 'Kenya', 'Tanzania',
    'Uganda', 'Ghana', 'Cameroon', 'Mozambique', 'Mali', 'Niger', 'Burkina Faso',
    'Senegal', 'Guinea', 'Sierra Leone', 'Liberia', 'South Africa', 'Zimbabwe',
    'Zambia', 'Malawi', 'Madagascar', 'Somalia', 'South Sudan', 'Sudan', 'Chad',
    'Central African Republic', 'Burundi', 'Rwanda', 'Togo', 'Benin',
  ],
  AMRO: [
    'Brazil', 'Mexico', 'Colombia', 'Peru', 'Argentina', 'Venezuela', 'Chile',
    'Ecuador', 'Bolivia', 'Paraguay', 'Haiti', 'Dominican Republic', 'Guatemala',
    'Honduras', 'El Salvador', 'Nicaragua', 'Cuba', 'United States', 'Canada',
  ],
  EMRO: [
    'Pakistan', 'Afghanistan', 'Yemen', 'Iraq', 'Syria', 'Egypt', 'Iran',
    'Jordan', 'Lebanon', 'Libya', 'Tunisia', 'Morocco', 'Saudi Arabia', 'Somalia', 'Sudan',
  ],
  EURO: [
    'United Kingdom', 'France', 'Germany', 'Italy', 'Spain', 'Romania', 'Ukraine',
    'Poland', 'Turkey', 'Russia', 'Greece', 'Hungary', 'Bulgaria', 'Czechia',
    'Austria', 'Belgium', 'Netherlands', 'Sweden', 'Norway', 'Finland',
  ],
  SEARO: [
    'India', 'Bangladesh', 'Indonesia', 'Myanmar', 'Thailand', 'Nepal',
    'Sri Lanka', 'Bhutan',
  ],
  WPRO: [
    'China', 'Philippines', 'Vietnam', 'Cambodia', 'Japan', 'South Korea',
    'Malaysia', 'Australia', 'New Zealand', 'Mongolia', 'Lao PDR',
  ],
};

// Diseases with regional affinity (more realistic distribution)
const DISEASE_REGION_AFFINITY: Record<string, string[]> = {
  // Tropical / vector-borne → AFRO, SEARO, AMRO
  'Ebola Virus Disease': ['AFRO'],
  'Marburg Virus Disease': ['AFRO'],
  'Lassa Fever': ['AFRO'],
  'Yellow Fever': ['AFRO', 'AMRO'],
  'Dengue Fever': ['SEARO', 'AMRO', 'WPRO', 'AFRO'],
  'Dengue Hemorrhagic Fever': ['SEARO', 'AMRO', 'WPRO'],
  'Malaria (P. falciparum)': ['AFRO', 'SEARO'],
  'Malaria (P. vivax)': ['SEARO', 'AMRO', 'EMRO'],
  'Chikungunya': ['SEARO', 'AMRO', 'AFRO'],
  'Zika Virus': ['AMRO', 'SEARO'],
  'Cholera': ['AFRO', 'SEARO', 'EMRO'],
  'Typhoid Fever': ['SEARO', 'AFRO', 'EMRO'],
  'African Sleeping Sickness': ['AFRO'],
  'Chagas Disease': ['AMRO'],
  'Leishmaniasis (Cutaneous)': ['EMRO', 'AFRO', 'AMRO'],
  'Leishmaniasis (Visceral)': ['SEARO', 'AFRO', 'EMRO'],
  'Schistosomiasis': ['AFRO', 'SEARO'],
  'Lymphatic Filariasis': ['AFRO', 'SEARO'],
  'Onchocerciasis': ['AFRO'],
  'Guinea Worm Disease': ['AFRO'],
  'Rift Valley Fever': ['AFRO', 'EMRO'],
  'Crimean-Congo Hemorrhagic Fever': ['EMRO', 'EURO', 'AFRO'],
  'Japanese Encephalitis': ['SEARO', 'WPRO'],
  'Nipah Virus': ['SEARO'],
  'Meningococcal Meningitis': ['AFRO'],
  'Rabies': ['SEARO', 'AFRO'],
  'Bubonic Plague': ['AFRO', 'AMRO'],
  'Pneumonic Plague': ['AFRO'],

  // Global / healthcare
  'COVID-19': ['EURO', 'AMRO', 'SEARO', 'WPRO', 'EMRO', 'AFRO'],
  'Influenza A (H1N1)': ['EURO', 'AMRO', 'WPRO', 'SEARO'],
  'Influenza A (H3N2)': ['EURO', 'AMRO', 'WPRO'],
  'RSV': ['EURO', 'AMRO', 'WPRO'],
  'Norovirus': ['EURO', 'AMRO', 'WPRO'],
  'Measles': ['AFRO', 'SEARO', 'EMRO', 'EURO'],
  'Pertussis': ['EURO', 'AMRO', 'SEARO'],
  'MRSA': ['EURO', 'AMRO', 'WPRO'],
  'Candida auris': ['EURO', 'AMRO', 'SEARO'],
  'Tuberculosis': ['SEARO', 'AFRO', 'EMRO'],
  'Tuberculosis (MDR-TB)': ['SEARO', 'AFRO', 'EURO'],
  'Tuberculosis (XDR-TB)': ['AFRO', 'SEARO'],
  'HIV/AIDS': ['AFRO', 'SEARO'],
  'Diphtheria': ['AFRO', 'SEARO', 'EMRO'],
  'Lyme Disease': ['EURO', 'AMRO'],
  'West Nile Virus': ['AMRO', 'EURO'],
  'MERS-CoV': ['EMRO'],
  'Avian Influenza': ['SEARO', 'WPRO', 'AMRO'],
  'Hantavirus Pulmonary Syndrome': ['AMRO'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSeverityFromMortality(mortality: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (mortality.includes('Very High')) return 'CRITICAL';
  if (mortality.includes('High')) return Math.random() > 0.3 ? 'CRITICAL' : 'HIGH';
  if (mortality.includes('Moderate')) return Math.random() > 0.5 ? 'HIGH' : 'MEDIUM';
  return Math.random() > 0.7 ? 'MEDIUM' : 'LOW';
}

function generateCases(severity: string): { cases: number; deaths: number } {
  switch (severity) {
    case 'CRITICAL':
      { const c = Math.floor(Math.random() * 50000) + 10000;
        return { cases: c, deaths: Math.floor(c * (Math.random() * 0.15 + 0.05)) }; }
    case 'HIGH':
      { const c = Math.floor(Math.random() * 10000) + 1000;
        return { cases: c, deaths: Math.floor(c * (Math.random() * 0.08 + 0.02)) }; }
    case 'MEDIUM':
      { const c = Math.floor(Math.random() * 1000) + 100;
        return { cases: c, deaths: Math.floor(c * Math.random() * 0.03) }; }
    default:
      { const c = Math.floor(Math.random() * 200) + 10;
        return { cases: c, deaths: Math.floor(c * Math.random() * 0.01) }; }
  }
}

function pickCountry(disease: DiseaseEntry): string {
  const affinityRegions = DISEASE_REGION_AFFINITY[disease.name];
  let pool: string[];

  if (affinityRegions && affinityRegions.length > 0) {
    const region = affinityRegions[Math.floor(Math.random() * affinityRegions.length)];
    pool = REGION_COUNTRIES[region] ?? REGION_COUNTRIES.AFRO;
  } else {
    // Pick from any region
    const allRegions = Object.keys(REGION_COUNTRIES);
    const region = allRegions[Math.floor(Math.random() * allRegions.length)];
    pool = REGION_COUNTRIES[region];
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function pickTrend(): string {
  const r = Math.random();
  if (r < 0.4) return 'stable';
  if (r < 0.7) return 'increasing';
  return 'decreasing';
}

const SOURCES = ['WHO', 'CDC', 'ProMED', 'ECDC'];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding comprehensive disease library...\n');

  let created = 0;
  let skipped = 0;

  for (const [category, diseases] of Object.entries(DISEASE_LIBRARY)) {
    console.log(`  ${category}: ${diseases.length} diseases`);

    for (const disease of diseases) {
      // 1-4 outbreaks per disease
      const numOutbreaks = Math.floor(Math.random() * 4) + 1;

      for (let i = 0; i < numOutbreaks; i++) {
        const country = pickCountry(disease);
        const severity = getSeverityFromMortality(disease.mortality);
        const { cases, deaths } = generateCases(severity);
        const trend = pickTrend();
        const region = getRegionForCountry(country);
        const coords = getCountryCoords(country);
        const reportDate = new Date(
          Date.now() - Math.floor(Math.random() * 60) * 86400000, // last 60 days
        );
        const dedupeKey = buildDedupeKey(disease.name, country, reportDate);
        const sourceName = SOURCES[Math.floor(Math.random() * SOURCES.length)];
        const finalSeverity = classifySeverity(cases, deaths);

        const summary = `${disease.name} outbreak reported in ${country}. `
          + `Category: ${disease.category}. Transmission: ${disease.transmission}. `
          + `${cases.toLocaleString()} confirmed cases and ${deaths.toLocaleString()} deaths reported.`;

        try {
          await prisma.outbreak.upsert({
            where: { dedupeKey },
            create: {
              disease: disease.name,
              pathogen: disease.name,
              country,
              region,
              subregion: null,
              lat: coords ? coords[0] : null,
              lng: coords ? coords[1] : null,
              cases,
              deaths,
              recovered: 0,
              severity: finalSeverity,
              summary,
              trend,
              verified: true,
              language: 'en',
              titleOrig: null,
              sourceUrl: `https://www.who.int/emergencies/disease-outbreak-news`,
              sourceName,
              isActive: Math.random() > 0.08, // 92% active
              dedupeKey,
              reportDate,
            },
            update: {
              cases,
              deaths,
              severity: finalSeverity,
            },
          });
          created++;
        } catch {
          skipped++;
        }
      }
    }
  }

  // Count totals
  const totalDiseases =
    DISEASE_LIBRARY.viral.length +
    DISEASE_LIBRARY.bacterial.length +
    DISEASE_LIBRARY.parasitic.length +
    DISEASE_LIBRARY.fungal.length +
    DISEASE_LIBRARY.prion.length;

  console.log(`\nDone: ${created} outbreaks created/updated, ${skipped} skipped`);
  console.log(`\nCoverage:`);
  console.log(`   Viral:     ${DISEASE_LIBRARY.viral.length} diseases`);
  console.log(`   Bacterial: ${DISEASE_LIBRARY.bacterial.length} diseases`);
  console.log(`   Parasitic: ${DISEASE_LIBRARY.parasitic.length} diseases`);
  console.log(`   Fungal:    ${DISEASE_LIBRARY.fungal.length} diseases`);
  console.log(`   Prion:     ${DISEASE_LIBRARY.prion.length} diseases`);
  console.log(`   TOTAL:     ${totalDiseases} unique diseases tracked`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
