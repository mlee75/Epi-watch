'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

const mono = 'var(--font-mono), Space Mono, monospace';

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

  const field: React.CSSProperties = {
    width: '100%',
    background: '#0a0e20',
    border: '1px solid #1e2749',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#e8ecf8',
    fontSize: 14,
    outline: 'none',
  };

  const label: React.CSSProperties = {
    display: 'block',
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 6,
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">
        {isSignup ? 'Create account' : 'Sign in'}
      </h1>
      <p style={{ color: '#a0a8c8', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
        {isSignup
          ? 'An account lets you save a watchlist of diseases and countries. Epi-watch stores only your email and that list.'
          : 'Sign in to reach your saved watchlist.'}
      </p>

      {googleEnabled && (
        <>
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full rounded-lg flex items-center justify-center gap-2"
            style={{
              padding: '10px 14px',
              background: '#e8ecf8',
              color: '#0a0e20',
              fontSize: 14,
              fontWeight: 600,
              border: 0,
              cursor: 'pointer',
            }}
          >
            Continue with Google
          </button>
          <div className="flex items-center gap-3 my-5">
            <span style={{ flex: 1, height: 1, background: '#1e2749' }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: '#6b7280' }}>OR</span>
            <span style={{ flex: 1, height: 1, background: '#1e2749' }} />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {isSignup && (
          <div>
            <label style={label} htmlFor="name">Name (optional)</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={field}
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label style={label} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={field}
            autoComplete="email"
          />
        </div>

        <div>
          <label style={label} htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={field}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            minLength={isSignup ? 12 : undefined}
          />
          {isSignup && (
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
              At least 12 characters. Length matters more than symbols — a passphrase works well.
            </p>
          )}
        </div>

        {error && (
          <div
            className="rounded-lg p-3"
            style={{ background: '#2a1015', border: '1px solid #5a2028', color: '#ff8a8a', fontSize: 13 }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            className="rounded-lg p-3"
            style={{ background: '#10241a', border: '1px solid #1f5a3a', color: '#7fe0a8', fontSize: 13 }}
          >
            {notice}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg"
          style={{
            padding: '10px 14px',
            background: busy ? '#1a2140' : '#ff4d4d',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            border: 0,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Working…' : isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p style={{ fontSize: 13, color: '#a0a8c8', marginTop: 20 }}>
        {isSignup ? (
          <>Already have an account? <Link href="/signin" style={{ color: '#4a9eff' }}>Sign in</Link></>
        ) : (
          <>No account? <Link href="/signup" style={{ color: '#4a9eff' }}>Create one</Link></>
        )}
      </p>

      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 16, lineHeight: 1.6 }}>
        By creating an account you agree to our{' '}
        <Link href="/privacy" style={{ color: '#4a9eff' }}>Privacy Policy</Link>.
      </p>
    </div>
  );
}
