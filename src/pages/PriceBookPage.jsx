import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import { colors, radius, shadow } from '../styles.js';
import { formatCurrency, divisionLabel } from '../lib/utils.js';
import { PageShell } from './Dashboard.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Input, Select, Textarea, Row, Btn } from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';

const EMPTY = {
  division: 'carpentry', category: '', name: '', description: '',
  unit: 'each', default_price: '', is_active: true,
};

export default function PriceBookPage({ token, division, showToast }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('all');
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, [division]);

  async function load() {
    setLoading(true);
    try {
      const divParam = division !== 'all' ? { division: `eq.${division}` } : {};
      const data = await api.get(token, 'price_book', { ...divParam, order: 'division.asc,category.asc,name.asc', limit: 500 });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) { showToast('Failed to load price book', 'error'); }
    finally { setLoading(false); }
  }

  async function handleSave(form) {
    try {
      const body = { ...form, default_price: Number(form.default_price) || 0 };
      if (editing?.id) {
        const updated = await api.patch(token, 'price_book', editing.id, body);
        const item = Array.isArray(updated) ? updated[0] : updated;
        setItems(is => is.map(i => i.id === editing.id ? item : i));
      } else {
        const created = await api.post(token, 'price_book', body);
        const item = Array.isArray(created) ? created[0] : created;
        setItems(is => [...is, item].sort((a, b) => a.name.localeCompare(b.name)));
      }
      showToast('Item saved', 'success');
      setEditing(null);
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this price book item?')) return;
    try {
      await api.delete(token, 'price_book', id);
      setItems(is => is.filter(i => i.id !== id));
      showToast('Item deleted', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function toggleActive(item) {
    try {
      const updated = await api.patch(token, 'price_book', item.id, { is_active: !item.is_active });
      const u = Array.isArray(updated) ? updated[0] : updated;
      setItems(is => is.map(i => i.id === item.id ? u : i));
    } catch (e) { showToast(e.message, 'error'); }
  }

  const activeFilter = divFilter === 'all' ? items : items.filter(i => i.division === divFilter);
  const filtered = activeFilter.filter(i =>
    !search ||
    (i.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.description || '').toLowerCase().includes(search.toLowerCase())
  );

  // Group by division then category
  const groups = {};
  filtered.forEach(item => {
    const key = `${item.division}||${item.category || 'Uncategorized'}`;
    if (!groups[key]) groups[key] = { division: item.division, category: item.category || 'Uncategorized', items: [] };
    groups[key].items.push(item);
  });
  const groupList = Object.values(groups);

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

  return (
    <PageShell title="Price Book" actions={
      <Btn onClick={() => setEditing({ ...EMPTY, division: division !== 'all' ? division : 'carpentry' })}>
        <Icon name="plus" size={14} /> Add Item
      </Btn>
    }>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Icon name="search" size={14} color={colors.textMuted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search items…"
            style={{ width: '100%', padding: '7px 10px 7px 32px', border: `1px solid ${colors.border}`, borderRadius: radius.md, fontSize: 13, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
          />
        </div>
        {division === 'all' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'carpentry', 'softwash'].map(d => (
              <button key={d} onClick={() => setDivFilter(d)} style={{
                padding: '5px 12px', borderRadius: 20, border: `1px solid ${divFilter === d ? colors.primary : colors.border}`,
                background: divFilter === d ? colors.primary : '#fff',
                color: divFilter === d ? '#fff' : colors.textSecondary,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
              }}>{d === 'all' ? 'All' : divisionLabel(d)}</button>
            ))}
          </div>
        )}
        <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 'auto' }}>{filtered.length} items</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: colors.textMuted }}>No items found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groupList.map(group => (
            <div key={`${group.division}||${group.category}`} style={{ background: colors.card, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
              <div style={{
                padding: '10px 16px', background: colors.bg, borderBottom: `1px solid ${colors.border}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize',
                  background: group.division === 'carpentry' ? colors.carpentryLight : colors.softwashLight,
                  color: group.division === 'carpentry' ? colors.carpentry : colors.softwash,
                }}>{divisionLabel(group.division)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{group.category}</span>
                <span style={{ fontSize: 11, color: colors.textMuted }}>{group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {group.items.map(item => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${colors.border}`, opacity: item.is_active ? 1 : 0.5 }}
                      onMouseEnter={e => e.currentTarget.style.background = colors.bg}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '10px 16px', width: '35%' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{item.name}</div>
                        {item.description && <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{item.description}</div>}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: colors.textSecondary }}>{item.unit || '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 14, fontWeight: 700, color: colors.text }}>{formatCurrency(item.default_price)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => toggleActive(item)}
                            title={item.is_active ? 'Deactivate' : 'Activate'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 12, color: item.is_active ? colors.success : colors.textMuted }}>
                            {item.is_active ? '● Active' : '○ Inactive'}
                          </button>
                          <button onClick={() => setEditing(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                            <Icon name="edit" size={14} color={colors.textSecondary} />
                          </button>
                          <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                            <Icon name="trash" size={14} color={colors.danger} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PriceBookModal
          item={editing}
          categories={categories}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </PageShell>
  );
}

function PriceBookModal({ item, categories, onSave, onClose }) {
  const isNew = !item.id;
  const [form, setForm] = useState({ ...EMPTY, ...item, default_price: item.default_price ?? '' });
  const [customCat, setCustomCat] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const catValue = form.category;
  const showCustom = catValue === '__new__';

  function handleCatChange(val) {
    if (val === '__new__') { set('category', '__new__'); }
    else { set('category', val); setCustomCat(''); }
  }

  function handleSave() {
    const finalForm = { ...form, category: showCustom ? customCat : form.category };
    onSave(finalForm);
  }

  return (
    <Modal title={isNew ? 'Add Price Book Item' : 'Edit Item'} onClose={onClose} width={520}>
      <Row>
        <Field label="Division">
          <Select value={form.division} onChange={e => set('division', e.target.value)}>
            <option value="carpentry">Carpentry</option>
            <option value="softwash">Soft Wash</option>
          </Select>
        </Field>
        <Field label="Category">
          <Select value={catValue} onChange={e => handleCatChange(e.target.value)}>
            <option value="">— Select —</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__new__">+ New category…</option>
          </Select>
        </Field>
      </Row>
      {showCustom && (
        <Field label="New Category Name">
          <Input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="e.g. Trim Work" autoFocus />
        </Field>
      )}
      <Field label="Item Name *">
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Fascia board replacement" />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional details…" rows={2} />
      </Field>
      <Row>
        <Field label="Unit">
          <Select value={form.unit} onChange={e => set('unit', e.target.value)}>
            {['each', 'sqft', 'lft', 'hour', 'day', 'load', 'gallon', 'flat'].map(u => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
        <Field label="Default Price ($)">
          <Input type="number" step="0.01" value={form.default_price} onChange={e => set('default_price', e.target.value)} placeholder="0.00" />
        </Field>
      </Row>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!form.name.trim()}>Save Item</Btn>
      </Row>
    </Modal>
  );
}
