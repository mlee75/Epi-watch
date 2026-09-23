import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Cookie policy | Epi-watch',
  description: 'Which cookies Epi-watch sets, why, and why there is no cookie banner.',
};

const LAST_UPDATED = '13 August 2026';

export default function CookiesPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <article className="page legal legal-page">
          <h1 className="page-title">Cookie policy</h1>
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 28px' }}>
            Last updated {LAST_UPDATED}
          </p>

          <p>
            Epi-watch sets no advertising cookies, no analytics cookies, and no cross-site
            tracking cookies. The only cookies we set are the ones required to keep you
            signed in.
          </p>

          <h2>Cookies we set</h2>
          <table>
            <thead>
              <tr><th>Cookie</th><th>Purpose</th><th>Lifetime</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>authjs.session-token</code></td>
                <td>Keeps you signed in. Set only after you sign in.</td>
                <td>Session</td>
              </tr>
              <tr>
                <td><code>authjs.csrf-token</code></td>
                <td>Protects sign-in forms against cross-site request forgery.</td>
                <td>Session</td>
              </tr>
              <tr>
                <td><code>authjs.callback-url</code></td>
                <td>Returns you to the right page after signing in.</td>
                <td>Session</td>
              </tr>
            </tbody>
          </table>

          <p>
            All three are <strong>strictly necessary</strong>: without them sign-in cannot
            work. If you never create an account, none of them are ever set.
          </p>

          <h2>Why there is no cookie banner</h2>
          <p>
            Under the ePrivacy Directive and UK PECR, consent is required for cookies that
            are not strictly necessary for a service the user has requested. Every cookie
            above exists solely to deliver sign-in, which is a service you actively
            request by signing in — so no consent banner is required.
          </p>
          <p>
            We would rather not show a banner that asks permission for tracking we do not
            do. If we ever add analytics or advertising, this page will change and a real
            consent mechanism will appear with it.
          </p>

          <h2>Third-party cookies</h2>
          <p>
            <strong>YouTube.</strong> Video is embedded through{' '}
            <code>youtube-nocookie.com</code> and loads only after you press play. Viewing
            a page that contains videos sets nothing. Once you press play, Google may set
            cookies and receives your IP address, under{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google&rsquo;s privacy policy
            </a>
            . The same applies to the live TV panel on the globe.
          </p>
          <p>
            <strong>Google sign-in.</strong> If you choose it, Google sets cookies on its
            own domain as part of authenticating you.
          </p>
          <p>
            <strong>Sentry.</strong> Our error monitoring does not set advertising cookies.
            It may use browser storage to correlate events within a session for diagnostics.
          </p>

          <h2>Controlling cookies</h2>
          <p>
            You can block or delete cookies in your browser settings. Blocking the cookies
            above will prevent sign-in from working, but the rest of Epi-watch — the globe,
            outbreak data, news and video — works fully without an account and without them.
          </p>

          <p className="muted" style={{ marginTop: 32, fontSize: 13 }}>
            See also our <Link href="/privacy">Privacy Policy</Link> and{' '}
            <Link href="/faq">FAQ</Link>.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
