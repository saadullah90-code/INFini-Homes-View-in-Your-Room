import { useState } from 'react';

type License = { enabled: boolean; expiresAt: string; active: boolean };

async function request(path: string, method = 'GET', data?: object): Promise<License | null> {
  const response = await fetch('/api/admin-console' + path, {
    method,
    credentials: 'same-origin',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function calendarDate(iso: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const part = (key: string) => parts.find(item => item.type === key)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function AdminConsoleButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [license, setLicense] = useState<License | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [expiresOn, setExpiresOn] = useState('');
  const [error, setError] = useState('');

  function applyLicense(value: License) {
    setLicense(value);
    setEnabled(value.enabled);
    setExpiresOn(calendarDate(value.expiresAt));
  }

  async function show() {
    setOpen(true);
    setError('');
    setLoading(true);
    try {
      const value = await request('/license');
      if (value) applyLicense(value);
    } catch (err) {
      setLicense(null);
      if (!(err instanceof Error && err.message === 'Admin login required.')) {
        setError(err instanceof Error ? err.message : 'Could not open admin console.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request('/login', 'POST', { password });
      setPassword('');
      const value = await request('/license');
      if (value) applyLicense(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const value = await request('/license', 'PATCH', { enabled, expiresOn });
      if (value) applyLicense(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await request('/logout', 'POST');
      setLicense(null);
      setPassword('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log out.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" onClick={show} aria-label="Open admin console" title="Admin console"
      style={{ width: 25, height: 25, borderRadius: '50%', border: '1px solid #9ab8b1', background: '#eaf2ef', color: '#285957', fontWeight: 800, cursor: 'pointer' }}>?</button>
    {open && <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(16,35,39,.65)', display: 'grid', placeItems: 'center', padding: 18 }}>
      <section role="dialog" aria-modal="true" aria-label="Admin console" style={{ background: '#fffefa', width: 'min(100%, 430px)', borderRadius: 14, padding: 25, boxShadow: '0 22px 90px #11282f44' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Admin console</h2>
          <button type="button" className="btn btn-quiet" aria-label="Close admin console" onClick={() => setOpen(false)}>×</button>
        </div>
        <p className="small" style={{ lineHeight: 1.6 }}>Only the Shopify View in Your Room feature switches off after the renewal date. This admin app stays open.</p>
        {loading ? <p role="status">Checking access…</p> : license ? <>
          <p role="status"><strong>Status: {license.active && enabled ? 'On' : enabled ? 'Expired' : 'Off'}</strong></p>
          <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
            <label className="field-label" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Shopify feature on
            </label>
            <label className="field-label">Renewal date
              <input className="input" type="date" required value={expiresOn} onChange={event => setExpiresOn(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 8 }} />
            </label>
            <p className="small" style={{ margin: 0 }}>The Shopify feature remains available through the selected date (Pakistan time). Extend the date and switch it on to renew. The admin app and existing 3D models stay available.</p>
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </form>
          <button className="btn btn-quiet" type="button" onClick={logout} disabled={busy} style={{ marginTop: 10 }}>Log out</button>
        </> : <form onSubmit={login} style={{ display: 'grid', gap: 14 }}>
          <label className="field-label">Admin password
            <input className="input" type="password" autoComplete="current-password" required value={password}
              onChange={event => setPassword(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 8 }} />
          </label>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Checking…' : 'Unlock console'}</button>
        </form>}
        {error && <p role="alert" style={{ color: '#a33c30', fontSize: 13 }}>{error}</p>}
      </section>
    </div>}
  </>;
}