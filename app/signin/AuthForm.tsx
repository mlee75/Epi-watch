'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

interface Props {
  mode: 'signin' | 'signup';
  googleEnabled: boolean;
}

export function AuthForm({ mode, googleEnabled }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      if (isSignup) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        const json = await res.json();
        if (!json.ok) {
          setError(json.error ?? 'Registration failed.');
          return;
        }
        setNotice(json.message);
        return;
      }

      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        // One message for every failure mode, so a wrong password cannot be
        // told apart from an address that has no account here.
        setError('Email or password is incorrect.');
        return;
      }
      window.location.href = '/';
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page auth-page">
      <header className="page-head">
        <h1 className="page-title">{isSignup ? 'Create an account' : 'Sign in'}</h1>
        <p className="page-lede">
          {isSignup
            ? 'Everything on Epi-watch works without an account. An account stores only your email and, once the feature ships, a watchlist of diseases and countries.'
            : 'Sign in to your Epi-watch account.'}
        </p>
      </header>

      <div className="panel panel-body auth-card">
        {googleEnabled && (
          <>
            <button type="button" className="btn" style={{ width: '100%', height: 38 }}
              onClick={() => signIn('google', { callbackUrl: '/' })}>
              Continue with Google
            </button>
            <div className="auth-or"><span>or with email</span></div>
          </>
        )}

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          {isSignup && (
            <div>
              <label className="field-label" htmlFor="name">Name (optional)</label>
              <input id="name" className="input" type="text" value={name}
                onChange={(e) => setName(e.target.value)} autoComplete="name" style={{ width: '100%' }} />
            </div>
          )}
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={{ width: '100%' }} />
          </div>
          <div>
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" className="input" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)} style={{ width: '100%' }}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={isSignup ? 12 : undefined} />
            {isSignup && (
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                At least 12 characters. Length matters more than symbols; a passphrase works well.
              </p>
            )}
          </div>

          {error && <div className="note note-error" role="alert">{error}</div>}
          {notice && <div className="note note-ok" role="status">{notice}</div>}

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ height: 38 }}>
            {busy ? 'Working…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>

      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 16 }}>
        {isSignup ? (
          <>Already have an account? <Link href="/signin" className="link">Sign in</Link></>
        ) : (
          <>No account? <Link href="/signup" className="link">Create one</Link></>
        )}
      </p>
      <p className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
        Creating an account means you accept the <Link href="/privacy" className="link">privacy policy</Link>.
      </p>
    </div>
  );
}
