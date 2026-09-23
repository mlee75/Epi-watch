'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

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

  const methods = [hasPassword && 'Email and password', ...providers].filter(Boolean).join(', ') || '–';

  return (
    <div className="page auth-page">
      <header className="page-head">
        <h1 className="page-title">Your account</h1>
      </header>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header"><h2 className="panel-title">What Epi-watch stores about you</h2></div>
        <dl className="drawer-facts panel-body">
          <dt>Email</dt><dd>{email}</dd>
          <dt>Name</dt><dd>{name || <span className="muted">Not set</span>}</dd>
          <dt>Password</dt><dd>{hasPassword ? 'Stored as a bcrypt hash' : 'None; you sign in with a provider'}</dd>
          <dt>Sign-in methods</dt><dd>{methods}</dd>
        </dl>
        <p className="panel-foot">
          That is everything, plus a watchlist if you have one. No location, health or browsing
          data is held; what you enter in the travel tool is used for the estimate and not stored.
        </p>
      </section>

      <section className="panel panel-danger">
        <div className="panel-header"><h2 className="panel-title">Delete account</h2></div>
        <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            Permanently removes your account, sign-in methods and watchlist. This cannot be undone,
            and no backup copy is kept.
          </p>
          <div>
            <label className="field-label" htmlFor="confirm">
              Type <strong style={{ color: 'var(--ink-1)' }}>DELETE</strong> to confirm
            </label>
            <input id="confirm" className="input" value={confirm} autoComplete="off"
              onChange={(e) => setConfirm(e.target.value)} style={{ width: '100%', maxWidth: 320 }} />
          </div>
          {error && <div className="note note-error" role="alert">{error}</div>}
          <div>
            <button type="button" className="btn btn-danger" onClick={deleteAccount} disabled={!armed || busy}>
              {busy ? 'Deleting…' : 'Permanently delete my account'}
            </button>
          </div>
        </div>
      </section>

      <button type="button" className="btn" style={{ marginTop: 20 }}
        onClick={() => signOut({ callbackUrl: '/' })}>
        Sign out
      </button>
    </div>
  );
}
