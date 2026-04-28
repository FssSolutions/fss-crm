import { useEffect } from 'react';
import { colors, radius, shadow } from '../styles.js';

export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, []);

  const bg = type === 'error' ? colors.danger : type === 'warning' ? colors.warning : colors.success;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      background: bg, color: '#fff', padding: '12px 20px',
      borderRadius: radius.md, boxShadow: shadow.lg,
      fontSize: 14, fontWeight: 500, maxWidth: 360,
    }}>
      {message}
    </div>
  );
}
