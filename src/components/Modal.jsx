import { colors, shadow, radius } from '../styles.js';
import Icon from './Icon.jsx';

export default function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: colors.card, borderRadius: radius.lg, boxShadow: shadow.lg,
        width: '100%', maxWidth: width, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${colors.border}`,
        }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: colors.textSecondary, borderRadius: 4, display: 'flex',
          }}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: 20, flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
