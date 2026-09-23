import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Privacy policy | Epi-watch',
  description:
    'What Epi-watch collects, why, how long it is kept, and how to delete it.',
};

const LAST_UPDATED = '13 August 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <article className="page legal legal-page">
          <h1 className="page-title">Privacy policy</h1>
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 28px' }}>
            Last updated {LAST_UPDATED}
          </p>

          <p>
            Epi-watch is a public dashboard for infectious disease outbreaks. Most of it
            works without an account and without collecting anything about you. This page
            says plainly what is collected when you do sign in, and what is not.
          </p>

          <h2>What we collect</h2>

          <h3>If you browse without an account</h3>
          <p>
            No account, no profile, and no advertising or cross-site tracking. We do not
            sell data, and there are no third-party advertising or analytics trackers on
            the site.
          </p>
          <p>
            Our hosting provider (Vercel) processes standard server request logs, and our
            error monitoring (Sentry) records diagnostic data when something breaks. See{' '}
            <a href="#processors">Third parties</a> below.
          </p>

          <h3>If you create an account</h3>
          <ul>
            <li><strong>Email address</strong> — your login identifier.</li>
            <li><strong>Name</strong> — optional, and only if you provide it.</li>
            <li>
              <strong>Password</strong> — stored only as a <strong>bcrypt hash</strong>,
              never as readable text. We cannot see or recover your password. If you sign
              in with Google we store no password at all.
            </li>
            <li>
              <strong>Google account identifiers</strong> — if you use Google sign-in, we
              receive your email, name and profile picture from Google. We do not receive
              your Google password and cannot access anything else in your Google account.
            </li>
            <li><strong>Watchlist</strong> — the diseases and countries you choose to follow.</li>
          </ul>

          <p>
            That is the complete list. We do not collect your location, your health
            information, your travel plans, or your browsing history on other sites.
          </p>

          <h2>The travel risk tool</h2>
          <p>
            The travel risk assessment runs on our server to produce a score and is{' '}
            <strong>not stored</strong> — the details you enter, including age, pregnancy
            status, chronic conditions and vaccination status, are used for that one
            request and then discarded. They are not written to our database, not linked
            to your account, and not used for any other purpose.
          </p>
          <p>
            Because that input is health information, we would rather not hold it at all.
            It is worth knowing that this data does pass through our server and our error
            monitoring in transit; see below.
          </p>

          <h2 id="processors">Third parties</h2>
          <table>
            <thead>
              <tr><th>Service</th><th>Purpose</th><th>What it receives</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Vercel</td>
                <td>Hosting</td>
                <td>Request logs, IP address, user agent</td>
              </tr>
              <tr>
                <td>Neon</td>
                <td>Database</td>
                <td>Your account record and watchlist</td>
              </tr>
              <tr>
                <td>Sentry</td>
                <td>Error monitoring &amp; session replay</td>
                <td>Diagnostic data when an error occurs, which can include the URL, request context and a replay of the page</td>
              </tr>
              <tr>
                <td>Google</td>
                <td>Optional sign-in</td>
                <td>Only used if you choose Google sign-in</td>
              </tr>
              <tr>
                <td>YouTube (youtube-nocookie)</td>
                <td>Video playback</td>
                <td>Nothing until you press play; then your IP and player interaction go to Google</td>
              </tr>
            </tbody>
          </table>
          <p>
            Video embeds use YouTube&rsquo;s no-cookie host and load only when you click
            play, so simply viewing a page with videos on it sends nothing to Google.
          </p>

          <h2>How long we keep it</h2>
          <ul>
            <li><strong>Account data</strong> — until you delete your account.</li>
            <li><strong>Sessions</strong> — sign-in sessions expire automatically.</li>
            <li><strong>Travel tool inputs</strong> — not retained.</li>
            <li><strong>Error data</strong> — retained by Sentry under its own retention schedule.</li>
          </ul>

          <h2>Your rights</h2>
          <p>
            You can ask for a copy of your data, correct it, or have it deleted. Deleting
            your account removes your record and watchlist. If you are in the UK, EU, or a
            jurisdiction with comparable law, you also have the right to object to
            processing and to complain to your data protection authority.
          </p>
          <p>
            You can delete your account yourself at any time from your{' '}
            <Link href="/account">account page</Link> — it removes your record, sign-in
            methods and watchlist immediately, with no backup copy retained. For a copy of
            your data or a correction, contact us at the address below; we will need to
            confirm you control the email address on the account.
          </p>

          <h2>Security</h2>
          <p>
            Traffic is encrypted with HTTPS and HSTS. Passwords are hashed with bcrypt and
            a per-password salt. Administrative endpoints require a secret. No system is
            perfectly secure, and we do not claim otherwise — but we do not store more
            than we need, which is the most effective protection available.
          </p>

          <h2>Children</h2>
          <p>
            Epi-watch is not directed at children and we do not knowingly create accounts
            for anyone under 16.
          </p>

          <h2>Changes</h2>
          <p>
            If this policy changes materially we will update the date at the top. Continued
            use after a change means you accept the revised policy.
          </p>

          <h2>Contact</h2>
          <p>
            Questions or requests: open an issue at{' '}
            <a href="https://github.com/mlee75/Epi-watch/issues" target="_blank" rel="noopener noreferrer">
              github.com/mlee75/Epi-watch
            </a>
            .
          </p>

          <p className="muted" style={{ marginTop: 32, fontSize: 13 }}>
            See also our <Link href="/cookies">Cookie Policy</Link> and{' '}
            <Link href="/faq">FAQ</Link>.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
