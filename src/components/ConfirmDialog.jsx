import { useEffect } from 'react'

export default function ConfirmDialog({ title, message, warning, confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen', confirmColor = '#fff', onConfirm, onCancel }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.modal} onClick={e => e.stopPropagation()} className="fade-in">
        {/* Icon */}
        <div style={s.iconWrap}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1.98 1.98 0 003.4 21h17.2a1.98 1.98 0 001.71-2.98L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        {/* Text */}
        <h3 style={s.title}>{title}</h3>
        <p style={s.message}>{message}</p>
        {warning && <p style={s.warning}>{warning}</p>}

        {/* Buttons */}
        <div style={s.buttons}>
          <button style={s.cancelBtn} onClick={onCancel}>{cancelLabel}</button>
          <button style={{ ...s.confirmBtn, background: confirmColor }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 20,
  },
  modal: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 16,
    padding: '28px 32px',
    width: '100%',
    maxWidth: 420,
    textAlign: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'rgba(245,158,11,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  title: {
    fontSize: 16,
    fontWeight: 500,
    color: '#fff',
    margin: '0 0 8px',
  },
  message: {
    fontSize: 13,
    color: '#999',
    lineHeight: 1.5,
    margin: '0 0 6px',
  },
  warning: {
    fontSize: 11,
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.08)',
    padding: '8px 12px',
    borderRadius: 8,
    margin: '10px 0 0',
    lineHeight: 1.4,
  },
  buttons: {
    display: 'flex',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    padding: '11px 16px',
    background: '#1a1a1a',
    border: '1px solid #222',
    borderRadius: 10,
    fontSize: 13,
    color: '#888',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmBtn: {
    flex: 1,
    padding: '11px 16px',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    color: '#080808',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
