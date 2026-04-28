import { colors, radius } from '../styles.js';

// Reusable form field wrapper
export function Field({ label, children, required, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}{required && <span style={{ color: colors.danger }}> *</span>}
        </label>
      )}
      {children}
    </div>
  );
}

const inputBase = {
  width: '100%', boxSizing: 'border-box',
  border: `1px solid ${colors.border}`, borderRadius: radius.md,
  padding: '8px 12px', fontSize: 14, fontFamily: 'inherit',
  background: '#fff', color: colors.text, outline: 'none',
  transition: 'border-color 0.15s',
};

export function Input({ style, ...props }) {
  return <input style={{ ...inputBase, ...style }} {...props} />;
}

export function Select({ children, style, ...props }) {
  return (
    <select style={{ ...inputBase, ...style }} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ style, rows = 3, ...props }) {
  return <textarea rows={rows} style={{ ...inputBase, resize: 'vertical', ...style }} {...props} />;
}

export function Row({ children, gap = 12 }) {
  return <div style={{ display: 'flex', gap, marginBottom: 14 }}>{children}</div>;
}

export function Btn({ children, variant = 'primary', size = 'md', onClick, type = 'button', disabled, style }) {
  const base = {
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600,
    borderRadius: radius.md, display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: 'inherit', transition: 'background 0.15s, opacity 0.15s',
    opacity: disabled ? 0.6 : 1,
    padding: size === 'sm' ? '6px 12px' : size === 'lg' ? '12px 24px' : '9px 16px',
    fontSize: size === 'sm' ? 13 : 14,
  };
  const variants = {
    primary: { background: colors.primary, color: '#fff' },
    secondary: { background: colors.border, color: colors.text },
    danger: { background: colors.danger, color: '#fff' },
    ghost: { background: 'transparent', color: colors.textSecondary, border: `1px solid ${colors.border}` },
    success: { background: colors.success, color: '#fff' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}
