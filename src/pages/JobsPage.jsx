import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import { colors, radius, shadow, font } from '../styles.js';
import { formatCurrency, formatDate, clientName, divisionLabel } from '../lib/utils.js';
import { initGcal, connectGcal, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, gcalReady } from '../lib/gcal.js';
import { PageShell } from './Dashboard.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Input, Select, Textarea, Row, Btn } from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';

const STATUS_OPTIONS = ['scheduled', 'in-progress', 'complete', 'invoiced', 'paid', 'cancelled'];

const STATUS_COLORS = {
  scheduled:   [colors.info,       '#eff6ff'],
  'in-progress': [colors.warning,  '#fffbeb'],
  complete:    [colors.success,    '#f0fdf4'],
  invoiced:    ['#7c3aed',         '#f5f3ff'],
  paid:        [colors.success,    '#f0fdf4'],
  cancelled:   [colors.textMuted,  '#f8fafc'],
};

const EMPTY = {
  client_id: '', division: 'carpentry', title: '', description: '',
  quote_id: '', scheduled_date: '', start_time: '', end_time: '',
  crew_lead: '', crew_size: 1, status: 'scheduled',
  labour_cost: '', material_cost: '', quoted_amount: '',
  payment_status: 'unpaid', property_address: '', notes: '',
};

export default function JobsPage({ token, division, showToast }) {
  const [jobs, setJobs]       = useState([]);
  const [clients, setClients] = useState({});
  const [quotes, setQuotes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [syncing, setSyncing] = useState(null);

  useEffect(() => {
    initGcal(() => setGcalConnected(true));
    load();
  }, [division]);

  async function load() {
    setLoading(true);
    try {
      const divParam = division !== 'all' ? { division: `eq.${division}` } : {};
      const data = await api.get(token, 'jobs', { ...divParam, order: 'scheduled_date.desc', limit: 300 });
      setJobs(Array.isArray(data) ? data : []);

      const clientIds = [...new Set((data || []).map(j => j.client_id).filter(Boolean))];
      if (clientIds.length) {
        const cs = await api.get(token, 'clients', { id: `in.(${clientIds.join(',')})`, select: 'id,first_name,last_name,company_name' });
        const map = {};
        (cs || []).forEach(c => { map[c.id] = c; });
        setClients(map);
      }

      const divQ = division !== 'all' ? { division: `eq.${division}` } : {};
      const qs = await api.get(token, 'quotes', { ...divQ, select: 'id,quote_number,title,total,client_id', order: 'created_at.desc', limit: 200 });
      setQuotes(Array.isArray(qs) ? qs : []);
    } catch (e) { showToast('Failed to load jobs', 'error'); }
    finally { setLoading(false); }
  }

  async function handleSave(form) {
    try {
      const body = {
        ...form,
        crew_size: Number(form.crew_size) || 1,
        labour_cost: form.labour_cost === '' ? null : Number(form.labour_cost),
        material_cost: form.material_cost === '' ? null : Number(form.material_cost),
        quoted_amount: form.quoted_amount === '' ? null : Number(form.quoted_amount),
        quote_id: form.quote_id || null,
        client_id: form.client_id || null,
      };

      if (editing?.id) {
        const updated = await api.patch(token, 'jobs', editing.id, body);
        const job = Array.isArray(updated) ? updated[0] : updated;
        setJobs(js => js.map(j => j.id === editing.id ? job : j));
      } else {
        // Auto-generate job number
        const all = await api.get(token, 'jobs', { select: 'job_number', order: 'created_at.desc', limit: 500 });
        const nums = (all || []).map(j => j.job_number).filter(Boolean);
        const year = new Date().getFullYear();
        const max = nums.filter(n => n.startsWith(`JOB-${year}-`))
          .map(n => parseInt(n.split('-')[2]) || 0)
          .reduce((a, b) => Math.max(a, b), 0);
        body.job_number = `JOB-${year}-${String(max + 1).padStart(3, '0')}`;
        const created = await api.post(token, 'jobs', body);
        const job = Array.isArray(created) ? created[0] : created;
        setJobs(js => [job, ...js]);
      }
      showToast('Job saved', 'success');
      setEditing(null);
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this job? This cannot be undone.')) return;
    try {
      await api.delete(token, 'jobs', id);
      setJobs(js => js.filter(j => j.id !== id));
      showToast('Job deleted', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function handleGcalSync(job) {
    if (!gcalConnected) {
      showToast('Connect Google Calendar first', 'warning');
      return;
    }
    setSyncing(job.id);
    try {
      const cl = clients[job.client_id] || null;
      const cName = cl ? clientName(cl) : '';
      if (job.gcal_event_id) {
        await updateCalendarEvent(job, cName);
      } else {
        const eventId = await createCalendarEvent(job, cName);
        const updated = await api.patch(token, 'jobs', job.id, { gcal_event_id: eventId });
        const j = Array.isArray(updated) ? updated[0] : updated;
        setJobs(js => js.map(x => x.id === job.id ? j : x));
      }
      showToast('Synced to Google Calendar', 'success');
    } catch (e) { showToast('Calendar sync failed: ' + e.message, 'error'); }
    finally { setSyncing(null); }
  }

  async function handleGcalDelete(job) {
    if (!job.gcal_event_id) return;
    setSyncing(job.id);
    try {
      await deleteCalendarEvent(job.gcal_event_id);
      const updated = await api.patch(token, 'jobs', job.id, { gcal_event_id: null });
      const j = Array.isArray(updated) ? updated[0] : updated;
      setJobs(js => js.map(x => x.id === job.id ? j : x));
      showToast('Removed from Google Calendar', 'success');
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    finally { setSyncing(null); }
  }

  const filtered = jobs.filter(j => {
    const cl = clients[j.client_id];
    const matchSearch = !search ||
      (j.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (j.job_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (cl && clientName(cl).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <PageShell title="Jobs" actions={
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {!gcalConnected
          ? <Btn variant="secondary" size="sm" onClick={() => connectGcal(() => setGcalConnected(true))}>
              <Icon name="google" size={14} /> Connect Calendar
            </Btn>
          : <span style={{ fontSize: 12, color: colors.success, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="check" size={14} color={colors.success} /> Calendar Connected
            </span>
        }
        <Btn onClick={() => setEditing({ ...EMPTY })}>
          <Icon name="plus" size={14} /> New Job
        </Btn>
      </div>
    }>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Icon name="search" size={14} color={colors.textMuted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs…"
            style={{ width: '100%', padding: '7px 10px 7px 32px', border: `1px solid ${colors.border}`, borderRadius: radius.md, fontSize: 13, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '5px 12px', borderRadius: 20, border: `1px solid ${statusFilter === s ? colors.primary : colors.border}`,
              background: statusFilter === s ? colors.primary : '#fff',
              color: statusFilter === s ? '#fff' : colors.textSecondary,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
            }}>{s}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>No jobs found</div>
      ) : (
        <div style={{ background: colors.card, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {['Job #', 'Title', 'Client', 'Division', 'Scheduled', 'Status', 'Total', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', background: colors.bg }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(job => {
                const cl = clients[job.client_id];
                const total = (Number(job.labour_cost) || 0) + (Number(job.material_cost) || 0);
                const [sc, sbg] = STATUS_COLORS[job.status] || [colors.textMuted, '#f8fafc'];
                return (
                  <tr key={job.id} style={{ borderBottom: `1px solid ${colors.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = colors.bg}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>{job.job_number || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{job.title}</div>
                      {job.property_address && <div style={{ fontSize: 11, color: colors.textMuted }}>{job.property_address}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: colors.textSecondary }}>{cl ? clientName(cl) : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize',
                        background: job.division === 'carpentry' ? colors.carpentryLight : colors.softwashLight,
                        color: job.division === 'carpentry' ? colors.carpentry : colors.softwash,
                      }}>{divisionLabel(job.division)}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: colors.textSecondary }}>
                      {formatDate(job.scheduled_date)}
                      {job.start_time && <span style={{ fontSize: 11, color: colors.textMuted, marginLeft: 4 }}>{job.start_time}</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: sbg, color: sc, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
                        {job.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{total > 0 ? formatCurrency(total) : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleGcalSync(job)}
                          disabled={syncing === job.id}
                          title={job.gcal_event_id ? 'Update in Calendar' : 'Add to Calendar'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: job.gcal_event_id ? colors.success : colors.textMuted }}
                        >
                          <Icon name="sync" size={14} color={job.gcal_event_id ? colors.success : colors.textMuted} />
                        </button>
                        <button onClick={() => setEditing(job)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4 }}>
                          <Icon name="edit" size={14} color={colors.textSecondary} />
                        </button>
                        <button onClick={() => handleDelete(job.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4 }}>
                          <Icon name="trash" size={14} color={colors.danger} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <JobModal
          job={editing}
          clients={clients}
          quotes={quotes}
          gcalConnected={gcalConnected}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          onGcalSync={handleGcalSync}
          onGcalDelete={handleGcalDelete}
          syncing={syncing}
        />
      )}
    </PageShell>
  );
}

function JobModal({ job, clients, quotes, gcalConnected, onSave, onClose, onGcalSync, onGcalDelete, syncing }) {
  const isNew = !job.id;
  const [form, setForm] = useState({
    ...EMPTY,
    ...job,
    labour_cost: job.labour_cost ?? '',
    material_cost: job.material_cost ?? '',
    quoted_amount: job.quoted_amount ?? '',
    crew_size: job.crew_size ?? 1,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const clientList = Object.values(clients);
  const quoteList = quotes.filter(q => !form.client_id || q.client_id === form.client_id);

  // When quote selected, auto-fill fields
  function handleQuoteSelect(qid) {
    set('quote_id', qid);
    if (qid) {
      const q = quotes.find(x => x.id === qid);
      if (q) {
        if (!form.client_id) set('client_id', q.client_id);
        if (!form.quoted_amount) set('quoted_amount', q.total || '');
        if (!form.title) set('title', q.title || '');
      }
    }
  }

  const labour = Number(form.labour_cost) || 0;
  const material = Number(form.material_cost) || 0;
  const totalCost = labour + material;

  return (
    <Modal title={isNew ? 'New Job' : 'Edit Job'} onClose={onClose} width={680}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        {/* Left column */}
        <div>
          <Field label="Title *">
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Job title" />
          </Field>
          <Field label="Client">
            <Select value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">— Select client —</option>
              {clientList.map(c => <option key={c.id} value={c.id}>{clientName(c)}</option>)}
            </Select>
          </Field>
          <Field label="Linked Quote">
            <Select value={form.quote_id} onChange={e => handleQuoteSelect(e.target.value)}>
              <option value="">— None —</option>
              {quoteList.map(q => <option key={q.id} value={q.id}>{q.quote_number} – {q.title}</option>)}
            </Select>
          </Field>
          <Field label="Division">
            <Select value={form.division} onChange={e => set('division', e.target.value)}>
              <option value="carpentry">Carpentry</option>
              <option value="softwash">Soft Wash</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Property Address">
            <Input value={form.property_address} onChange={e => set('property_address', e.target.value)} placeholder="123 Main St" />
          </Field>
        </div>

        {/* Right column */}
        <div>
          <Field label="Scheduled Date">
            <Input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
          </Field>
          <Row>
            <Field label="Start Time">
              <Input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
            </Field>
            <Field label="End Time">
              <Input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
            </Field>
          </Row>
          <Field label="Crew Lead">
            <Input value={form.crew_lead} onChange={e => set('crew_lead', e.target.value)} placeholder="Lead name" />
          </Field>
          <Field label="Crew Size">
            <Input type="number" min="1" value={form.crew_size} onChange={e => set('crew_size', e.target.value)} />
          </Field>
          <Row>
            <Field label="Labour Cost ($)">
              <Input type="number" step="0.01" value={form.labour_cost} onChange={e => set('labour_cost', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Material Cost ($)">
              <Input type="number" step="0.01" value={form.material_cost} onChange={e => set('material_cost', e.target.value)} placeholder="0.00" />
            </Field>
          </Row>
          <Field label="Quoted Amount ($)">
            <Input type="number" step="0.01" value={form.quoted_amount} onChange={e => set('quoted_amount', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Payment Status">
            <Select value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </Select>
          </Field>
        </div>
      </div>

      {/* Cost summary */}
      {totalCost > 0 && (
        <div style={{ background: colors.bg, borderRadius: radius.md, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 24 }}>
          <span style={{ fontSize: 12, color: colors.textSecondary }}>Labour: <strong>{formatCurrency(labour)}</strong></span>
          <span style={{ fontSize: 12, color: colors.textSecondary }}>Materials: <strong>{formatCurrency(material)}</strong></span>
          <span style={{ fontSize: 12, color: colors.text, fontWeight: 700 }}>Total Cost: {formatCurrency(totalCost)}</span>
          {Number(form.quoted_amount) > 0 && (
            <span style={{ fontSize: 12, color: totalCost <= Number(form.quoted_amount) ? colors.success : colors.danger, fontWeight: 600 }}>
              {totalCost <= Number(form.quoted_amount) ? `Margin: ${formatCurrency(Number(form.quoted_amount) - totalCost)}` : `Over by: ${formatCurrency(totalCost - Number(form.quoted_amount))}`}
            </span>
          )}
        </div>
      )}

      <Field label="Notes">
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Job notes…" rows={3} />
      </Field>

      {/* Google Calendar section */}
      {!isNew && (
        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 8 }}>Google Calendar</div>
          {job.gcal_event_id ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: colors.success }}>✓ Synced to calendar</span>
              <Btn size="sm" variant="secondary" onClick={() => onGcalSync(job)} disabled={syncing === job.id}>Update Event</Btn>
              <Btn size="sm" variant="danger" onClick={() => onGcalDelete(job)} disabled={syncing === job.id}>Remove</Btn>
            </div>
          ) : gcalConnected ? (
            <Btn size="sm" variant="secondary" onClick={() => onGcalSync(job)} disabled={syncing === job.id}>
              <Icon name="calendar" size={13} /> Add to Calendar
            </Btn>
          ) : (
            <span style={{ fontSize: 12, color: colors.textMuted }}>Connect Google Calendar to sync this job</span>
          )}
        </div>
      )}

      <Row style={{ justifyContent: 'flex-end' }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(form)} disabled={!form.title.trim()}>Save Job</Btn>
      </Row>
    </Modal>
  );
}
