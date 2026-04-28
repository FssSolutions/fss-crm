import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import { colors, radius, shadow, font } from '../styles.js';
import { formatCurrency, formatDate, clientName, divisionLabel } from '../lib/utils.js';
import { PageShell } from './Dashboard.jsx';

const QUOTE_STAGES = [
  { id: 'draft',    label: 'Draft',    bg: colors.kanbanDraft },
  { id: 'sent',     label: 'Sent',     bg: colors.kanbanSent },
  { id: 'accepted', label: 'Accepted', bg: colors.kanbanAccepted },
  { id: 'declined', label: 'Declined', bg: colors.kanbanDeclined },
  { id: 'expired',  label: 'Expired',  bg: '#fef9ec' },
];

const JOB_STAGES = [
  { id: 'scheduled',   label: 'Scheduled',   bg: colors.kanbanScheduled },
  { id: 'in-progress', label: 'In Progress', bg: colors.kanbanInProgress },
  { id: 'complete',    label: 'Complete',    bg: colors.kanbanComplete },
  { id: 'invoiced',    label: 'Invoiced',    bg: colors.kanbanInvoiced },
  { id: 'paid',        label: 'Paid',        bg: colors.kanbanPaid },
];

export default function PipelinePage({ token, division, showToast }) {
  const [view, setView]       = useState('quotes');
  const [quotes, setQuotes]   = useState([]);
  const [jobs, setJobs]       = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);

  useEffect(() => { load(); }, [division, view]);

  async function load() {
    setLoading(true);
    try {
      const divParam = division !== 'all' ? { 'division': `eq.${division}` } : {};

      if (view === 'quotes') {
        const data = await api.get(token, 'quotes', { ...divParam, order: 'created_at.desc', limit: 200 });
        setQuotes(Array.isArray(data) ? data : []);
        const clientIds = [...new Set((data || []).map(q => q.client_id).filter(Boolean))];
        if (clientIds.length) {
          const cs = await api.get(token, 'clients', { 'id': `in.(${clientIds.join(',')})`, select: 'id,first_name,last_name,company_name' });
          const map = {};
          (cs || []).forEach(c => { map[c.id] = c; });
          setClients(map);
        }
      } else {
        const data = await api.get(token, 'jobs', { ...divParam, order: 'scheduled_date.asc', limit: 200 });
        setJobs(Array.isArray(data) ? data : []);
        const clientIds = [...new Set((data || []).map(j => j.client_id).filter(Boolean))];
        if (clientIds.length) {
          const cs = await api.get(token, 'clients', { 'id': `in.(${clientIds.join(',')})`, select: 'id,first_name,last_name,company_name' });
          const map = {};
          (cs || []).forEach(c => { map[c.id] = c; });
          setClients(map);
        }
      }
    } catch (e) { showToast('Failed to load pipeline', 'error'); }
    finally { setLoading(false); }
  }

  async function moveQuote(id, newStatus) {
    try {
      await api.patch(token, 'quotes', id, { status: newStatus });
      setQuotes(qs => qs.map(q => q.id === id ? { ...q, status: newStatus } : q));
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function moveJob(id, newStatus) {
    try {
      await api.patch(token, 'jobs', id, { status: newStatus });
      setJobs(js => js.map(j => j.id === id ? { ...j, status: newStatus } : j));
    } catch (e) { showToast(e.message, 'error'); }
  }

  const stages = view === 'quotes' ? QUOTE_STAGES : JOB_STAGES;
  const items  = view === 'quotes' ? quotes : jobs;

  return (
    <PageShell title="Pipeline" actions={
      <div style={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: radius.md, overflow: 'hidden' }}>
        {['quotes', 'jobs'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '7px 18px', border: 'none', cursor: 'pointer',
            background: view === v ? colors.primary : '#fff',
            color: view === v ? '#fff' : colors.textSecondary,
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textTransform: 'capitalize',
          }}>
            {v === 'quotes' ? 'Quotes' : 'Jobs'}
          </button>
        ))}
      </div>
    }>
      {loading ? <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>Loading…</div> : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
          {stages.map(stage => {
            const stageItems = items.filter(i => i.status === stage.id);
            return (
              <div key={stage.id}
                style={{ minWidth: 240, flex: '0 0 240px', background: stage.bg, borderRadius: radius.lg, padding: 12 }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (!dragging) return;
                  if (view === 'quotes') moveQuote(dragging, stage.id);
                  else moveJob(dragging, stage.id);
                  setDragging(null);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {stage.label}
                  </span>
                  <span style={{ fontSize: 11, background: 'rgba(0,0,0,0.08)', borderRadius: 20, padding: '2px 8px', fontWeight: 700, color: colors.textSecondary }}>
                    {stageItems.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stageItems.map(item => (
                    <KanbanCard
                      key={item.id}
                      item={item}
                      client={clients[item.client_id]}
                      view={view}
                      onDragStart={() => setDragging(item.id)}
                      onDragEnd={() => setDragging(null)}
                    />
                  ))}
                  {stageItems.length === 0 && (
                    <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: 12, padding: '16px 0' }}>No {view} here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

function KanbanCard({ item, client, view, onDragStart, onDragEnd }) {
  const divColor = item.division === 'carpentry' ? colors.carpentry : item.division === 'softwash' ? colors.softwash : colors.primary;

  return (
    <div draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: '#fff', borderRadius: radius.md, padding: '10px 12px',
        boxShadow: shadow.sm, cursor: 'grab', userSelect: 'none',
        borderLeft: `3px solid ${divColor}`,
      }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: colors.text }}>{item.title}</div>
      {client && <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>{clientName(client)}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {view === 'quotes'
          ? <span style={{ fontSize: 12, fontWeight: 700 }}>{formatCurrency(item.total)}</span>
          : <span style={{ fontSize: 11, color: colors.textSecondary }}>{formatDate(item.scheduled_date)}</span>
        }
        <span style={{ fontSize: 10, background: divColor + '22', color: divColor, padding: '1px 6px', borderRadius: 20, fontWeight: 600, textTransform: 'capitalize' }}>
          {divisionLabel(item.division)}
        </span>
      </div>
      {view === 'quotes' && item.expiry_date && new Date(item.expiry_date) < new Date() && (
        <div style={{ fontSize: 10, color: colors.danger, marginTop: 4 }}>Expired {formatDate(item.expiry_date)}</div>
      )}
      {view === 'quotes' && item.quote_number && (
        <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{item.quote_number}</div>
      )}
      {view === 'jobs' && item.job_number && (
        <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{item.job_number}</div>
      )}
    </div>
  );
}
