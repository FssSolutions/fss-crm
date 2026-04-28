import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import { colors, radius, shadow } from '../styles.js';
import { formatDate, clientName } from '../lib/utils.js';
import { PageShell } from './Dashboard.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Input, Select, Textarea, Row, Btn } from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';

const PRIORITY_COLORS = {
  high:   [colors.danger,  '#fef2f2'],
  medium: [colors.warning, '#fffbeb'],
  low:    [colors.info,    '#eff6ff'],
};

const EMPTY = {
  title: '', description: '', client_id: '', due_date: '',
  priority: 'medium', is_complete: false,
};

export default function TasksPage({ token, division, showToast }) {
  const [tasks, setTasks]     = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('pending');
  const [priority, setPriority] = useState('all');
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(token, 'tasks', { order: 'due_date.asc,priority.asc', limit: 500 });
      setTasks(Array.isArray(data) ? data : []);

      const clientIds = [...new Set((data || []).map(t => t.client_id).filter(Boolean))];
      if (clientIds.length) {
        const cs = await api.get(token, 'clients', { id: `in.(${clientIds.join(',')})`, select: 'id,first_name,last_name,company_name' });
        const map = {};
        (cs || []).forEach(c => { map[c.id] = c; });
        setClients(map);
      }
    } catch (e) { showToast('Failed to load tasks', 'error'); }
    finally { setLoading(false); }
  }

  async function handleSave(form) {
    try {
      const body = { ...form, client_id: form.client_id || null };
      if (editing?.id) {
        const updated = await api.patch(token, 'tasks', editing.id, body);
        const task = Array.isArray(updated) ? updated[0] : updated;
        setTasks(ts => ts.map(t => t.id === editing.id ? task : t));
      } else {
        const created = await api.post(token, 'tasks', body);
        const task = Array.isArray(created) ? created[0] : created;
        setTasks(ts => [task, ...ts]);
      }
      showToast('Task saved', 'success');
      setEditing(null);
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(token, 'tasks', id);
      setTasks(ts => ts.filter(t => t.id !== id));
      showToast('Task deleted', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function toggleComplete(task) {
    try {
      const updated = await api.patch(token, 'tasks', task.id, { is_complete: !task.is_complete });
      const t = Array.isArray(updated) ? updated[0] : updated;
      setTasks(ts => ts.map(x => x.id === task.id ? t : x));
    } catch (e) { showToast(e.message, 'error'); }
  }

  const today = new Date().toISOString().slice(0, 10);

  const filtered = tasks.filter(t => {
    const matchFilter =
      filter === 'all' ? true :
      filter === 'pending' ? !t.is_complete :
      filter === 'complete' ? t.is_complete :
      filter === 'overdue' ? (!t.is_complete && t.due_date && t.due_date < today) :
      filter === 'today' ? (t.due_date === today && !t.is_complete) :
      true;
    const matchPriority = priority === 'all' || t.priority === priority;
    return matchFilter && matchPriority;
  });

  const overdueCount = tasks.filter(t => !t.is_complete && t.due_date && t.due_date < today).length;
  const todayCount   = tasks.filter(t => !t.is_complete && t.due_date === today).length;

  return (
    <PageShell title="Tasks" actions={
      <Btn onClick={() => setEditing({ ...EMPTY })}><Icon name="plus" size={14} /> New Task</Btn>
    }>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { id: 'pending',  label: 'Pending' },
          { id: 'today',    label: `Today${todayCount ? ` (${todayCount})` : ''}` },
          { id: 'overdue',  label: `Overdue${overdueCount ? ` (${overdueCount})` : ''}` },
          { id: 'complete', label: 'Completed' },
          { id: 'all',      label: 'All' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '5px 14px', borderRadius: 20, border: `1px solid ${filter === f.id ? (f.id === 'overdue' ? colors.danger : colors.primary) : colors.border}`,
            background: filter === f.id ? (f.id === 'overdue' ? colors.danger : colors.primary) : '#fff',
            color: filter === f.id ? '#fff' : (f.id === 'overdue' ? colors.danger : colors.textSecondary),
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>{f.label}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {['all', 'high', 'medium', 'low'].map(p => (
            <button key={p} onClick={() => setPriority(p)} style={{
              padding: '5px 10px', borderRadius: 20, border: `1px solid ${priority === p ? colors.primary : colors.border}`,
              background: priority === p ? colors.primary + '18' : 'transparent',
              color: priority === p ? colors.primary : colors.textSecondary,
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
            }}>{p}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>No tasks here</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(task => {
            const cl = clients[task.client_id];
            const overdue = !task.is_complete && task.due_date && task.due_date < today;
            const dueToday = !task.is_complete && task.due_date === today;
            const [pc, pbg] = PRIORITY_COLORS[task.priority] || [colors.textMuted, '#f8fafc'];
            return (
              <div key={task.id} style={{
                background: colors.card, borderRadius: radius.md, padding: '12px 16px',
                boxShadow: shadow.sm, display: 'flex', alignItems: 'flex-start', gap: 12,
                borderLeft: `3px solid ${overdue ? colors.danger : dueToday ? colors.warning : task.is_complete ? colors.success : colors.border}`,
                opacity: task.is_complete ? 0.65 : 1,
              }}>
                {/* Checkbox */}
                <button
                  onClick={() => toggleComplete(task)}
                  style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: 4, marginTop: 1,
                    border: `2px solid ${task.is_complete ? colors.success : colors.border}`,
                    background: task.is_complete ? colors.success : '#fff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {task.is_complete && <Icon name="check" size={11} color="#fff" />}
                </button>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, textDecoration: task.is_complete ? 'line-through' : 'none' }}>
                      {task.title}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: pbg, color: pc, textTransform: 'uppercase' }}>
                      {task.priority}
                    </span>
                  </div>
                  {task.description && <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{task.description}</div>}
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: overdue ? colors.danger : colors.textMuted, fontWeight: overdue ? 600 : 400 }}>
                    {task.due_date && <span>{overdue ? '⚠ Overdue · ' : dueToday ? '📅 Due today · ' : ''}{formatDate(task.due_date)}</span>}
                    {cl && <span>· {clientName(cl)}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setEditing(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <Icon name="edit" size={14} color={colors.textSecondary} />
                  </button>
                  <button onClick={() => handleDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <Icon name="trash" size={14} color={colors.danger} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <TaskModal
          task={editing}
          clients={clients}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </PageShell>
  );
}

function TaskModal({ task, clients, onSave, onClose }) {
  const isNew = !task.id;
  const [form, setForm] = useState({ ...EMPTY, ...task });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const clientList = Object.values(clients);

  return (
    <Modal title={isNew ? 'New Task' : 'Edit Task'} onClose={onClose} width={480}>
      <Field label="Title *">
        <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Task title" autoFocus />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional details…" rows={2} />
      </Field>
      <Row>
        <Field label="Due Date">
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={e => set('priority', e.target.value)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </Field>
      </Row>
      <Field label="Linked Client">
        <Select value={form.client_id} onChange={e => set('client_id', e.target.value)}>
          <option value="">— None —</option>
          {clientList.map(c => <option key={c.id} value={c.id}>{clientName(c)}</option>)}
        </Select>
      </Field>
      {!isNew && (
        <Field label="Status">
          <Select value={form.is_complete ? 'complete' : 'pending'} onChange={e => set('is_complete', e.target.value === 'complete')}>
            <option value="pending">Pending</option>
            <option value="complete">Complete</option>
          </Select>
        </Field>
      )}
      <Row style={{ justifyContent: 'flex-end' }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(form)} disabled={!form.title.trim()}>Save Task</Btn>
      </Row>
    </Modal>
  );
}
