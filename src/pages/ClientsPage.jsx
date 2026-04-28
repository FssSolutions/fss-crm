import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import { colors, radius, shadow, font } from '../styles.js';
import { formatDate, clientName, today } from '../lib/utils.js';
import { PageShell } from './Dashboard.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { Field, Input, Select, Textarea, Row, Btn } from '../components/Field.jsx';

const LEAD_STATUSES = ['hot', 'warm', 'cold', 'dead'];
const LEAD_SOURCES  = ['referral', 'door-to-door', 'google', 'repeat', 'other'];
const DIVISIONS     = ['carpentry', 'softwash', 'both'];
const COMM_METHODS  = ['call', 'text', 'email', 'site-visit', 'door-knock'];

const LEAD_COLORS = {
  hot: colors.danger, warm: colors.warning, cold: colors.info, dead: colors.textMuted,
};

export default function ClientsPage({ token, division, showToast }) {
  const [clients, setClients]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [selected, setSelected]     = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [showComms, setShowComms]   = useState(false);
  const [comms, setComms]           = useState([]);

  useEffect(() => { load(); }, [division]);

  async function load() {
    setLoading(true);
    try {
      const params = { order: 'created_at.desc', limit: 500 };
      if (division !== 'all') params['division'] = `eq.${division}`;
      const data = await api.get(token, 'clients', params);
      setClients(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }

  async function loadComms(clientId) {
    const data = await api.get(token, 'communications', { 'client_id': `eq.${clientId}`, order: 'contact_date.desc' });
    setComms(Array.isArray(data) ? data : []);
  }

  async function save(values) {
    try {
      if (values.id) {
        await api.patch(token, 'clients', values.id, values);
        setClients(cs => cs.map(c => c.id === values.id ? { ...c, ...values } : c));
        showToast('Client updated');
      } else {
        const [created] = await api.post(token, 'clients', values);
        setClients(cs => [created, ...cs]);
        showToast('Client added');
      }
      setShowForm(false); setSelected(null);
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function del(id) {
    if (!confirm('Delete this client?')) return;
    try {
      await api.delete(token, 'clients', id);
      setClients(cs => cs.filter(c => c.id !== id));
      showToast('Client deleted');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function addComm(values) {
    try {
      await api.post(token, 'communications', { ...values, client_id: selected.id });
      await loadComms(selected.id);
      await api.patch(token, 'clients', selected.id, { last_contacted_at: values.contact_date || new Date().toISOString() });
      showToast('Communication logged');
    } catch (e) { showToast(e.message, 'error'); }
  }

  function openEdit(c) { setSelected(c); setShowForm(true); }
  function openComms(c) { setSelected(c); loadComms(c.id); setShowComms(true); }

  const filtered = clients.filter(c => {
    if (statusFilter !== 'all' && c.lead_status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [c.first_name, c.last_name, c.company_name, c.email, c.phone, c.city]
      .some(f => f && f.toLowerCase().includes(q));
  });

  return (
    <PageShell title="Clients" actions={
      <Btn onClick={() => { setSelected(null); setShowForm(true); }}>
        <Icon name="plus" size={16} /> Add Client
      </Btn>
    }>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Icon name="search" size={15} color={colors.textMuted} style={{ position: 'absolute', left: 10, top: 10 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: '8px 12px 8px 34px', fontSize: 13, fontFamily: 'inherit' }} />
        </div>
        {['all', ...LEAD_STATUSES].map(s => (
          <button key={s} onClick={() => setStatus(s)} style={{
            background: statusFilter === s ? LEAD_COLORS[s] || colors.primary : colors.card,
            color: statusFilter === s ? '#fff' : colors.textSecondary,
            border: `1px solid ${colors.border}`, borderRadius: 20, padding: '5px 14px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
          }}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
        <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 'auto' }}>{filtered.length} clients</span>
      </div>

      {/* Table */}
      {loading ? <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>Loading…</div> : (
        <div style={{ background: colors.card, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: colors.bg }}>
                {['Name', 'Phone', 'Email', 'City', 'Division', 'Status', 'Follow-up', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${colors.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: colors.textMuted }}>No clients found</td></tr>
              )}
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{clientName(c)}</div>
                    {c.tags?.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                        {c.tags.map(t => (
                          <span key={t} style={{ background: colors.primaryLight, color: colors.primary, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20 }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: colors.textSecondary }}>{c.phone || '—'}</td>
                  <td style={{ padding: '10px 14px', color: colors.textSecondary }}>{c.email || '—'}</td>
                  <td style={{ padding: '10px 14px', color: colors.textSecondary }}>{c.city || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {c.division && <DivBadge div={c.division} />}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <LeadBadge status={c.lead_status} />
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    {c.next_followup_at
                      ? <span style={{ color: new Date(c.next_followup_at) < new Date() ? colors.danger : colors.textSecondary }}>{formatDate(c.next_followup_at)}</span>
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <ActionBtn title="Log communication" icon="phone" onClick={() => openComms(c)} />
                      <ActionBtn title="Edit" icon="edit" onClick={() => openEdit(c)} />
                      <ActionBtn title="Delete" icon="trash" onClick={() => del(c.id)} danger />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ClientForm client={selected} onSave={save} onClose={() => { setShowForm(false); setSelected(null); }} />
      )}
      {showComms && selected && (
        <CommsModal client={selected} comms={comms} onAdd={addComm} onClose={() => { setShowComms(false); setSelected(null); }} />
      )}
    </PageShell>
  );
}

// ── Client Form Modal ────────────────────────────────────────────────────────
function ClientForm({ client: c, onSave, onClose }) {
  const [form, setForm] = useState({
    first_name: c?.first_name || '',
    last_name: c?.last_name || '',
    company_name: c?.company_name || '',
    email: c?.email || '',
    phone: c?.phone || '',
    billing_address: c?.billing_address || '',
    property_address: c?.property_address || '',
    city: c?.city || '',
    lead_status: c?.lead_status || 'warm',
    lead_source: c?.lead_source || '',
    division: c?.division || '',
    tags: (c?.tags || []).join(', '),
    notes: c?.notes || '',
    next_followup_at: c?.next_followup_at ? c.next_followup_at.slice(0, 10) : '',
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    onSave({ ...(c ? { id: c.id } : {}), ...form, tags, next_followup_at: form.next_followup_at || null });
  }

  return (
    <Modal title={c ? 'Edit Client' : 'Add Client'} onClose={onClose} width={600}>
      <form onSubmit={submit}>
        <Row>
          <Field label="First Name" required style={{ flex: 1 }}><Input value={form.first_name} onChange={set('first_name')} required /></Field>
          <Field label="Last Name" required style={{ flex: 1 }}><Input value={form.last_name} onChange={set('last_name')} required /></Field>
        </Row>
        <Field label="Company Name"><Input value={form.company_name} onChange={set('company_name')} /></Field>
        <Row>
          <Field label="Email" style={{ flex: 1 }}><Input type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="Phone" style={{ flex: 1 }}><Input value={form.phone} onChange={set('phone')} /></Field>
        </Row>
        <Field label="Billing Address"><Input value={form.billing_address} onChange={set('billing_address')} /></Field>
        <Row>
          <Field label="Property Address" style={{ flex: 2 }}><Input value={form.property_address} onChange={set('property_address')} /></Field>
          <Field label="City" style={{ flex: 1 }}><Input value={form.city} onChange={set('city')} /></Field>
        </Row>
        <Row>
          <Field label="Lead Status" style={{ flex: 1 }}>
            <Select value={form.lead_status} onChange={set('lead_status')}>
              {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Lead Source" style={{ flex: 1 }}>
            <Select value={form.lead_source} onChange={set('lead_source')}>
              <option value="">—</option>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Division" style={{ flex: 1 }}>
            <Select value={form.division} onChange={set('division')}>
              <option value="">—</option>
              {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
        </Row>
        <Row>
          <Field label="Tags (comma-separated)" style={{ flex: 2 }}><Input value={form.tags} onChange={set('tags')} placeholder="builder, hoa, referral" /></Field>
          <Field label="Follow-up Date" style={{ flex: 1 }}><Input type="date" value={form.next_followup_at} onChange={set('next_followup_at')} /></Field>
        </Row>
        <Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} rows={3} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit">{c ? 'Save Changes' : 'Add Client'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ── Communications Modal ─────────────────────────────────────────────────────
function CommsModal({ client: c, comms, onAdd, onClose }) {
  const [form, setForm] = useState({ method: 'call', direction: 'outbound', contact_date: today(), summary: '', follow_up_required: false });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    await onAdd(form);
    setForm({ method: 'call', direction: 'outbound', contact_date: today(), summary: '', follow_up_required: false });
  }

  return (
    <Modal title={`Communications — ${clientName(c)}`} onClose={onClose} width={600}>
      <form onSubmit={submit} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${colors.border}` }}>
        <Row>
          <Field label="Method" style={{ flex: 1 }}>
            <Select value={form.method} onChange={set('method')}>
              {COMM_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Direction" style={{ flex: 1 }}>
            <Select value={form.direction} onChange={set('direction')}>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </Select>
          </Field>
          <Field label="Date" style={{ flex: 1 }}><Input type="date" value={form.contact_date} onChange={set('contact_date')} /></Field>
        </Row>
        <Field label="Summary"><Textarea value={form.summary} onChange={set('summary')} rows={2} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn type="submit">Log Contact</Btn>
        </div>
      </form>
      <div>
        {comms.length === 0 && <div style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>No communications logged yet</div>}
        {comms.map(comm => (
          <div key={comm.id} style={{ padding: '10px 0', borderBottom: `1px solid ${colors.borderLight}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.primary, textTransform: 'capitalize' }}>{comm.method} · {comm.direction}</span>
              <span style={{ fontSize: 11, color: colors.textMuted }}>{formatDate(comm.contact_date)}</span>
            </div>
            {comm.summary && <div style={{ fontSize: 13, color: colors.textSecondary }}>{comm.summary}</div>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function LeadBadge({ status }) {
  const color = LEAD_COLORS[status] || colors.textMuted;
  return (
    <span style={{ background: color + '22', color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

function DivBadge({ div }) {
  const color = div === 'carpentry' ? colors.carpentry : div === 'softwash' ? colors.softwash : colors.primary;
  const bg = div === 'carpentry' ? colors.carpentryLight : div === 'softwash' ? colors.softwashLight : colors.primaryLight;
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
      {div}
    </span>
  );
}

function ActionBtn({ icon, title, onClick, danger }) {
  return (
    <button title={title} onClick={onClick} style={{
      background: 'none', border: `1px solid ${colors.border}`, borderRadius: 6, padding: '5px 8px',
      cursor: 'pointer', display: 'flex', color: danger ? colors.danger : colors.textSecondary,
    }}>
      <Icon name={icon} size={14} color={danger ? colors.danger : colors.textSecondary} />
    </button>
  );
}
