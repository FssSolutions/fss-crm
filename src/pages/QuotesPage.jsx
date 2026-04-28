import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import { colors, radius, shadow, font } from '../styles.js';
import { formatCurrency, formatDate, clientName, nextQuoteNumber, today, gst } from '../lib/utils.js';
import { generateQuotePdf } from '../lib/generateQuotePdf.js';
import { PageShell } from './Dashboard.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { Field, Input, Select, Textarea, Row, Btn } from '../components/Field.jsx';

const STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'];
const STATUS_COLORS = {
  draft: [colors.textMuted, '#f1f5f9'],
  sent: [colors.info, colors.infoLight],
  accepted: [colors.success, colors.softwashLight],
  declined: [colors.danger, colors.dangerLight],
  expired: [colors.warning, colors.carpentryLight],
};

export default function QuotesPage({ token, division, showToast, setPage }) {
  const [quotes, setQuotes]     = useState([]);
  const [clients, setClients]   = useState([]);
  const [priceBook, setBook]    = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editQ, setEditQ]       = useState(null);
  const [showBuilder, setBuilder] = useState(false);

  useEffect(() => { load(); }, [division]);

  async function load() {
    setLoading(true);
    try {
      const divParam = division !== 'all' ? { 'division': `eq.${division}` } : {};
      const [q, c, pb] = await Promise.all([
        api.get(token, 'quotes', { ...divParam, order: 'created_at.desc', limit: 200 }),
        api.get(token, 'clients', { order: 'first_name.asc', limit: 500, select: 'id,first_name,last_name,company_name' }),
        api.get(token, 'price_book', { 'is_active': 'eq.true', order: 'category.asc,name.asc' }),
      ]);
      setQuotes(Array.isArray(q) ? q : []);
      setClients(Array.isArray(c) ? c : []);
      setBook(Array.isArray(pb) ? pb : []);
    } finally { setLoading(false); }
  }

  async function deleteQuote(id) {
    if (!confirm('Delete this quote?')) return;
    await api.delete(token, 'quotes', id);
    setQuotes(qs => qs.filter(q => q.id !== id));
    showToast('Quote deleted');
  }

  async function convertToJob(quote) {
    const clientData = clients.find(c => c.id === quote.client_id);
    if (!confirm(`Convert "${quote.title}" to a Job?`)) return;
    const allJobs = await api.get(token, 'jobs', { select: 'job_number', order: 'created_at.desc', limit: 500 });
    const jobNum = nextJobNumber(Array.isArray(allJobs) ? allJobs : []);
    try {
      await api.post(token, 'jobs', {
        job_number: jobNum, quote_id: quote.id, client_id: quote.client_id,
        division: quote.division, title: quote.title, property_address: quote.property_address,
        status: 'scheduled', quoted_amount: quote.total, payment_status: 'unpaid',
      });
      await api.patch(token, 'quotes', quote.id, { status: 'accepted', accepted_date: today() });
      setQuotes(qs => qs.map(q => q.id === quote.id ? { ...q, status: 'accepted', accepted_date: today() } : q));
      showToast(`Job ${jobNum} created — go to Jobs to schedule it`);
      setPage('jobs');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function downloadPdf(quote) {
    const client = clients.find(c => c.id === quote.client_id);
    const items = await api.get(token, 'quote_line_items', { 'quote_id': `eq.${quote.id}`, order: 'sort_order.asc' });
    generateQuotePdf(quote, client, Array.isArray(items) ? items : []);
  }

  function nextQNum() {
    return nextQuoteNumber(quotes);
  }

  return (
    <PageShell title="Quotes" actions={
      <Btn onClick={() => { setEditQ(null); setBuilder(true); }}>
        <Icon name="plus" size={16} /> New Quote
      </Btn>
    }>
      {loading ? <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>Loading…</div> : (
        <div style={{ background: colors.card, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: colors.bg }}>
                {['Quote #', 'Title', 'Client', 'Division', 'Status', 'Total', 'Issued', 'Expires', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${colors.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: colors.textMuted }}>No quotes yet</td></tr>
              )}
              {quotes.map(q => {
                const client = clients.find(c => c.id === q.client_id);
                const [c, bg] = STATUS_COLORS[q.status] || [colors.textMuted, colors.border];
                const expired = q.expiry_date && new Date(q.expiry_date) < new Date() && q.status === 'sent';
                return (
                  <tr key={q.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{q.quote_number}</td>
                    <td style={{ padding: '10px 14px' }}>{q.title}</td>
                    <td style={{ padding: '10px 14px', color: colors.textSecondary }}>{clientName(client)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <DivBadge div={q.division} />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: bg, color: c, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
                        {expired ? 'expired' : q.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{formatCurrency(q.total)}</td>
                    <td style={{ padding: '10px 14px', color: colors.textSecondary, fontSize: 12 }}>{formatDate(q.issued_date)}</td>
                    <td style={{ padding: '10px 14px', color: expired ? colors.danger : colors.textSecondary, fontSize: 12 }}>{formatDate(q.expiry_date)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <ActionBtn title="Download PDF" icon="download" onClick={() => downloadPdf(q)} />
                        <ActionBtn title="Edit" icon="edit" onClick={() => { setEditQ(q); setBuilder(true); }} />
                        {q.status !== 'accepted' && (
                          <ActionBtn title="Convert to Job" icon="jobs" onClick={() => convertToJob(q)} />
                        )}
                        <ActionBtn title="Delete" icon="trash" onClick={() => deleteQuote(q.id)} danger />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showBuilder && (
        <QuoteBuilder
          quote={editQ}
          clients={clients}
          priceBook={priceBook}
          defaultDivision={division !== 'all' ? division : 'softwash'}
          nextQNum={nextQNum()}
          token={token}
          onSaved={q => {
            if (editQ) setQuotes(qs => qs.map(x => x.id === q.id ? q : x));
            else setQuotes(qs => [q, ...qs]);
            setBuilder(false); setEditQ(null);
            showToast(editQ ? 'Quote updated' : 'Quote created');
          }}
          onClose={() => { setBuilder(false); setEditQ(null); }}
        />
      )}
    </PageShell>
  );
}

// ── Quote Builder Modal ──────────────────────────────────────────────────────
function QuoteBuilder({ quote: q, clients, priceBook, defaultDivision, nextQNum, token, onSaved, onClose }) {
  const [form, setForm] = useState({
    quote_number: q?.quote_number || nextQNum,
    client_id: q?.client_id || '',
    division: q?.division || defaultDivision,
    status: q?.status || 'draft',
    title: q?.title || '',
    property_address: q?.property_address || '',
    issued_date: q?.issued_date || today(),
    expiry_date: q?.expiry_date || '',
    notes: q?.notes || '',
    internal_notes: q?.internal_notes || '',
    version: q?.version || 1,
  });
  const [items, setItems] = useState([]);
  const [loading, setLoad] = useState(!!q);
  const [showPbPicker, setPbPicker] = useState(false);

  useEffect(() => {
    if (q) {
      api.get(token, 'quote_line_items', { 'quote_id': `eq.${q.id}`, order: 'sort_order.asc' })
        .then(data => { setItems(Array.isArray(data) ? data : []); setLoad(false); });
    }
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function addBlankLine() {
    setItems(prev => [...prev, { id: crypto.randomUUID(), description: '', quantity: 1, unit: '', unit_price: 0, line_total: 0, is_taxable: true, category: '', sort_order: prev.length }]);
  }

  function addFromPriceBook(pb) {
    setItems(prev => [...prev, { id: crypto.randomUUID(), description: pb.name, quantity: 1, unit: pb.default_unit || '', unit_price: +pb.default_price, line_total: +pb.default_price, is_taxable: pb.is_taxable, category: pb.category, sort_order: prev.length }]);
    setPbPicker(false);
  }

  function updateItem(idx, key, val) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [key]: val };
      if (key === 'quantity' || key === 'unit_price') {
        const q = key === 'quantity' ? +val : +updated.quantity;
        const p = key === 'unit_price' ? +val : +updated.unit_price;
        updated.line_total = Math.round(q * p * 100) / 100;
      }
      return updated;
    }));
  }

  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  const taxableSubtotal = items.filter(i => i.is_taxable).reduce((s, i) => s + (+i.line_total || 0), 0);
  const nonTaxable = items.filter(i => !i.is_taxable).reduce((s, i) => s + (+i.line_total || 0), 0);
  const subtotal = taxableSubtotal + nonTaxable;
  const gstAmount = gst(taxableSubtotal);
  const total = subtotal + gstAmount;

  async function submit(e) {
    e.preventDefault();
    try {
      const quoteBody = { ...form, subtotal: Math.round(subtotal * 100) / 100, gst_amount: Math.round(gstAmount * 100) / 100, total: Math.round(total * 100) / 100 };
      let savedQuote;
      if (q) {
        const [updated] = await api.patch(token, 'quotes', q.id, quoteBody);
        savedQuote = updated || { ...q, ...quoteBody };
      } else {
        const [created] = await api.post(token, 'quotes', quoteBody);
        savedQuote = created;
      }

      if (q) {
        const existing = await api.get(token, 'quote_line_items', { 'quote_id': `eq.${q.id}`, select: 'id' });
        for (const ex of (existing || [])) await api.delete(token, 'quote_line_items', ex.id);
      }
      for (let i = 0; i < items.length; i++) {
        const { id: _id, ...itemBody } = items[i];
        await api.post(token, 'quote_line_items', { ...itemBody, quote_id: savedQuote.id, sort_order: i });
      }
      onSaved(savedQuote);
    } catch (err) { console.error(err); }
  }

  const divBooks = priceBook.filter(pb => pb.division === form.division || !form.division);
  const categories = [...new Set(divBooks.map(pb => pb.category))];

  return (
    <Modal title={q ? `Edit Quote ${q.quote_number}` : 'New Quote'} onClose={onClose} width={760}>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div> : (
        <form onSubmit={submit}>
          <Row>
            <Field label="Quote #" style={{ flex: 1 }}><Input value={form.quote_number} onChange={set('quote_number')} required /></Field>
            <Field label="Division" style={{ flex: 1 }}>
              <Select value={form.division} onChange={set('division')} required>
                <option value="carpentry">Carpentry</option>
                <option value="softwash">Soft Wash</option>
              </Select>
            </Field>
            <Field label="Status" style={{ flex: 1 }}>
              <Select value={form.status} onChange={set('status')}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </Row>
          <Row>
            <Field label="Client" required style={{ flex: 2 }}>
              <Select value={form.client_id} onChange={set('client_id')} required>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{clientName(c)}</option>)}
              </Select>
            </Field>
            <Field label="Version" style={{ flex: 1 }}><Input type="number" value={form.version} onChange={set('version')} min={1} /></Field>
          </Row>
          <Field label="Title / Job Description" required>
            <Input value={form.title} onChange={set('title')} required placeholder="e.g. House wash – 1420 E Pender" />
          </Field>
          <Row>
            <Field label="Property Address" style={{ flex: 2 }}><Input value={form.property_address} onChange={set('property_address')} /></Field>
            <Field label="Issued" style={{ flex: 1 }}><Input type="date" value={form.issued_date} onChange={set('issued_date')} /></Field>
            <Field label="Expires" style={{ flex: 1 }}><Input type="date" value={form.expiry_date} onChange={set('expiry_date')} /></Field>
          </Row>

          {/* Line items */}
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Line Items</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={() => setPbPicker(true)} type="button">
                <Icon name="pricebook" size={14} /> From Price Book
              </Btn>
              <Btn size="sm" variant="ghost" onClick={addBlankLine} type="button">
                <Icon name="plus" size={14} /> Add Line
              </Btn>
            </div>
          </div>

          <div style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, overflow: 'hidden', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: colors.bg }}>
                  {['Description', 'Qty', 'Unit', 'Price', 'Total', 'Tax', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, fontWeight: 700, color: colors.textSecondary }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: colors.textMuted, fontSize: 12 }}>No line items — add from price book or manually</td></tr>
                )}
                {items.map((item, idx) => (
                  <tr key={item.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '6px 8px' }}><input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit' }} /></td>
                    <td style={{ padding: '6px 8px', width: 60 }}><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} min={0} step={0.01} style={{ width: 55, border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit' }} /></td>
                    <td style={{ padding: '6px 8px', width: 65 }}><input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ width: 60, border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit' }} /></td>
                    <td style={{ padding: '6px 8px', width: 80 }}><input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} min={0} step={0.01} style={{ width: 75, border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit' }} /></td>
                    <td style={{ padding: '6px 8px', width: 80, fontWeight: 600 }}>{formatCurrency(item.line_total)}</td>
                    <td style={{ padding: '6px 8px', width: 40, textAlign: 'center' }}>
                      <input type="checkbox" checked={!!item.is_taxable} onChange={e => updateItem(idx, 'is_taxable', e.target.checked)} />
                    </td>
                    <td style={{ padding: '6px 8px', width: 30 }}>
                      <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger, padding: 0 }}>
                        <Icon name="close" size={14} color={colors.danger} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <div style={{ width: 240 }}>
              {[['Subtotal', formatCurrency(subtotal)], ['GST (5%)', formatCurrency(gstAmount)]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, color: colors.textSecondary }}>
                  <span>{k}</span><span>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: `2px solid ${colors.text}`, paddingTop: 6, marginTop: 4 }}>
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <Row>
            <Field label="Notes (printed on quote)" style={{ flex: 1 }}><Textarea value={form.notes} onChange={set('notes')} rows={2} /></Field>
            <Field label="Internal Notes" style={{ flex: 1 }}><Textarea value={form.internal_notes} onChange={set('internal_notes')} rows={2} /></Field>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Btn variant="ghost" onClick={onClose} type="button">Cancel</Btn>
            <Btn type="submit">{q ? 'Save Changes' : 'Create Quote'}</Btn>
          </div>
        </form>
      )}

      {showPbPicker && (
        <Modal title="Add from Price Book" onClose={() => setPbPicker(false)} width={540}>
          {categories.map(cat => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 6 }}>{cat}</div>
              {divBooks.filter(pb => pb.category === cat).map(pb => (
                <div key={pb.id} onClick={() => addFromPriceBook(pb)} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '8px 10px',
                  borderRadius: radius.md, cursor: 'pointer', marginBottom: 2,
                  background: colors.bg,
                }} onMouseEnter={e => e.currentTarget.style.background = colors.primaryLight}
                   onMouseLeave={e => e.currentTarget.style.background = colors.bg}>
                  <span style={{ fontSize: 13 }}>{pb.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(pb.default_price)}{pb.default_unit ? `/${pb.default_unit}` : ''}</span>
                </div>
              ))}
            </div>
          ))}
        </Modal>
      )}
    </Modal>
  );
}

function DivBadge({ div }) {
  const color = div === 'carpentry' ? colors.carpentry : colors.softwash;
  const bg = div === 'carpentry' ? colors.carpentryLight : colors.softwashLight;
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{div}</span>;
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

function nextJobNumber(jobs) {
  const year = new Date().getFullYear();
  const nums = jobs.map(j => parseInt((j.job_number || '').split('-')[2] || '0')).filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `JOB-${year}-${String(next).padStart(3, '0')}`;
}
