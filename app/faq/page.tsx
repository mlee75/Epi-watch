import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Methodology and FAQ | Epi-watch',
  description:
    'Where Epi-watch data comes from, what "verified" means, how the travel score works, and what the numbers do and do not tell you.',
};

interface QA {
  q: string;
  a: React.ReactNode;
}

const SECTIONS: { heading: string; items: QA[] }[] = [
  {
    heading: 'The data',
    items: [
      {
        q: 'Where does the outbreak data come from?',
        a: (
          <>
            Two paths. A curated seed set of 39 records compiled from WHO, CDC, PAHO,
            UKHSA and UNICEF reporting, and a daily automated ingest at 06:00 UTC that
            reads the CDC outbreaks feed, Outbreak News Today, and a Google News outbreak
            query. Automatically ingested records are labelled{' '}
            <strong>Automated</strong> in tables and &ldquo;Automated, not reviewed&rdquo; in
            record details.
          </>
        ),
      },
      {
        q: 'Where do the symptom descriptions come from?',
        a: (
          <>
            Each disease page summarises the WHO fact sheet (or the CDC page where WHO has none), linked beside it:
            cause, main symptoms, how it spreads and the incubation period. It is general information, not medical
            advice.
          </>
        ),
      },
      {
        q: 'What is the difference between Curated and Automated records?',
        a: (
          <>
            That the record came from the automated ingest and no human has checked it. It
            is a real published report, but the disease, country and figures were extracted
            from a headline by software, which can be wrong. Curated records were entered
            from agency reporting. Neither label is an independent verification.
          </>
        ),
      },
      {
        q: 'Why do some outbreaks show a dash instead of a case count?',
        a: (
          <>
            Because the source did not state a number. A dash means{' '}
            <strong>unreported</strong>, not zero. Counts are only ever read from a
            source&rsquo;s own headline — if the headline gives no figure, we record none
            rather than estimating one.
          </>
        ),
      },
      {
        q: 'How current is the data?',
        a: (
          <>
            The ingest runs daily at 06:00 UTC, and the header shows when data was last
            updated. An automated health check runs every day at 08:00 UTC and flags it if
            an ingestion cycle is missed.
          </>
        ),
      },
      {
        q: 'How is severity decided?',
        a: (
          <>
            Purely from reported case and death counts: CRITICAL above 10,000 cases or
            1,000 deaths, HIGH above 1,000 or 100, MEDIUM above 100 or 10, LOW at or below
            those. It is a mechanical threshold, not an epidemiological judgement, and an
            outbreak with no reported figures will show as LOW regardless of how serious it
            is.
          </>
        ),
      },
      {
        q: 'Is each record a separate outbreak?',
        a: (
          <>
            Not necessarily. A record is one published report. The automated ingest can
            create a new record each day a story about the same event is published, and it
            does not yet merge spellings of the same country (for example
            &ldquo;DRC&rdquo; and &ldquo;Democratic Republic of Congo&rdquo;). Counts on the
            overview are counts of records, and should be read that way.
          </>
        ),
      },
      {
        q: 'What do the publisher types on the news page mean?',
        a: (
          <>
            They describe who published an article, judged from the publisher&rsquo;s name:
            Health agency (for example WHO, CDC, a ministry of health), Field organisation
            (for example ProMED, MSF, ReliefWeb) and Media (everything else). A news article
            that quotes WHO is still Media.
          </>
        ),
      },
    ],
  },
  {
    heading: 'Live map',
    items: [
      {
        q: 'How are air ambulances found?',
        a: (
          <>
            From ADS-B, the position signal aircraft broadcast, via the community network adsb.lol (refreshed every
            30 seconds). An aircraft is shown as an air ambulance if its registered operator is an air-medical
            service (about 1,400 aircraft, mostly in the US and Australia), if it flies under a known rescue callsign
            (UK Helimed, German &ldquo;Christoph&rdquo;, Swiss Rega, French SAMU) or if the crew has set the
            &ldquo;lifeguard&rdquo; medical-flight status. Search-and-rescue aircraft are identified by callsign.
            Coverage follows volunteer receivers: dense in North America and Europe, sparse elsewhere. Between
            reports, positions are estimated from speed and heading, and the aircraft card says so.
          </>
        ),
      },
      {
        q: 'Are any aircraft deliberately left out?',
        a: (
          <>
            Yes. Aircraft whose owners have asked not to be publicly tracked (the FAA LADD and PIA programmes) are
            excluded, even though their signals are public.
          </>
        ),
      },
      {
        q: 'Where do accidents and medical calls come from?',
        a: (
          <>
            From the Seattle Fire Department&rsquo;s real-time 911 feed, which gives the address of every medical
            call, collision and rescue within minutes. Very few emergency services publish dispatch data openly, so
            street-level incidents are shown for Seattle only. Disasters (earthquakes, cyclones, floods, volcanoes,
            wildfires) come from GDACS, run by the UN and the European Commission, and aircraft declaring an
            emergency (squawk 7700) from adsb.fi.
          </>
        ),
      },
      {
        q: 'Is there live video of emergency operations?',
        a: (
          <>
            No public source streams emergency operations. For street-level incidents the map shows the nearest
            public traffic cameras (Transport for London video clips, Seattle still images, refreshed every minute or
            few minutes). They show the street near the address, which may or may not include the incident.
          </>
        ),
      },
      {
        q: 'What do the colours for rising and falling figures mean?',
        a: (
          <>
            Everywhere a figure is compared with an earlier one, a red ▲ marks an increase, a blue ▼ a decrease and a
            grey → a change within ±5%. The arrow and the signed percentage are always shown, so the colour is never
            the only cue; red and blue were chosen because they stay distinct with colour-blindness.
          </>
        ),
      },
    ],
  },
  {
    heading: 'Alerts and hospital data',
    items: [
      {
        q: 'Where do the official alerts come from?',
        a: (
          <>
            International agencies&rsquo; own feeds and APIs: WHO Disease Outbreak News, ECDC news and weekly
            threat reports, PAHO, WHO Africa, WHO news, CDC travel notices and UKHSA. For about 28 national
            health authorities that publish no usable feed, Epi-watch searches Google News restricted to the
            authority&rsquo;s own website, in its own language, and keeps an item only if its publisher is on
            that website and its title names a disease or outbreak. The list is refreshed every 30 minutes.
          </>
        ),
      },
      {
        q: 'Are alerts translated?',
        a: (
          <>
            Titles are shown in their original language. When an Anthropic API key is configured, non-English
            titles are also machine-translated and marked as translated; the original stays visible underneath.
            Without a key, no translation is shown.
          </>
        ),
      },
      {
        q: 'Where does the hospital admissions data come from, and how live is it?',
        a: (
          <>
            Three public surveillance systems, read every hour: WHO FluID (severe acute respiratory infection
            admissions at sentinel hospitals in about 90 countries, weekly), CDC NHSN (US admissions for COVID-19,
            influenza and RSV and bed occupancy, weekly, national and by state) and the UKHSA data dashboard
            (England). These systems publish with a lag of one to three weeks, so the newest week shown is the
            newest week published, not today. Recent weeks can still be revised.
          </>
        ),
      },
      {
        q: 'Can I compare SARI numbers between countries?',
        a: (
          <>
            No. Each country reports from its own set of sentinel hospitals, which differ in number and size.
            Compare a country with its own previous weeks. That is why the table shows change against the prior
            four-week mean, and only when that mean is at least 10 cases.
          </>
        ),
      },
      {
        q: 'Does Epi-watch track health-worker movements?',
        a: (
          <>
            It tracks reported events: deployments of response teams, health-worker infections, strikes and
            staffing shortages, found by keyword in agency notices and in a news search, under &ldquo;Response
            and workforce&rdquo; on the alerts page. It does not track where individual health workers are. No
            public source publishes that, and following named individuals would raise serious privacy issues.
          </>
        ),
      },
    ],
  },
  {
    heading: 'Video and live TV',
    items: [
      {
        q: 'How are videos chosen?',
        a: (
          <>
            Only channels on a fixed list are collected, and every channel on that list
            belongs to a named health agency or news organisation. It attests to <strong>who published it</strong> — it is
            not a fact-check of the contents. Nothing is pulled from open search.
          </>
        ),
      },
      {
        q: 'What is the difference between the Agency and News labels?',
        a: (
          <>
            Agency means a public health body such as WHO, CDC or PAHO — official
            guidance. News means an established newsroom such as Reuters or Al Jazeera —
            journalism, not guidance. They are kept visibly separate so a news segment is
            never mistaken for an official position.
          </>
        ),
      },
      {
        q: 'Is the live TV panel showing outbreak coverage?',
        a: (
          <>
            No. Those are general regional news channels, streaming whatever they happen to
            be broadcasting. A stream may also be off air. It is context, not outbreak
            reporting.
          </>
        ),
      },
    ],
  },
  {
    heading: 'The travel risk tool',
    items: [
      {
        q: 'Is the travel risk score medical advice?',
        a: (
          <>
            <strong>No.</strong> It is a rough orientation tool. Consult a clinician or
            travel health clinic before travelling, and check the current CDC travel health
            notices and WHO outbreak news for your destination.
          </>
        ),
      },
      {
        q: 'Are the healthcare and advisory numbers from CDC or WHO?',
        a: (
          <>
            No, and this is important. The country baseline figures — healthcare quality,
            advisory tier, malaria and dengue risk — are{' '}
            <strong>Epi-watch&rsquo;s own static estimates</strong>, hand-maintained and
            undated. They are labelled as estimates in the interface. Only the outbreak
            counts feeding the score are live. For real advisory levels, go to CDC and WHO
            directly.
          </>
        ),
      },
      {
        q: 'Do you store what I enter into the travel tool?',
        a: (
          <>
            No. Age, pregnancy status, chronic conditions and vaccination status are used
            to compute one score and then discarded. Nothing is written to the database or
            linked to your account.
          </>
        ),
      },
    ],
  },
  {
    heading: 'Accounts and privacy',
    items: [
      {
        q: 'Do I need an account?',
        a: (
          <>
            No. The globe, outbreak feed, news, video and travel tool all work fully
            without one. Accounts are there for a saved watchlist of diseases and countries,
            which is not built yet.
          </>
        ),
      },
      {
        q: 'How are passwords stored?',
        a: (
          <>
            As a bcrypt hash with a per-password salt, never as readable text. We cannot
            see or recover your password. If you sign in with Google, no password is stored
            at all.
          </>
        ),
      },
      {
        q: 'Do you track me or sell data?',
        a: (
          <>
            No advertising, no analytics trackers, no cross-site tracking, and nothing is
            sold. See the <Link href="/privacy">Privacy Policy</Link> and{' '}
            <Link href="/cookies">Cookie Policy</Link>.
          </>
        ),
      },
      {
        q: 'How do I delete my account?',
        a: (
          <>
            Sign in and go to your <Link href="/account">account page</Link>. Deletion is
            immediate and permanent — it removes your record, sign-in methods and
            watchlist, and we keep no backup copy.
          </>
        ),
      },
    ],
  },
  {
    heading: 'Using Epi-watch',
    items: [
      {
        q: 'Can I use this to make health or travel decisions?',
        a: (
          <>
            Not on its own. Epi-watch aggregates public reporting and is not a substitute
            for official guidance. For anything that affects your health or travel, consult
            WHO, CDC, or your national health authority.
          </>
        ),
      },
      {
        q: 'Is there an API?',
        a: (
          <>
            Yes — read-only JSON endpoints under <code>/api</code>, documented in the{' '}
            <a href="https://github.com/mlee75/Epi-watch#api-reference" target="_blank" rel="noopener noreferrer">
              README
            </a>
            . There is no authentication or rate limit on the public read endpoints; please
            be reasonable.
          </>
        ),
      },
      {
        q: 'I found a mistake in the data.',
        a: (
          <>
            Please report it at{' '}
            <a href="https://github.com/mlee75/Epi-watch/issues" target="_blank" rel="noopener noreferrer">
              github.com/mlee75/Epi-watch/issues
            </a>
            . Corrections to automatically ingested records are especially useful.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <article className="page legal legal-page">
          <header className="page-head">
            <h1 className="page-title">Methodology and FAQ</h1>
            <p className="page-lede">
              What the data is, where it comes from, and what it does not tell you.
            </p>
          </header>

          {SECTIONS.map((section) => (
            <section key={section.heading} style={{ marginBottom: 36 }}>
              <h2>{section.heading}</h2>
              {section.items.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <div>{item.a}</div>
                </details>
              ))}
            </section>
          ))}
        </article>
      </main>
      <Footer />
    </div>
  );
}
