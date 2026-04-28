import { useState, useEffect, useCallback } from 'react';
import { colors, font, SIDEBAR_WIDTH } from './styles.js';
import { loadAuth, saveAuth, clearAuth, signIn, signOut } from './lib/auth.js';
import { initGcal } from './lib/gcal.js';
import Icon from './components/Icon.jsx';
import Toast from './components/Toast.jsx';

import Dashboard from './pages/Dashboard.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import PipelinePage from './pages/PipelinePage.jsx';
import QuotesPage from './pages/QuotesPage.jsx';
import JobsPage from './pages/JobsPage.jsx';
import InvoicesPage from './pages/InvoicesPage.jsx';
import PriceBookPage from './pages/PriceBookPage.jsx';
import TasksPage from './pages/TasksPage.jsx';

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'clients',   label: 'Clients',   icon: 'clients' },
  { id: 'pipeline',  label: 'Pipeline',  icon: 'pipeline' },
  { id: 'quotes',    label: 'Quotes',    icon: 'quotes' },
  { id: 'jobs',      label: 'Jobs',      icon: 'jobs' },
  { id: 'invoices',  label: 'Invoices',  icon: 'invoices' },
  { id: 'tasks',     label: 'Tasks',     icon: 'tasks' },
  { id: 'pricebook', label: 'Price Book', icon: 'pricebook' },
];

const DIVISIONS = [
  { id: 'all',       label: 'All Divisions' },
  { id: 'carpentry', label: 'Carpentry' },
  { id: 'softwash',  label: 'Soft Wash' },
];

export default function App() {
  const [auth, setAuth]     = useState(loadAuth);
  const [page, setPage]     = useState('dashboard');
  const [division, setDiv]  = useState('all');
  const [toast, setToast]   = useState(null);
  const [gcalOk, setGcal]   = useState(false);

  useEffect(() => { initGcal(setGcal); }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  async function handleSignIn(email, password) {
    const session = await signIn(email, password);
    saveAuth(session);
    setAuth(session);
  }

  async function handleSignOut() {
    await signOut(auth?.access_token);
    clearAuth();
    setAuth(null);
  }

  if (!auth?.access_token) {
    return <AuthScreen onSignIn={handleSignIn} />;
  }

  const token = auth.access_token;
  const divColor = division === 'carpentry' ? colors.carpentry
    : division === 'softwash' ? colors.softwash : colors.primary;

  const shared = { token, division, showToast, gcalOk, setPage };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: font.family, background: colors.bg }}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        width: SIDEBAR_WIDTH, background: colors.sidebar,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      }}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>FSS CRM</div>
          <div style={{ fontSize: 11, color: colors.sidebarText, marginTop: 2 }}>FSS Solutions</div>
        </div>

        {/* Division switcher */}
        <div style={{ padding: '10px 12px 6px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: colors.sidebarText, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, paddingLeft: 4 }}>
            Division
          </div>
          {DIVISIONS.map(d => (
            <button key={d.id} onClick={() => setDiv(d.id)} style={{
              width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
              background: division === d.id ? colors.sidebarActive : 'none',
              color: division === d.id ? '#fff' : colors.sidebarText,
              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit',
              marginBottom: 1, fontWeight: division === d.id ? 600 : 400,
              borderLeft: `3px solid ${division === d.id ? divColor : 'transparent'}`,
            }}>
              {d.label}
            </button>
          ))}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 12px 6px' }} />

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
          {PAGES.map(p => (
            <button key={p.id} onClick={() => setPage(p.id)} style={{
              width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
              background: page === p.id ? colors.sidebarActive : 'none',
              color: page === p.id ? '#fff' : colors.sidebarText,
              padding: '8px 10px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 1,
              fontWeight: page === p.id ? 600 : 400,
            }}>
              <Icon name={p.icon} size={17} color={page === p.id ? '#fff' : colors.sidebarText} />
              {p.label}
            </button>
          ))}
        </nav>

        {/* User row */}
        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: colors.sidebarText, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {auth?.user?.email}
          </div>
          <button onClick={handleSignOut} style={{
            background: 'none', border: 'none', color: colors.sidebarText, cursor: 'pointer',
            fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontFamily: 'inherit',
          }}>
            <Icon name="logout" size={14} color={colors.sidebarText} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main style={{ marginLeft: SIDEBAR_WIDTH, flex: 1, minHeight: '100vh' }}>
        {page === 'dashboard' && <Dashboard {...shared} />}
        {page === 'clients'   && <ClientsPage {...shared} />}
        {page === 'pipeline'  && <PipelinePage {...shared} />}
        {page === 'quotes'    && <QuotesPage {...shared} />}
        {page === 'jobs'      && <JobsPage {...shared} />}
        {page === 'invoices'  && <InvoicesPage {...shared} />}
        {page === 'tasks'     && <TasksPage {...shared} />}
        {page === 'pricebook' && <PriceBookPage {...shared} />}
      </main>

      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

// ── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onSignIn }) {
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoad(true); setError('');
    try { await onSignIn(email, pass); }
    catch (err) { setError(err.message); }
    finally { setLoad(false); }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: colors.sidebar, fontFamily: font.family,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '40px 36px',
        width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: colors.text }}>FSS CRM</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            FSS Solutions — Sign in to continue
          </div>
        </div>
        <form onSubmit={submit}>
          {[
            { label: 'EMAIL', type: 'email', val: email, set: setEmail, ph: 'you@example.com' },
            { label: 'PASSWORD', type: 'password', val: pass, set: setPass, ph: '••••••••' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>
                {f.label}
              </label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)}
                required placeholder={f.ph} autoFocus={f.label === 'EMAIL'}
                style={{
                  width: '100%', boxSizing: 'border-box', border: `1px solid ${colors.border}`,
                  borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                }} />
            </div>
          ))}
          {error && <div style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: '100%', background: colors.primary, color: '#fff', border: 'none',
            borderRadius: 8, padding: '11px 0', fontSize: 15, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
