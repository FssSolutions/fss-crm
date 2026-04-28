import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import { colors, radius, shadow, font } from '../styles.js';
import { formatCurrency, formatDate, clientName, divisionLabel } from '../lib/utils.js';
import { PageShell } from './Dashboard.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Input, Select, Textarea, Row, Btn } from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';

const STATUS_OPTIONS = ['draft', 'sent', 'paid', 'overdue', 'void'];

const STATUS_COLORS = {
  draft:   [colors.textSecondary, '#f8fafc'],
  sent:    [colors.info,          '#eff6ff'],
  paid:    [colors.success,       '#f0fdf4'],
  overdue: [colors.danger,        '#fef2f2'],
  void:    [colors.textMuted,     '#f8fafc'],
};

const EMPTY = {
  client_id: '', job_id: '', division: 'carpentry',
  issued_date: new Date().toISOString().slice(0, 10),
  due_date: '', status: 'draft',
  subtotal: '', gst_amount: '', total: '',
  notes: '',
};

export default function InvoicesPage({ token, division, showToast }) {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients]   = useState({});
  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing]   = useState(null);

  useEffect(() => { load(); }, [division]);

  async function load() {
    setLoading(true);
    try {
      const divParam = division !== 'all' ? { division: `eq.${division}` } : {};
      const data = await api.get(token, 'invoices', { ...divParam, order: 'issued_date.desc', limit: 300 });
      setInvoices(Array.isArray(data) ? data : []);

      const clientIds = [...new Set((data || []).map(i => i.client_id).filter(Boolean))];
      if (clientIds.length) {
        const cs = await api.get(token, 'clients', { id: `in.(${clientIds.join(',')})`, select: 'id,first_name,last_name,company_name,email,phone,billing_address' });
        const map = {};
        (cs || []).forEach(c => { map[c.id] = c; });
        setClients(map);
      }

      const divJ = division !== 'all' ? { division: `eq.${division}` } : {};
      const js = await api.get(token, 'jobs', { ...divJ, select: 'id,job_number,title,client_id,division,labour_cost,material_cost', order: 'scheduled_date.desc', limit: 300 });
      setJobs(Array.isArray(js) ? js : []);
    } catch (e) { showToast('Failed to load invoices', 'error'); }
    finally { setLoading(false); }
  }

  async function handleSave(form) {
    try {
      const body = {
        ...form,
        subtotal: Number(form.subtotal) || 0,
        gst_amount: Number(form.gst_amount) || 0,
        total: Number(form.total) || 0,
        job_id: form.job_id || null,
        client_id: form.client_id || null,
      };

      if (editing?.id) {
        const updated = await api.patch(token, 'invoices', editing.id, body);
        const inv = Array.isArray(updated) ? updated[0] : updated;
        setInvoices(is => is.map(i => i.id === editing.id ? inv : i));
      } else {
        const all = await api.get(token, 'invoices', { select: 'invoice_number', order: 'created_at.desc', limit: 500 });
        const nums = (all || []).map(i => i.invoice_number).filter(Boolean);
        const year = new Date().getFullYear();
        const max = nums.filter(n => n.startsWith(`INV-${year}-`))
          .map(n => parseInt(n.split('-')[2]) || 0)
          .reduce((a, b) => Math.max(a, b), 0);
        body.invoice_number = `INV-${year}-${String(max + 1).padStart(3, '0')}`;
        const created = await api.post(token, 'invoices', body);
        const inv = Array.isArray(created) ? created[0] : created;
        setInvoices(is => [inv, ...is]);
      }
      showToast('Invoice saved', 'success');
      setEditing(null);
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this invoice?')) return;
    try {
      await api.delete(token, 'invoices', id);
      setInvoices(is => is.filter(i => i.id !== id));
      showToast('Invoice deleted', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function createFromJob(job) {
    const subtotal = (Number(job.labour_cost) || 0) + (Number(job.material_cost) || 0);
    const gst = Math.round(subtotal * 0.05 * 100) / 100;
    const cl = clients[job.client_id];
    setEditing({
      ...EMPTY,
      client_id: job.client_id || '',
      job_id: job.id,
      division: job.division,
      subtotal: String(subtotal),
      gst_amount: String(gst),
      total: String(subtotal + gst),
    });
  }

  function exportQBCSV() {
    const visible = filtered.filter(i => i.status !== 'void');
    if (!visible.length) { showToast('No invoices to export', 'warning'); return; }

    const rows = [
      ['!TRNS', 'TRNSTYPE', 'DATE', 'ACCNT', 'NAME', 'AMOUNT', 'DOCNUM', 'MEMO'],
      ['!SPL', 'TRNSTYPE', 'DATE', 'ACCNT', 'NAME', 'AMOUNT', 'MEMO'],
      ['!ENDTRNS'],
    ];

    visible.forEach(inv => {
      const cl = clients[inv.client_id];
      const name = cl ? clientName(cl) : 'Unknown';
      const date = inv.issued_date ? inv.issued_date.replace(/-/g, '/') : '';
      rows.push(['TRNS', 'INVOICE', date, 'Accounts Receivable', name, String(inv.total || 0), inv.invoice_number || '', inv.notes || '']);
      rows.push(['SPL', 'INVOICE', date, 'Revenue', name, String(-(Number(inv.subtotal) || 0)), divisionLabel(inv.division)]);
      if (Number(inv.gst_amount) > 0) {
        rows.push(['SPL', 'INVOICE', date, 'GST Payable', name, String(-(Number(inv.gst_amount) || 0)), 'GST 5%']);
      }
      rows.push(['ENDTRNS']);
    });

    const csv = rows.map(r => r.join('\t')).join('\n');
    const blob = new Blob([csv], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `FSS_Invoices_QB_${new Date().toISOString().slice(0, 10)}.iif`;
    a.click(); URL.revokeObjectURL(url);
    showToast('QuickBooks IIF exported', 'success');
  }

  function exportCSV() {
    const visible = filtered;
    if (!visible.length) { showToast('No invoices to export', 'warning'); return; }
    const headers = ['Invoice #', 'Client', 'Division', 'Issued', 'Due', 'Status', 'Subtotal', 'GST', 'Total'];
    const rows = visible.map(inv => {
      const cl = clients[inv.client_id];
      return [
        inv.invoice_number || '',
        cl ? clientName(cl) : '',
        divisionLabel(inv.division),
        inv.issued_date || '',
        inv.due_date || '',
        inv.status || '',
        inv.subtotal || 0,
        inv.gst_amount || 0,
        inv.total || 0,
      ].map(v => `"${v}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `FSS_Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const filtered = invoices.filter(i => {
    const cl = clients[i.client_id];
    const matchSearch = !search ||
      (i.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (cl && clientName(cl).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalOutstanding = filtered.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (Number(i.total) || 0), 0);
  const totalPaid = filtered.filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.total) || 0), 0);

  // Jobs without invoices
  const uninvoicedJobs = jobs.filter(j => ['complete', 'invoiced'].includes(j.status) && !invoices.some(i => i.job_id === j.id));

  return (
    <PageShell title="Invoices" actions={
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="secondary" size="sm" onClick={exportCSV}><Icon name="download" size={13} /> CSV</Btn>
        <Btn variant="secondary" size="sm" onClick={exportQBCSV}><Icon name="download" size={13} /> QuickBooks IIF</Btn>
        <Btn onClick={() => setEditing({ ...EMPTY })}><Icon name="plus" size={14} /> New Invoice</Btn>
      </div>
    }>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ background: colors.card, borderRadius: radius.md, padding: '10px 16px', boxShadow: shadow.sm, flex: 1 }}>
          <div style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>Outstanding</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.warning }}>{formatCurrency(totalOutstanding)}</div>
        </div>
        <div style={{ background: colors.card, borderRadius: radius.md, padding: '10px 16px', boxShadow: shadow.sm, flex: 1 }}>
          <div style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>Paid (filtered)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.success }}>{formatCurrency(totalPaid)}</div>
        </div>
        {uninvoicedJobs.length > 0 && (
          <div style={{ background: '#fffbeb', borderRadius: radius.md, padding: '10px 16px', boxShadow: shadow.sm, flex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="alert" size={16} color={colors.warning} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.warning }}>{uninvoicedJobs.length} completed job{uninvoicedJobs.length > 1 ? 's' : ''} not yet invoiced</div>
              <div style={{ fontSize: 11, color: colors.textSecondary }}>{uninvoicedJobs.slice(0, 2).map(j => j.job_number || j.title).join(', ')}{uninvoicedJobs.length > 2 ? ` +${uninvoicedJobs.length - 2} more` : ''}</div>
            </div>
            <Btn size="sm" variant="secondary" style={{ marginLeft: 'auto' }} onClick={() => createFromJob(uninvoicedJobs[0])}>Invoice Next</Btn>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Icon name="search" size={14} color={colors.textMuted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search invoices…"
            style={{ width: '100%', padding: '7px 10px 7px 32px', border: `1px solid ${colors.border}`, borderRadius: radius.md, fontSize: 13, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
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
        <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>No invoices found</div>
      ) : (
        <div style={{ background: colors.card, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {['Invoice #', 'Client', 'Division', 'Issued', 'Due', 'Status', 'Total', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', background: colors.bg }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const cl = clients[inv.client_id];
                const [sc, sbg] = STATUS_COLORS[inv.status] || [colors.textMuted, '#f8fafc'];
                const overdue = inv.status === 'overdue' || (inv.status === 'sent' && inv.due_date && inv.due_date < new Date().toISOString().slice(0, 10));
                return (
                  <tr key={inv.id} style={{ borderBottom: `1px solid ${colors.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = colors.bg}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: colors.textMuted }}>{inv.invoice_number || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: colors.text }}>{cl ? clientName(cl) : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: inv.division === 'carpentry' ? colors.carpentryLight : colors.softwashLight,
                        color: inv.division === 'carpentry' ? colors.carpentry : colors.softwash,
                      }}>{divisionLabel(inv.division)}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: colors.textSecondary }}>{formatDate(inv.issued_date)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: overdue ? colors.danger : colors.textSecondary, fontWeight: overdue ? 600 : 400 }}>
                      {formatDate(inv.due_date)}{overdue && ' ⚠'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: sbg, color: sc, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: colors.text }}>{formatCurrency(inv.total)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditing(inv)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                          <Icon name="edit" size={14} color={colors.textSecondary} />
                        </button>
                        <button onClick={() => handleDelete(inv.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
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
        <InvoiceModal
          invoice={editing}
          clients={clients}
          jobs={jobs}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </PageShell>
  );
}

function InvoiceModal({ invoice, clients, jobs, onSave, onClose }) {
  const isNew = !invoice.id;
  const [form, setForm] = useState({
    ...EMPTY,
    ...invoice,
    subtotal: invoice.subtotal ?? '',
    gst_amount: invoice.gst_amount ?? '',
    total: invoice.total ?? '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const clientList = Object.values(clients);

  function handleSubtotalChange(val) {
    const sub = Number(val) || 0;
    const gst = Math.round(sub * 0.05 * 100) / 100;
    setForm(f => ({ ...f, subtotal: val, gst_amount: String(gst), total: String(Math.round((sub + gst) * 100) / 100) }));
  }

  function handleJobSelect(jid) {
    set('job_id', jid);
    if (jid) {
      const job = jobs.find(j => j.id === jid);
      if (job) {
        const sub = (Number(job.labour_cost) || 0) + (Number(job.material_cost) || 0);
        const gst = Math.round(sub * 0.05 * 100) / 100;
        setForm(f => ({ ...f, job_id: jid, client_id: job.client_id || f.client_id, division: job.division || f.division, subtotal: String(sub), gst_amount: String(gst), total: String(Math.round((sub + gst) * 100) / 100) }));
      }
    }
  }

  const jobList = jobs.filter(j => !form.client_id || j.client_id === form.client_id);

  return (
    <Modal title={isNew ? 'New Invoice' : 'Edit Invoice'} onClose={onClose} width={600}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <div>
          <Field label="Client">
            <Select value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">— Select client —</option>
              {clientList.map(c => <option key={c.id} value={c.id}>{clientName(c)}</option>)}
            </Select>
          </Field>
          <Field label="Linked Job">
            <Select value={form.job_id} onChange={e => handleJobSelect(e.target.value)}>
              <option value="">— None —</option>
              {jobList.map(j => <option key={j.id} value={j.id}>{j.job_number} – {j.title}</option>)}
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
        </div>
        <div>
          <Field label="Issued Date">
            <Input type="date" value={form.issued_date} onChange={e => set('issued_date', e.target.value)} />
          </Field>
          <Field label="Due Date">
            <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </Field>
          <Field label="Subtotal ($)">
            <Input type="number" step="0.01" value={form.subtotal} onChange={e => handleSubtotalChange(e.target.value)} placeholder="0.00" />
          </Field>
          <Row>
            <Field label="GST 5% ($)">
              <Input type="number" step="0.01" value={form.gst_amount} onChange={e => set('gst_amount', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Total ($)">
              <Input type="number" step="0.01" value={form.total} onChange={e => set('total', e.target.value)} placeholder="0.00" />
            </Field>
          </Row>
        </div>
      </div>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Invoice notes…" rows={3} />
      </Field>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(form)}>Save Invoice</Btn>
      </Row>
    </Modal>
  );
}
