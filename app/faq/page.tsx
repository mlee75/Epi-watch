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
