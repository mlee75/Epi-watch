'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

const mono = 'var(--font-mono), Space Mono, monospace';

interface Props {
  email: string;
  name: string | null;
  hasPassword: boolean;
  providers: string[];
}

export function AccountPanel({ email, name, hasPassword, providers }: Props) {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Typing the word is a deliberate speed bump: deletion is irreversible and a
  // single mis-click should not be able to trigger it.
  const armed = confirm.trim().toUpperCase() === 'DELETE';

  async function deleteAccount() {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'Could not delete the account.');
        return;
      }
      await signOut({ callbackUrl: '/' });
    } catch {
      setError('Could not delete the account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const row: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    padding: '10px 0',
    borderBottom: '1px solid #1e2749',
    fontSize: 13,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">
      <h1 className="text-3xl font-bold mb-6">Your account</h1>

      <section
        className="rounded-xl p-5 mb-6"
        style={{ background: '#0d1129', border: '1px solid #1e2749' }}
      >
        <h2
          style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', color: '#6b7280', marginBottom: 10 }}
        >
          WHAT WE STORE ABOUT YOU
        </h2>
        <div style={{ ...row }}>
          <span style={{ color: '#6b7280' }}>Email</span>
          <span style={{ color: '#e8ecf8' }}>{email}</span>
        </div>
        <div style={{ ...row }}>
          <span style={{ color: '#6b7280' }}>Name</span>
          <span style={{ color: '#e8ecf8' }}>{name || <em style={{ color: '#6b7280' }}>not set</em>}</span>
        </div>
        <div style={{ ...row }}>
          <span style={{ color: '#6b7280' }}>Password</span>
          <span style={{ color: '#e8ecf8' }}>
            {hasPassword ? 'Stored as a bcrypt hash' : 'None — you sign in with a provider'}
          </span>
        </div>
        <div style={{ ...row, borderBottom: 0 }}>
          <span style={{ color: '#6b7280' }}>Sign-in methods</span>
          <span style={{ color: '#e8ecf8' }}>
            {[hasPassword && 'Email', ...providers].filter(Boolean).join(', ') || '—'}
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 12, lineHeight: 1.6 }}>
          That is everything, plus your watchlist. We hold no location, health or
          browsing data — anything you enter into the travel tool is computed and
          discarded, never stored.
        </p>
      </section>

      <section
        className="rounded-xl p-5"
        style={{ background: 'rgba(255,77,77,0.05)', border: '1px solid rgba(255,77,77,0.28)' }}
      >
        <h2
          style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', color: '#ff4d4d', marginBottom: 8 }}
        >
          DELETE ACCOUNT
        </h2>
        <p style={{ fontSize: 13, color: '#a0a8c8', lineHeight: 1.7, marginBottom: 14 }}>
          This permanently removes your account, your sign-in methods and your
          watchlist. It cannot be undone and we keep no backup copy of it.
        </p>

        <label
          htmlFor="confirm"
          style={{ display: 'block', fontSize: 12, color: '#a0a8c8', marginBottom: 6 }}
        >
          Type <strong style={{ color: '#e8ecf8' }}>DELETE</strong> to confirm
        </label>
        <input
          id="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          style={{
            width: '100%',
            background: '#0a0e20',
            border: '1px solid #1e2749',
            borderRadius: 8,
            padding: '9px 12px',
            color: '#e8ecf8',
            fontSize: 14,
            outline: 'none',
            marginBottom: 12,
          }}
        />

        {error && (
          <div
            className="rounded-lg p-3 mb-3"
            style={{ background: '#2a1015', border: '1px solid #5a2028', color: '#ff8a8a', fontSize: 13 }}
          >
            {error}
          </div>
        )}

        <button
          onClick={deleteAccount}
          disabled={!armed || busy}
          style={{
            padding: '9px 16px',
            borderRadius: 8,
            border: 0,
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background: armed && !busy ? '#ff4d4d' : '#3a2030',
            cursor: armed && !busy ? 'pointer' : 'not-allowed',
          }}
        >
          {busy ? 'Deleting…' : 'Permanently delete my account'}
        </button>
      </section>

      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        style={{
          marginTop: 20,
          background: 'transparent',
          border: '1px solid #1e2749',
          borderRadius: 8,
          padding: '8px 14px',
          color: '#a0a8c8',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Sign out
      </button>
    </div>
  );
}
