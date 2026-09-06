import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'FAQ | EPI-WATCH',
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
            query. Automatically ingested records are flagged{' '}
            <strong>UNVERIFIED</strong> in the interface.
          </>
        ),
      },
      {
        q: 'What does the UNVERIFIED badge mean?',
        a: (
          <>
            That the record came from the automated ingest and no human has checked it. It
            is a real published report, but the disease, country and figures were extracted
            from a headline by software, which can be wrong. Records without the badge come
            from the curated set.
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
            The ingest runs daily at 06:00 UTC, and the stats bar shows when data was last
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
    ],
  },
  {
    heading: 'Video and live TV',
    items: [
      {
        q: 'What does "verified video" actually mean?',
        a: (
          <>
            One narrow thing: the video was published by a channel on an explicit
            allowlist, and every channel on that list belongs to a named health authority
            or news organisation. It attests to <strong>who published it</strong> — it is
            not a fact-check of the contents. Nothing is pulled from open search.
          </>
        ),
      },
      {
        q: 'What is the difference between the OFFICIAL and NEWS badges?',
        a: (
          <>
            OFFICIAL means a public health body such as WHO, CDC or PAHO — official
            guidance. NEWS means an established newsroom such as Reuters or Al Jazeera —
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
            without one. An account only adds a saved watchlist.
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
            Open an issue at{' '}
            <a href="https://github.com/mlee75/Epi-watch/issues" target="_blank" rel="noopener noreferrer">
              github.com/mlee75/Epi-watch
            </a>{' '}
            from the email address on the account, and we will delete it and its watchlist.
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
      <main className="pt-14">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14 legal">
          <h1 className="text-4xl font-bold mb-3">Frequently Asked Questions</h1>
          <p style={{ color: '#a0a8c8', marginBottom: 32, lineHeight: 1.7 }}>
            What the data is, where it comes from, and — just as importantly — what it does
            not tell you.
          </p>

          {SECTIONS.map((section) => (
            <section key={section.heading} className="mb-10">
              <h2>{section.heading}</h2>
              {section.items.map((item) => (
                <details
                  key={item.q}
                  className="rounded-lg mb-2"
                  style={{ background: '#0d1129', border: '1px solid #1e2749' }}
                >
                  <summary
                    className="px-4 py-3"
                    style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#e8ecf8' }}
                  >
                    {item.q}
                  </summary>
                  <div
                    className="px-4 pb-4"
                    style={{ fontSize: 13.5, color: '#a0a8c8', lineHeight: 1.7 }}
                  >
                    {item.a}
                  </div>
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
