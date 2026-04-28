import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import { colors, font, radius, shadow, spacing } from '../styles.js';
import { formatCurrency, formatDate, clientName, divisionLabel } from '../lib/utils.js';
import Icon from '../components/Icon.jsx';

export default function Dashboard({ token, division, showToast, setPage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [division]);

  async function load() {
    setLoading(true);
    try {
      const divFilter = division !== 'all' ? `division=eq.${division}&` : '';

      const [quotes, jobs, invoices, tasks, clients] = await Promise.all([
        api.get(token, 'quotes', { [`${divFilter}order`]: 'created_at.desc', limit: 200, select: 'id,status,total,division,issued_date,title' }),
        api.get(token, 'jobs', { [`${divFilter}order`]: 'scheduled_date.asc', limit: 200, select: 'id,status,payment_status,invoiced_amount,quoted_amount,scheduled_date,title,division,client_id' }),
        api.get(token, 'invoices', { [`${divFilter}order`]: 'issued_date.desc', limit: 200, select: 'id,status,total,division,issued_date,due_date,client_id' }),
        api.get(token, 'tasks', { 'is_complete=eq.false&order': 'due_date.asc', limit: 50, select: 'id,title,due_date,priority,client_id' }),
        api.get(token, 'clients', { 'next_followup_at=not.is': null, order: 'next_followup_at.asc', limit: 10, select: 'id,first_name,last_name,company_name,next_followup_at,lead_status' }),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const pendingQuotes = (quotes || []).filter(q => ['draft', 'sent'].includes(q.status));
      const revenueInvoiced = (invoices || []).filter(i => i.status !== 'void').reduce((s, i) => s + (+i.total || 0), 0);
      const outstanding = (invoices || []).filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (+i.total || 0), 0);
      const todayTasks = (tasks || []).filter(t => t.due_date && t.due_date <= today);
      const upcomingJobs = (jobs || []).filter(j => j.scheduled_date && j.scheduled_date >= today && ['scheduled', 'in-progress'].includes(j.status)).slice(0, 5);
      const overdueTasks = (tasks || []).filter(t => t.due_date && t.due_date < today);

      setData({ pendingQuotes, revenueInvoiced, outstanding, todayTasks, upcomingJobs, overdueTasks, followups: clients || [] });
    } catch (e) {
      showToast('Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <PageShell title="Dashboard"><Spinner /></PageShell>;

  const { pendingQuotes, revenueInvoiced, outstanding, todayTasks, upcomingJobs, overdueTasks, followups } = data;

  return (
    <PageShell title="Dashboard">
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard label="Total Invoiced" value={formatCurrency(revenueInvoiced)} icon="invoices" color={colors.primary} />
        <KPICard label="Outstanding" value={formatCurrency(outstanding)} icon="alert" color={colors.warning} />
        <KPICard label="Open Quotes" value={pendingQuotes.length} icon="quotes" color={colors.softwash} />
        <KPICard label="Tasks Due Today" value={todayTasks.length + overdueTasks.length} icon="tasks" color={overdueTasks.length ? colors.danger : colors.success} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Today's tasks */}
        <Card title="Tasks Due Today" onMore={() => setPage('tasks')} count={todayTasks.length + overdueTasks.length}>
          {[...overdueTasks, ...todayTasks].length === 0
            ? <Empty text="No tasks due today" />
            : [...overdueTasks, ...todayTasks].slice(0, 8).map(t => (
                <TaskRow key={t.id} task={t} overdue={overdueTasks.includes(t)} />
              ))
          }
        </Card>

        {/* Upcoming jobs */}
        <Card title="Upcoming Jobs" onMore={() => setPage('jobs')} count={upcomingJobs.length}>
          {upcomingJobs.length === 0
            ? <Empty text="No upcoming scheduled jobs" />
            : upcomingJobs.map(j => (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{j.title}</div>
                    <div style={{ fontSize: 11, color: colors.textSecondary }}>{formatDate(j.scheduled_date)} · {divisionLabel(j.division)}</div>
                  </div>
                  <StatusBadge status={j.status} />
                </div>
              ))
          }
        </Card>

        {/* Pending quotes */}
        <Card title="Open Quotes" onMore={() => setPage('quotes')} count={pendingQuotes.length}>
          {pendingQuotes.length === 0
            ? <Empty text="No open quotes" />
            : pendingQuotes.slice(0, 6).map(q => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{q.title}</div>
                    <div style={{ fontSize: 11, color: colors.textSecondary }}>{divisionLabel(q.division)} · {formatDate(q.issued_date)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(q.total)}</div>
                </div>
              ))
          }
        </Card>

        {/* Follow-ups due */}
        <Card title="Follow-ups Due" onMore={() => setPage('clients')} count={followups.length}>
          {followups.length === 0
            ? <Empty text="No follow-ups scheduled" />
            : followups.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{clientName(c)}</div>
                    <div style={{ fontSize: 11, color: colors.textSecondary }}>{formatDate(c.next_followup_at)}</div>
                  </div>
                  <LeadBadge status={c.lead_status} />
                </div>
              ))
          }
        </Card>
      </div>
    </PageShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function KPICard({ label, value, icon, color }) {
  return (
    <div style={{
      background: colors.card, borderRadius: radius.lg, padding: '18px 20px',
      boxShadow: shadow.sm, display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ background: color + '18', borderRadius: 10, padding: 10, flexShrink: 0 }}>
        <Icon name={icon} size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>{value}</div>
        <div style={{ fontSize: 12, color: colors.textSecondary }}>{label}</div>
      </div>
    </div>
  );
}

function Card({ title, children, onMore, count }) {
  return (
    <div style={{ background: colors.card, borderRadius: radius.lg, padding: '16px 20px', boxShadow: shadow.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        {count > 0 && (
          <button onClick={onMore} style={{ fontSize: 12, color: colors.primary, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            View all ({count})
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function TaskRow({ task, overdue }) {
  const today = new Date().toISOString().slice(0, 10);
  const color = overdue ? colors.danger : task.due_date === today ? colors.warning : colors.textSecondary;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${colors.border}` }}>
      <div style={{ fontSize: 13 }}>{task.title}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color }}>{formatDate(task.due_date)}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    scheduled: [colors.info, colors.infoLight],
    'in-progress': [colors.warning, colors.carpentryLight],
    complete: [colors.success, colors.softwashLight],
    invoiced: ['#7c3aed', '#f5f3ff'],
    paid: [colors.success, colors.softwashLight],
    cancelled: [colors.textMuted, colors.borderLight],
  };
  const [c, bg] = map[status] || [colors.textMuted, colors.borderLight];
  return (
    <span style={{ background: bg, color: c, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

function LeadBadge({ status }) {
  const map = { hot: colors.danger, warm: colors.warning, cold: colors.info, dead: colors.textMuted };
  return (
    <span style={{ background: (map[status] || colors.textMuted) + '22', color: map[status] || colors.textMuted, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

function Empty({ text }) {
  return <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: 13, padding: '20px 0' }}>{text}</div>;
}

function Spinner() {
  return <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>Loading…</div>;
}

export function PageShell({ title, actions, children }) {
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: font.xxl, fontWeight: 700, color: colors.text }}>{title}</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div>
      </div>
      {children}
    </div>
  );
}
