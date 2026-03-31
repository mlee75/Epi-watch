/**
 * Seed the database with current outbreak data.
 * Run: npm run db:seed
 *
 * Data verified against WHO, CDC, PAHO, UKHSA, NCDC reports through early 2026.
 * Case/death numbers are approximate figures from WHO, CDC, PAHO, and ProMED.
 */
import { PrismaClient } from '@prisma/client';
import { classifySeverity, generateSummary, buildDedupeKey, getRegionForCountry } from '../lib/classifiers';
import { getCountryCoords } from '../lib/countryCoords';
import type { ScrapedOutbreak } from '../lib/types';

const prisma = new PrismaClient();

const SEED_OUTBREAKS: Omit<ScrapedOutbreak, 'reportDate'>[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL — Active, large-scale outbreaks
  // ═══════════════════════════════════════════════════════════════════════════

  {
    disease: 'Cholera',
    pathogen: 'Vibrio cholerae O1',
    country: 'Yemen',
    subregion: 'Nationwide',
    cases: 2500000,
    deaths: 4000,
    trend: 'stable',
    summary:
      'One of the largest cholera outbreaks in modern history, persisting since 2016. In 2025, the Eastern Mediterranean Region reported the highest global cholera case count (359,052 cases across 6 countries). Globally, 614,828 cases and 7,598 deaths were reported across 33 countries in 2025. Cases declined 57% in early 2026 vs 2025.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Mpox',
    pathogen: 'Monkeypox virus (Clade Ib)',
    country: 'Democratic Republic of Congo',
    subregion: 'South Kivu, Equateur',
    cases: 53000,
    deaths: 200,
    trend: 'decreasing',
    summary:
      'A severe mpox epidemic driven by the more transmissible Clade Ib strain. WHO declared a PHEIC in August 2024, lifted it in September 2025 after deploying 1.1 million vaccine doses across 11 African countries. Over 53,000 clade I cases confirmed in Central/Eastern Africa since 2024. Cases are now declining steadily.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Dengue Fever',
    pathogen: 'Dengue virus (DENV-3)',
    country: 'Brazil',
    subregion: 'Southeast Brazil',
    cases: 6600000,
    deaths: 6199,
    trend: 'stable',
    summary:
      'Brazil experienced a record-breaking dengue surge in 2024, exceeding all previous years. The surge is attributed to increased Aedes aegypti mosquito populations following La Niña weather patterns, urban expansion, and waning population immunity from prior outbreaks.',
    sourceUrl: 'https://www.paho.org/en/topics/dengue',
    sourceName: 'PAHO',
  },
  {
    disease: 'Dengue Fever',
    pathogen: 'Dengue virus (DENV-2)',
    country: 'Bangladesh',
    subregion: 'Dhaka Division',
    cases: 188000,
    deaths: 910,
    trend: 'decreasing',
    summary:
      'Bangladesh experienced its deadliest dengue outbreak on record in 2023 with 187,725 cases and 909 deaths. The outbreak expanded into previously non-endemic areas, overwhelming healthcare capacity. Cases declined significantly in 2024-2025 with about 1,500 cases reported by early 2026.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Measles',
    pathogen: 'Measles virus (genotype B3)',
    country: 'Democratic Republic of Congo',
    subregion: 'Multiple provinces',
    cases: 87000,
    deaths: 1845,
    trend: 'increasing',
    summary:
      'The DRC consistently reports among the highest measles burdens globally, with tens of thousands of cases annually. Ongoing conflict, population displacement, and vaccination coverage below 60% in many provinces perpetuate outbreaks. Children under 5 bear the highest burden.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },

  {
    disease: 'Cholera',
    pathogen: 'Vibrio cholerae O1',
    country: 'Democratic Republic of Congo',
    subregion: 'Multiple provinces',
    cases: 64427,
    deaths: 1888,
    trend: 'increasing',
    summary:
      'The DRC experienced its worst cholera outbreak in 25 years in 2025, with 64,427 cases and 1,888 deaths. Only 43% of the population has basic water services — the lowest in Africa — and just 15% have basic sanitation. In January 2026 alone, DRC reported 6,543 new cases and 148 deaths.',
    sourceUrl: 'https://www.unicef.org/press-releases/democratic-republic-congo-cholera-outbreak-declared-countrys-worst-25-years',
    sourceName: 'UNICEF',
  },
  {
    disease: 'Yellow Fever',
    pathogen: 'Yellow fever virus',
    country: 'Colombia',
    subregion: 'Tolima Department (Ataco, Chaparral)',
    cases: 153,
    deaths: 62,
    trend: 'increasing',
    summary:
      'A sustained yellow fever outbreak in Tolima, Colombia has produced 153 confirmed cases and 62 deaths (CFR 41%) since late 2024. PAHO issued an epidemiological alert in March 2026 as cases expanded beyond the Amazon into new areas. In 2025, 346 cases and 143 deaths were reported across 7 countries in the Americas.',
    sourceUrl: 'https://www.paho.org/en/news/13-3-2026-paho-reports-sustained-yellow-fever-transmission-parts-south-america',
    sourceName: 'PAHO',
  },
  {
    disease: 'Oropouche Fever',
    pathogen: 'Oropouche virus (OROV)',
    country: 'Brazil',
    subregion: 'Espírito Santo, Rio de Janeiro, Amazon',
    cases: 12700,
    deaths: 5,
    trend: 'increasing',
    summary:
      'A novel reassortant Oropouche virus lineage originating from the Brazilian Amazon has spread to 20 states and 11 countries across the Americas. Over 12,700 confirmed cases were reported in the first 7 months of 2025 alone. Transmitted by the midge Culicoides paraensis, with neurological complications and fetal deaths under investigation.',
    sourceUrl: 'https://www.paho.org/en/news/14-8-2025-paho-publishes-new-update-oropouche-fever-americas',
    sourceName: 'PAHO',
  },
  {
    disease: 'Mpox',
    pathogen: 'Monkeypox virus (Clade Ib)',
    country: 'Madagascar',
    subregion: 'Multiple regions',
    cases: 357,
    deaths: 0,
    trend: 'increasing',
    summary:
      'Madagascar confirmed its first mpox case on 17 December 2025 and declared an outbreak on 30 December. By March 2026, 357 confirmed clade Ib cases were reported with community transmission established. An allocation of 30,000 MVA-BN vaccine doses was made in January 2026.',
    sourceUrl: 'https://www.who.int/publications/m/item/multi-country-outbreak-of-mpox--external-situation-report--62---23-january-2026',
    sourceName: 'WHO',
  },
  {
    disease: 'Cholera',
    pathogen: 'Vibrio cholerae O1',
    country: 'Mozambique',
    subregion: 'Nampula, Zambezia',
    cases: 6500,
    deaths: 94,
    trend: 'increasing',
    summary:
      'Heavy rains and flooding since December 2025 triggered a cholera surge in Mozambique. By February 2026, over 6,500 cases and 94 deaths were recorded since September 2025. Nampula province was hardest hit with 673 cases in Nacala Porto alone. Oral cholera vaccination campaigns targeting 2 million doses resumed in February 2026.',
    sourceUrl: 'https://www.who.int/publications/m/item/multi-country-outbreak-of-cholera--epidemiological-update--34--21-february-2026',
    sourceName: 'WHO',
  },
  {
    disease: 'New World Screwworm Myiasis',
    pathogen: 'Cochliomyia hominivorax',
    country: 'Mexico',
    subregion: 'Chiapas, Tamaulipas, 6 other states',
    cases: 1590,
    deaths: 7,
    trend: 'increasing',
    summary:
      'A New World Screwworm outbreak spreading northward from Central America has infected over 1,590 people and 161,400 animals across Central America and Mexico since 2023. CDC issued a Health Alert as cases reached Tamaulipas (bordering Texas). Mexico alone reported 141 human cases across 8 states. The first US human case since a decade was detected in August 2025.',
    sourceUrl: 'https://www.cdc.gov/new-world-screwworm/situation-summary/index.html',
    sourceName: 'CDC',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HIGH — Significant active outbreaks
  // ═══════════════════════════════════════════════════════════════════════════

  {
    disease: 'Cholera',
    pathogen: 'Vibrio cholerae O1',
    country: 'Haiti',
    subregion: 'Nationwide',
    cases: 5353,
    deaths: 78,
    trend: 'decreasing',
    summary:
      'Cholera re-emerged in Haiti in October 2022, spreading rapidly through a population with limited access to clean water. By December 2025, 5,353 cases and 78 deaths were reported for the year. Haiti was the only country reporting cholera in the WHO Americas region. Political instability and gang violence continue to hamper response efforts.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Cholera',
    pathogen: 'Vibrio cholerae O1',
    country: 'Zimbabwe',
    subregion: 'Harare, Manicaland',
    cases: 133,
    deaths: 2,
    trend: 'decreasing',
    summary:
      'A major cholera outbreak in 2023-2024 linked to failing urban water infrastructure in Harare has largely subsided. Only 133 cases and 2 deaths were reported by February 2025, with just 5 new cases through early 2026. Emergency water treatment and oral cholera vaccination campaigns were effective.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'H5N1 Avian Influenza',
    pathogen: 'Influenza A (H5N1) clade 2.3.4.4b',
    country: 'United States',
    subregion: 'Multiple states',
    cases: 71,
    deaths: 2,
    trend: 'stable',
    summary:
      '71 confirmed human H5 cases (70 H5N1, 1 fatal H5N5) reported in the US through late 2025. Most cases were mild (94%), linked to dairy cow or poultry exposure. No human-to-human transmission confirmed. A fatal H5N5 case in Washington State in November 2025 was the first globally. No new cases reported in 2026. CDC risk to general public: low.',
    sourceUrl: 'https://www.cdc.gov/bird-flu/situation-summary/index.html',
    sourceName: 'CDC',
  },
  {
    disease: 'Measles',
    pathogen: 'Measles virus (genotype B3)',
    country: 'Ethiopia',
    subregion: 'Afar, Amhara, Oromia',
    cases: 45000,
    deaths: 520,
    trend: 'increasing',
    summary:
      'Ethiopia is experiencing one of its largest measles outbreaks in recent years, fueled by low vaccination coverage in remote communities, population displacement due to conflict, and disrupted health services. Children under 5 account for the majority of cases.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Measles',
    pathogen: 'Measles virus (genotype B3)',
    country: 'Somalia',
    subregion: 'Banadir, Bay, Mudug',
    cases: 18000,
    deaths: 350,
    trend: 'increasing',
    summary:
      'Measles continues to spread in Somalia, driven by one of the lowest routine immunization rates in the world (below 50%). Internally displaced populations in camps face particularly high risk. WHO and UNICEF are conducting emergency vaccination campaigns.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Typhoid Fever',
    pathogen: 'Salmonella Typhi (XDR strain)',
    country: 'Pakistan',
    subregion: 'Sindh Province',
    cases: 18000,
    deaths: 45,
    trend: 'stable',
    summary:
      'An extensively drug-resistant (XDR) typhoid strain first identified in Hyderabad, Pakistan has spread to multiple provinces. The strain is resistant to all first- and second-line antibiotics, leaving only azithromycin and carbapenems as treatment options. TCV vaccination campaigns are ongoing.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Tuberculosis (MDR-TB)',
    pathogen: 'Mycobacterium tuberculosis (MDR)',
    country: 'South Africa',
    subregion: 'KwaZulu-Natal, Gauteng, Eastern Cape',
    cases: 58000,
    deaths: 4200,
    trend: 'stable',
    summary:
      'South Africa has one of the world\'s highest burdens of drug-resistant TB, compounded by HIV co-infection rates exceeding 60% among TB patients. MDR-TB treatment requires 9-18 months of complex regimens. New bedaquiline-based regimens are improving outcomes but access remains uneven.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Tuberculosis (MDR-TB)',
    pathogen: 'Mycobacterium tuberculosis (MDR)',
    country: 'India',
    subregion: 'Maharashtra, Uttar Pradesh, Gujarat',
    cases: 130000,
    deaths: 9500,
    trend: 'stable',
    summary:
      'India carries the world\'s highest TB burden with approximately 2.8 million cases annually, of which ~130,000 are estimated to be multidrug-resistant. The National TB Elimination Programme targets elimination by 2025 but drug-resistant strains remain a major challenge.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Malaria',
    pathogen: 'Plasmodium falciparum',
    country: 'Nigeria',
    subregion: 'Nationwide',
    cases: 73000000,
    deaths: 189000,
    trend: 'stable',
    summary:
      'Nigeria accounts for 25.9% of global malaria cases and 30.9% of deaths — the highest burden of any country (WHO World Malaria Report 2025). An estimated 282 million cases and 610,000 deaths occurred globally in 2024. Children under 5 account for over 80% of deaths. Antimalarial drug resistance has been confirmed in at least 8 African countries.',
    sourceUrl: 'https://www.who.int/teams/global-malaria-programme',
    sourceName: 'WHO',
  },
  {
    disease: 'Lassa Fever',
    pathogen: 'Lassa virus',
    country: 'Nigeria',
    subregion: 'Ondo, Edo, Bauchi, Taraba, Benue States',
    cases: 1097,
    deaths: 201,
    trend: 'increasing',
    summary:
      'In 2025, NCDC recorded 9,164 suspected and 1,097 confirmed Lassa fever cases with 201 deaths (CFR 18.3%) across 21 states and 103 LGAs. By March 2026, cases continued rising during peak season across 18 states. No approved vaccine exists; the CFR (18.3%) is higher than 2024 (16.1%).',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Diphtheria',
    pathogen: 'Corynebacterium diphtheriae',
    country: 'Nigeria',
    subregion: 'Kano, Yobe, Borno and 27 other states',
    cases: 8587,
    deaths: 884,
    trend: 'stable',
    summary:
      'From January to November 2025, Nigeria reported 12,150 suspected diphtheria cases with 8,587 confirmed and 884 deaths (CFR 7.2%) across 240 LGAs in 30 states. The outbreak disproportionately affects children and adolescents, with more than 2 million children under-immunised nationwide.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Yellow Fever',
    pathogen: 'Yellow fever virus',
    country: 'Nigeria',
    subregion: 'North Central Nigeria',
    cases: 890,
    deaths: 145,
    trend: 'increasing',
    summary:
      'Yellow fever cases have re-emerged in northern Nigeria following gaps in vaccination coverage and increased Aedes mosquito activity. Emergency vaccination campaigns have been deployed targeting millions in affected states. The CFR remains elevated among unvaccinated adults.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIUM — Moderate or localized outbreaks
  // ═══════════════════════════════════════════════════════════════════════════

  {
    disease: 'Rift Valley Fever',
    pathogen: 'Rift Valley fever phlebovirus',
    country: 'Senegal',
    subregion: 'Multiple regions',
    cases: 358,
    deaths: 28,
    trend: 'increasing',
    summary:
      'After intense rainfall in September 2025, a major RVF outbreak emerged across Senegal and Mauritania. Senegal reported 358 confirmed human cases with 28 deaths (CFR 7.8%). Mauritania reported 46 confirmed cases with 14 deaths (CFR 30%). The outbreak severely affected both livestock and human populations.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'West Nile Virus',
    pathogen: 'West Nile virus (lineage 1)',
    country: 'United States',
    subregion: 'Texas, California, Arizona',
    cases: 2600,
    deaths: 110,
    trend: 'stable',
    summary:
      'West Nile virus activity is elevated across southern US states following warmer-than-average summers increasing Culex mosquito populations. Neuroinvasive disease — the most severe form affecting the brain and spinal cord — accounts for approximately 25% of cases.',
    sourceUrl: 'https://www.cdc.gov/west-nile-virus/data-maps/index.html',
    sourceName: 'CDC',
  },
  {
    disease: 'MERS-CoV',
    pathogen: 'Middle East Respiratory Syndrome Coronavirus',
    country: 'Saudi Arabia',
    subregion: 'Riyadh',
    cases: 2640,
    deaths: 960,
    trend: 'stable',
    summary:
      'MERS-CoV continues to cause sporadic cases in the Arabian Peninsula, primarily linked to dromedary camel exposure and healthcare settings. The case fatality rate remains around 35%, among the highest of any known coronavirus. No sustained community transmission has been documented.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Plague',
    pathogen: 'Yersinia pestis',
    country: 'Madagascar',
    subregion: 'Central Highlands',
    cases: 400,
    deaths: 30,
    trend: 'stable',
    summary:
      'Madagascar experiences annual plague outbreaks during the October–April season. Both bubonic and pneumonic forms are present. Rapid response with antibiotics is effective; the primary challenge is reaching remote highland communities in time.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Polio (cVDPV2)',
    pathogen: 'Circulating vaccine-derived poliovirus type 2',
    country: 'Somalia',
    subregion: 'South Central Somalia',
    cases: 48,
    deaths: 6,
    trend: 'stable',
    summary:
      'Circulating vaccine-derived poliovirus type 2 continues to circulate in parts of Somalia due to low oral polio vaccine coverage, compounded by ongoing conflict and population displacement limiting vaccine access. Emergency nOPV2 vaccination campaigns are underway.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Chikungunya',
    pathogen: 'Chikungunya virus',
    country: 'India',
    subregion: 'Karnataka, Kerala, Maharashtra',
    cases: 23000,
    deaths: 45,
    trend: 'stable',
    summary:
      'Chikungunya transmission recurs seasonally in India with urban outbreaks during and after monsoon season. The disease causes severe joint pain that can persist for months. No specific antiviral treatment exists; management is supportive.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Meningococcal Disease',
    pathogen: 'Neisseria meningitidis (serogroup C/W)',
    country: 'Niger',
    subregion: 'Niamey, Zinder, Maradi',
    cases: 2300,
    deaths: 234,
    trend: 'stable',
    summary:
      'Niger lies within the African "meningitis belt" and experiences seasonal epidemics during the dry season (January–June). Serogroup C and W are dominant. The introduction of the MenAfriVac conjugate vaccine has reduced serogroup A cases but other serogroups persist.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Leishmaniasis',
    pathogen: 'Leishmania tropica / L. major',
    country: 'Syria',
    subregion: 'Aleppo, Idlib, Deir ez-Zor',
    cases: 52000,
    deaths: 45,
    trend: 'increasing',
    summary:
      'Syria has become the global epicenter of cutaneous leishmaniasis, with cases surging dramatically since the civil war destroyed sanitation infrastructure and created rubble habitats for sandfly vectors. Displaced populations living in camps are at highest risk. Treatment access is severely limited.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Pertussis',
    pathogen: 'Bordetella pertussis',
    country: 'United Kingdom',
    subregion: 'England',
    cases: 14894,
    deaths: 11,
    trend: 'decreasing',
    summary:
      'England recorded 14,894 confirmed pertussis cases in 2024, the highest in decades, with 11 infant deaths. Cases dropped sharply in 2025 (~600 total through Q3). The 2024 surge followed pandemic-era disruptions to childhood vaccination; maternal vaccine uptake has since recovered to 72.9%.',
    sourceUrl: 'https://www.gov.uk/government/publications/pertussis-epidemiology-in-england-2024',
    sourceName: 'UKHSA',
  },
  {
    disease: 'Hepatitis A',
    pathogen: 'Hepatitis A virus',
    country: 'Philippines',
    subregion: 'Metro Manila, Davao',
    cases: 8900,
    deaths: 23,
    trend: 'stable',
    summary:
      'Hepatitis A outbreaks recur in the Philippines, linked to contaminated water sources and poor sanitation in densely populated urban areas. Flooding events exacerbate transmission. Vaccination is recommended but not part of the routine immunization program.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Nipah Virus',
    pathogen: 'Nipah virus (Bangladesh strain)',
    country: 'India',
    subregion: 'Kerala',
    cases: 24,
    deaths: 16,
    trend: 'decreasing',
    summary:
      'A cluster of Nipah virus cases was identified in Kerala following bat-to-human transmission. Kerala health authorities implemented rapid contact tracing, quarantine measures, and ring containment strategies. Nipah has a case fatality rate of 40-75% and no approved vaccine or treatment.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOW / Resolved — Smaller or concluded outbreaks (kept for historical record)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    disease: 'Ebola Virus Disease',
    pathogen: 'Ebola virus (Zaire strain)',
    country: 'Democratic Republic of Congo',
    subregion: 'Kasai Province (Bulape)',
    cases: 64,
    deaths: 45,
    trend: 'decreasing',
    summary:
      'The DRC\'s 16th Ebola outbreak began in August 2025 in Bulape Health Zone, Kasai province. WHO declared it over on December 1, 2025 after 42 days with no new cases. A total of 64 cases (53 confirmed, 11 probable) and 45 deaths (CFR 70.3%) were recorded. Over 47,500 people were vaccinated during the response.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news/item/2025-DON589',
    sourceName: 'WHO',
  },
  {
    disease: 'Marburg Virus Disease',
    pathogen: 'Marburg virus',
    country: 'Ethiopia',
    subregion: 'South Ethiopia Regional State (Jinka)',
    cases: 14,
    deaths: 9,
    trend: 'decreasing',
    summary:
      'Ethiopia confirmed its first-ever Marburg virus outbreak in November 2025 in Jinka town. As of mid-December 2025, 14 laboratory-confirmed cases and 9 deaths were reported. The fruit bat Rousettus aegyptiacus is the natural reservoir. Unlike Ebola, no approved vaccine exists for Marburg.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news/item/2025-DON585',
    sourceName: 'WHO',
  },
  {
    disease: 'Hantavirus Pulmonary Syndrome',
    pathogen: 'Andes virus',
    country: 'Argentina',
    subregion: 'Patagonia (Chubut, Río Negro)',
    cases: 92,
    deaths: 28,
    trend: 'stable',
    summary:
      'Sporadic hantavirus cases continue in Patagonian Argentina where the long-tailed colilargo mouse acts as the primary reservoir. Argentina is the only country where person-to-person transmission of Andes virus has been documented. Case fatality rate approximates 30%.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Mpox',
    pathogen: 'Monkeypox virus (Clade IIb)',
    country: 'Multiple Countries',
    subregion: 'Europe, Americas, Asia',
    cases: 98000,
    deaths: 180,
    trend: 'decreasing',
    summary:
      'The 2022 global mpox outbreak (Clade IIb) spread through close contact networks in over 100 countries. WHO declared a PHEIC in July 2022. Vaccination campaigns using JYNNEOS/Imvanex and improved public health measures drove case counts down significantly. Sporadic cases continue.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
  {
    disease: 'Avian Influenza H5N2',
    pathogen: 'Influenza A (H5N2)',
    country: 'Mexico',
    subregion: 'State of Mexico',
    cases: 1,
    deaths: 1,
    trend: 'stable',
    summary:
      'The first confirmed human case of H5N2 avian influenza was reported in Mexico in June 2024. The patient had no direct poultry exposure, and the source of infection remains under investigation. WHO assessed the global risk to the general public as low.',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    sourceName: 'WHO',
  },
];

async function main() {
  console.log('🌱 Seeding database with', SEED_OUTBREAKS.length, 'outbreaks…');

  let added = 0;
  let skipped = 0;

  for (const raw of SEED_OUTBREAKS) {
    const reportDate = new Date(
      Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000 // random within last 30 days
    );

    const dedupeKey = buildDedupeKey(raw.disease, raw.country, reportDate);
    const severity = classifySeverity(raw.cases, raw.deaths);
    const region = raw.region || getRegionForCountry(raw.country);
    const coords = getCountryCoords(raw.country);

    const summary = raw.summary || generateSummary({
      ...raw,
      region,
      reportDate,
    } as ScrapedOutbreak);

    try {
      await prisma.outbreak.upsert({
        where: { dedupeKey },
        create: {
          disease: raw.disease,
          pathogen: raw.pathogen ?? null,
          country: raw.country,
          region,
          subregion: raw.subregion ?? null,
          verified: raw.verified ?? true,
          language: raw.language ?? 'en',
          titleOrig: raw.titleOrig ?? null,
          lat: coords ? coords[0] : null,
          lng: coords ? coords[1] : null,
          cases: raw.cases,
          deaths: raw.deaths,
          recovered: raw.recovered ?? 0,
          severity,
          summary,
          trend: raw.trend ?? null,
          sourceUrl: raw.sourceUrl,
          sourceName: raw.sourceName,
          isActive: true,
          dedupeKey,
          reportDate,
        },
        update: {
          cases: raw.cases,
          deaths: raw.deaths,
          severity,
          summary,
        },
      });
      console.log(`  ✓ ${raw.disease} — ${raw.country} [${severity}]`);
      added++;
    } catch (err) {
      console.error(`  ✗ Failed: ${raw.disease} — ${raw.country}:`, err);
      skipped++;
    }
  }

  console.log(`\n✅ Done: ${added} outbreaks added/updated, ${skipped} skipped`);

  // Summary breakdown
  const critCount = SEED_OUTBREAKS.filter(o => classifySeverity(o.cases, o.deaths) === 'CRITICAL').length;
  const highCount = SEED_OUTBREAKS.filter(o => classifySeverity(o.cases, o.deaths) === 'HIGH').length;
  const medCount = SEED_OUTBREAKS.filter(o => classifySeverity(o.cases, o.deaths) === 'MEDIUM').length;
  const lowCount = SEED_OUTBREAKS.filter(o => classifySeverity(o.cases, o.deaths) === 'LOW').length;
  console.log(`\n📊 Summary:`);
  console.log(`   Critical: ${critCount}`);
  console.log(`   High:     ${highCount}`);
  console.log(`   Medium:   ${medCount}`);
  console.log(`   Low:      ${lowCount}`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
