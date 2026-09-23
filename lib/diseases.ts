/**
 * Reference information for the diseases that appear in outbreak records, and
 * the mapping from the names the ingest produces ("Ebola", "Ebola Virus
 * Disease", "Dengue Fever") to one canonical disease.
 *
 * Symptom, transmission and incubation text is a short summary of the linked
 * WHO or CDC fact sheet. It is general information, not medical advice, and
 * the page says so.
 */

export interface DiseaseInfo {
  key: string;
  name: string;
  /** Pathogen group, e.g. "Virus (filovirus)". */
  agent: string;
  symptoms: string;
  transmission: string;
  incubation: string;
  source: { name: string; url: string };
}

const WHO = 'https://www.who.int/news-room/fact-sheets/detail';

export const DISEASES: DiseaseInfo[] = [
  {
    key: 'ebola', name: 'Ebola disease', agent: 'Virus (orthoebolavirus: Zaire, Sudan, Bundibugyo)',
    symptoms: 'Sudden fever, fatigue, muscle pain, headache and sore throat, followed by vomiting, diarrhoea, rash and, in some cases, internal and external bleeding.',
    transmission: 'Direct contact with the blood or body fluids of infected people or animals, or with materials contaminated by them.',
    incubation: '2 to 21 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/ebola-disease` },
  },
  {
    key: 'marburg', name: 'Marburg virus disease', agent: 'Virus (filovirus)',
    symptoms: 'Sudden high fever, severe headache and malaise, muscle aches; watery diarrhoea, abdominal pain and vomiting from about day 3; severe bleeding in many cases.',
    transmission: 'Contact with body fluids of infected people; initial infection from prolonged exposure to Rousettus fruit-bat colonies in mines or caves.',
    incubation: '2 to 21 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/marburg-virus-disease` },
  },
  {
    key: 'measles', name: 'Measles', agent: 'Virus (morbillivirus)',
    symptoms: 'High fever, cough, runny nose and red, watery eyes, followed by a rash that starts on the face and spreads down the body.',
    transmission: 'Airborne: breathing, coughing or sneezing. One of the most contagious diseases; preventable by vaccination.',
    incubation: '7 to 21 days, typically 10 to 14',
    source: { name: 'WHO fact sheet', url: `${WHO}/measles` },
  },
  {
    key: 'cholera', name: 'Cholera', agent: 'Bacterium (Vibrio cholerae)',
    symptoms: 'Acute watery diarrhoea, which can cause severe dehydration and death within hours if untreated. Most infected people have mild or no symptoms.',
    transmission: 'Eating food or drinking water contaminated with the bacterium.',
    incubation: '12 hours to 5 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/cholera` },
  },
  {
    key: 'mpox', name: 'Mpox', agent: 'Virus (orthopoxvirus)',
    symptoms: 'A rash of skin lesions, often with fever, sore throat, headache, muscle aches, back pain, low energy and swollen lymph nodes.',
    transmission: 'Close contact with an infected person (including skin-to-skin and sexual contact), contaminated materials or infected animals.',
    incubation: '1 to 21 days, usually within a week',
    source: { name: 'WHO fact sheet', url: `${WHO}/mpox` },
  },
  {
    key: 'yellow-fever', name: 'Yellow fever', agent: 'Virus (flavivirus)',
    symptoms: 'Fever, muscle pain (especially back), headache, loss of appetite and nausea. A small proportion develop severe disease with jaundice and bleeding.',
    transmission: 'Bites of infected Aedes and Haemagogus mosquitoes. Preventable by a single vaccine dose.',
    incubation: '3 to 6 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/yellow-fever` },
  },
  {
    key: 'malaria', name: 'Malaria', agent: 'Parasite (Plasmodium)',
    symptoms: 'Fever, headache and chills. P. falciparum malaria can progress to severe illness and death within 24 hours if untreated.',
    transmission: 'Bites of infected female Anopheles mosquitoes.',
    incubation: 'Usually 10 to 15 days after the bite',
    source: { name: 'WHO fact sheet', url: `${WHO}/malaria` },
  },
  {
    key: 'dengue', name: 'Dengue', agent: 'Virus (flavivirus)',
    symptoms: 'Most infections are mild. High fever with severe headache, pain behind the eyes, muscle and joint pain, nausea, vomiting and rash. Warning signs of severe dengue include severe abdominal pain, persistent vomiting and bleeding gums or nose.',
    transmission: 'Bites of infected Aedes mosquitoes.',
    incubation: '4 to 10 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/dengue-and-severe-dengue` },
  },
  {
    key: 'chikungunya', name: 'Chikungunya', agent: 'Virus (alphavirus)',
    symptoms: 'Sudden fever and severe, often debilitating joint pain, with muscle pain, headache, fatigue and rash. Joint pain can last months.',
    transmission: 'Bites of infected Aedes mosquitoes.',
    incubation: '4 to 8 days (range 2 to 12)',
    source: { name: 'WHO fact sheet', url: `${WHO}/chikungunya` },
  },
  {
    key: 'oropouche', name: 'Oropouche virus disease', agent: 'Virus (orthobunyavirus)',
    symptoms: 'Sudden fever, headache, muscle and joint pain and chills, sometimes nausea, vomiting or rash. Symptoms can return days after they ease.',
    transmission: 'Bites of infected midges (mainly Culicoides paraensis) and some mosquitoes.',
    incubation: '3 to 10 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/oropouche-virus-disease` },
  },
  {
    key: 'west-nile', name: 'West Nile virus', agent: 'Virus (flavivirus)',
    symptoms: 'About 80% of infections cause no symptoms. Otherwise fever, headache, tiredness, body aches and nausea; fewer than 1% develop severe neurological disease.',
    transmission: 'Bites of infected Culex mosquitoes.',
    incubation: '3 to 14 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/west-nile-virus` },
  },
  {
    key: 'rift-valley-fever', name: 'Rift Valley fever', agent: 'Virus (phlebovirus)',
    symptoms: 'Usually mild: fever, weakness, back pain and dizziness. A small proportion develop eye disease, encephalitis or haemorrhagic fever.',
    transmission: 'Contact with blood or organs of infected animals, or bites of infected mosquitoes.',
    incubation: '2 to 6 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/rift-valley-fever` },
  },
  {
    key: 'avian-influenza', name: 'Avian influenza (H5N1, H5N2 and others)', agent: 'Virus (influenza A)',
    symptoms: 'In people, from conjunctivitis and mild flu-like illness (fever, cough, sore throat, muscle aches) to severe pneumonia.',
    transmission: 'Contact with infected birds or animals (including dairy cattle) or contaminated environments. Human-to-human spread is rare.',
    incubation: 'Usually 2 to 5 days, up to 17',
    source: { name: 'WHO fact sheet', url: `${WHO}/influenza-(avian-and-other-zoonotic)` },
  },
  {
    key: 'mers', name: 'MERS', agent: 'Virus (coronavirus)',
    symptoms: 'Fever, cough and shortness of breath; pneumonia is common and gastrointestinal symptoms occur. About a third of reported cases have died.',
    transmission: 'Contact with dromedary camels; limited person-to-person spread, mainly in health-care settings.',
    incubation: '2 to 14 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/middle-east-respiratory-syndrome-coronavirus-(mers-cov)` },
  },
  {
    key: 'nipah', name: 'Nipah virus infection', agent: 'Virus (henipavirus)',
    symptoms: 'From no symptoms to acute respiratory infection and fatal encephalitis: fever, headache, muscle pain, vomiting and sore throat, then drowsiness and altered consciousness.',
    transmission: 'Infected fruit bats or pigs, food contaminated by bats (such as raw date-palm sap), and close contact with infected people.',
    incubation: '4 to 14 days, occasionally up to 45',
    source: { name: 'WHO fact sheet', url: `${WHO}/nipah-virus` },
  },
  {
    key: 'lassa', name: 'Lassa fever', agent: 'Virus (arenavirus)',
    symptoms: 'Usually mild. Gradual fever, weakness and malaise, then headache, sore throat, muscle and chest pain, vomiting and diarrhoea; severe cases have facial swelling, bleeding and shock. Deafness can follow.',
    transmission: 'Food or household items contaminated by rodent urine or faeces; also person-to-person through body fluids.',
    incubation: '2 to 21 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/lassa-fever` },
  },
  {
    key: 'hantavirus', name: 'Hantavirus disease', agent: 'Virus (orthohantavirus)',
    symptoms: 'In the Americas, hantavirus pulmonary syndrome: fatigue, fever and muscle aches, then cough and shortness of breath as the lungs fill with fluid. In Europe and Asia, haemorrhagic fever with kidney involvement.',
    transmission: 'Breathing in dust contaminated with infected rodent urine or droppings. Andes virus can also spread between people.',
    incubation: '1 to 8 weeks',
    source: { name: 'WHO fact sheet', url: `${WHO}/hantavirus` },
  },
  {
    key: 'plague', name: 'Plague', agent: 'Bacterium (Yersinia pestis)',
    symptoms: 'Bubonic: sudden fever, chills, headache, body aches and painful swollen lymph nodes. Pneumonic: severe, rapidly progressing pneumonia.',
    transmission: 'Bites of infected fleas, contact with infected animals, and respiratory droplets for pneumonic plague.',
    incubation: 'Bubonic 3 to 7 days; pneumonic can be as short as 24 hours',
    source: { name: 'WHO fact sheet', url: `${WHO}/plague` },
  },
  {
    key: 'anthrax', name: 'Anthrax', agent: 'Bacterium (Bacillus anthracis)',
    symptoms: 'Depends on route: a painless skin sore with a black centre; flu-like illness progressing to severe breathing problems; or nausea, vomiting and bloody diarrhoea.',
    transmission: 'Contact with infected animals or animal products, or their spores. Not usually spread between people.',
    incubation: 'About 1 to 7 days; inhalational up to 60 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/anthrax` },
  },
  {
    key: 'diphtheria', name: 'Diphtheria', agent: 'Bacterium (Corynebacterium diphtheriae)',
    symptoms: 'Sore throat, fever, swollen neck glands and weakness, with a thick grey coating in the throat. The toxin can damage the heart and nerves.',
    transmission: 'Respiratory droplets and close contact. Preventable by vaccination.',
    incubation: '2 to 5 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/diphtheria` },
  },
  {
    key: 'pertussis', name: 'Pertussis (whooping cough)', agent: 'Bacterium (Bordetella pertussis)',
    symptoms: 'Starts like a cold; after one to two weeks, severe coughing fits, a "whoop" on breathing in, and vomiting after coughing. Infants may stop breathing.',
    transmission: 'Respiratory droplets. Preventable by vaccination.',
    incubation: '7 to 10 days (range 5 to 21)',
    source: { name: 'WHO fact sheet', url: `${WHO}/pertussis` },
  },
  {
    key: 'meningococcal', name: 'Meningococcal disease', agent: 'Bacterium (Neisseria meningitidis)',
    symptoms: 'Sudden fever, headache, stiff neck, vomiting, sensitivity to light and confusion; bloodstream infection causes a rash that does not fade under pressure. Can kill within hours.',
    transmission: 'Respiratory droplets and close contact.',
    incubation: '2 to 10 days, average 4',
    source: { name: 'WHO fact sheet (meningitis)', url: `${WHO}/meningitis` },
  },
  {
    key: 'polio', name: 'Polio (including vaccine-derived poliovirus)', agent: 'Virus (enterovirus)',
    symptoms: 'Most infections cause no symptoms. About 1 in 200 leads to irreversible paralysis, usually of the legs.',
    transmission: 'Faecal-oral. Circulating vaccine-derived poliovirus (cVDPV) emerges where vaccination coverage is low.',
    incubation: '7 to 10 days (range 3 to 35)',
    source: { name: 'WHO fact sheet', url: `${WHO}/poliomyelitis` },
  },
  {
    key: 'tuberculosis', name: 'Tuberculosis (including drug-resistant TB)', agent: 'Bacterium (Mycobacterium tuberculosis)',
    symptoms: 'Prolonged cough (sometimes with blood), chest pain, weakness, weight loss, fever and night sweats. MDR-TB is resistant to the two main drugs, isoniazid and rifampicin.',
    transmission: 'Airborne, from people with active lung TB.',
    incubation: 'Weeks to years; most infections stay latent',
    source: { name: 'WHO fact sheet', url: `${WHO}/tuberculosis` },
  },
  {
    key: 'hepatitis-a', name: 'Hepatitis A', agent: 'Virus (hepatovirus)',
    symptoms: 'Fever, malaise, loss of appetite, nausea, abdominal discomfort, dark urine and jaundice.',
    transmission: 'Faecal-oral: contaminated food or water, or close contact. Preventable by vaccination.',
    incubation: '14 to 28 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/hepatitis-a` },
  },
  {
    key: 'typhoid', name: 'Typhoid fever', agent: 'Bacterium (Salmonella Typhi)',
    symptoms: 'Prolonged high fever, fatigue, headache, nausea, abdominal pain and constipation or diarrhoea; some have a rash.',
    transmission: 'Contaminated food or water.',
    incubation: '6 to 30 days',
    source: { name: 'WHO fact sheet', url: `${WHO}/typhoid` },
  },
  {
    key: 'salmonella', name: 'Salmonellosis', agent: 'Bacterium (non-typhoidal Salmonella)',
    symptoms: 'Diarrhoea, fever, abdominal cramps and sometimes vomiting.',
    transmission: 'Contaminated food (eggs, poultry, produce) and contact with infected animals.',
    incubation: '6 to 72 hours',
    source: { name: 'WHO fact sheet', url: `${WHO}/salmonella-(non-typhoidal)` },
  },
  {
    key: 'e-coli', name: 'E. coli infection (STEC)', agent: 'Bacterium (Shiga toxin-producing E. coli)',
    symptoms: 'Stomach cramps and diarrhoea, often bloody, sometimes vomiting. Some patients, mainly children, develop haemolytic uraemic syndrome.',
    transmission: 'Contaminated food (undercooked meat, raw milk, fresh produce) or water.',
    incubation: '3 to 8 days, usually 3 to 4',
    source: { name: 'WHO fact sheet', url: `${WHO}/e-coli` },
  },
  {
    key: 'cyclospora', name: 'Cyclosporiasis', agent: 'Parasite (Cyclospora cayetanensis)',
    symptoms: 'Watery diarrhoea with frequent bowel movements, loss of appetite, weight loss, cramps, bloating and fatigue.',
    transmission: 'Food or water contaminated with faeces, often imported fresh produce.',
    incubation: 'About 1 week',
    source: { name: 'CDC', url: 'https://www.cdc.gov/cyclosporiasis/about/index.html' },
  },
  {
    key: 'legionnaires', name: "Legionnaires' disease", agent: 'Bacterium (Legionella)',
    symptoms: 'Pneumonia: cough, shortness of breath, fever, muscle aches and headache.',
    transmission: 'Breathing in water droplets containing the bacteria, from cooling towers, hot tubs or building plumbing. Not usually spread between people.',
    incubation: '2 to 10 days, up to 16',
    source: { name: 'WHO fact sheet', url: `${WHO}/legionellosis` },
  },
  {
    key: 'leishmaniasis', name: 'Leishmaniasis', agent: 'Parasite (Leishmania)',
    symptoms: 'Cutaneous: skin sores and ulcers. Visceral (kala-azar): prolonged fever, weight loss, enlarged spleen and liver and anaemia; fatal in most cases if untreated.',
    transmission: 'Bites of infected female sandflies.',
    incubation: 'Weeks to months',
    source: { name: 'WHO fact sheet', url: `${WHO}/leishmaniasis` },
  },
  {
    key: 'screwworm', name: 'New World screwworm myiasis', agent: 'Parasite (Cochliomyia hominivorax fly larvae)',
    symptoms: 'Painful, bleeding wounds or body openings with visible maggots feeding on living tissue. Mostly affects animals; people are infected occasionally.',
    transmission: 'The fly lays eggs in open wounds and in the eyes, ears, nose or mouth.',
    incubation: 'Larvae hatch within about a day of eggs being laid',
    source: { name: 'CDC', url: 'https://www.cdc.gov/new-world-screwworm/about/index.html' },
  },
];

const BY_KEY = new Map(DISEASES.map((d) => [d.key, d]));

// Ordered: first match wins.
const MATCHERS: [RegExp, string][] = [
  [/ebola|bundibugyo/i, 'ebola'],
  [/marburg/i, 'marburg'],
  [/measles/i, 'measles'],
  [/cholera/i, 'cholera'],
  [/mpox|monkeypox/i, 'mpox'],
  [/yellow fever/i, 'yellow-fever'],
  [/malaria/i, 'malaria'],
  [/dengue/i, 'dengue'],
  [/chikungunya/i, 'chikungunya'],
  [/oropouche/i, 'oropouche'],
  [/west nile/i, 'west-nile'],
  [/rift valley/i, 'rift-valley-fever'],
  [/avian|h5n\d|bird flu/i, 'avian-influenza'],
  [/mers/i, 'mers'],
  [/nipah/i, 'nipah'],
  [/lassa/i, 'lassa'],
  [/hanta/i, 'hantavirus'],
  [/plague/i, 'plague'],
  [/anthrax/i, 'anthrax'],
  [/diphtheria/i, 'diphtheria'],
  [/pertussis|whooping/i, 'pertussis'],
  [/meningococ|meningitis/i, 'meningococcal'],
  [/polio|cvdpv/i, 'polio'],
  [/tubercul|\btb\b/i, 'tuberculosis'],
  [/hepatitis a/i, 'hepatitis-a'],
  [/typhoid/i, 'typhoid'],
  [/salmonell/i, 'salmonella'],
  [/e\.? ?coli|stec/i, 'e-coli'],
  [/cyclospor/i, 'cyclospora'],
  [/legionn?|legionell/i, 'legionnaires'],
  [/leishmani/i, 'leishmaniasis'],
  [/screwworm/i, 'screwworm'],
];

export const UNSPECIFIED_KEY = 'unspecified';

/** Canonical disease key for a record's disease name. */
export function diseaseKey(name: string): string {
  for (const [re, key] of MATCHERS) if (re.test(name)) return key;
  return UNSPECIFIED_KEY;
}

export function diseaseInfo(key: string): DiseaseInfo | null {
  return BY_KEY.get(key) ?? null;
}

export function diseaseName(key: string): string {
  return BY_KEY.get(key)?.name ?? 'Unclassified (disease not identified from headline)';
}

// ─── Country names ───────────────────────────────────────────────────────────

const COUNTRY_ALIAS: Record<string, string> = {
  DRC: 'Democratic Republic of the Congo',
  'DR Congo': 'Democratic Republic of the Congo',
  'Democratic Republic of Congo': 'Democratic Republic of the Congo',
  USA: 'United States',
  US: 'United States',
  'United States of America': 'United States',
  UK: 'United Kingdom',
};

/**
 * Display-level country name. "Congo" alone is ambiguous between two
 * countries; in the current records it only appears on Ebola stories about
 * the DRC, so it is resolved for Ebola and left as written otherwise.
 */
export function canonicalCountry(country: string, disease?: string): string {
  if (COUNTRY_ALIAS[country]) return COUNTRY_ALIAS[country];
  if (country === 'Congo' && disease && /ebola|bundibugyo/i.test(disease)) return 'Democratic Republic of the Congo';
  return country;
}
