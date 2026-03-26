/**
 * Modal Pattern — Standard modal structure used across all PMS modules.
 *
 * Features:
 * - Fixed overlay with backdrop blur
 * - Click outside to close
 * - ESC key to close (via useModalClose hook)
 * - Close button top-right
 * - Responsive (max-width + maxHeight with scroll)
 * - Uses CSS variables for theme compatibility
 */
import { useState } from 'react'
import useModalClose from '../../src/hooks/useModalClose'

export default function ModalExample() {
  const [isOpen, setIsOpen] = useState(false)
  useModalClose(isOpen, () => setIsOpen(false))

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlayBg, rgba(0,0,0,0.7))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: 'var(--modalBg, #111)',
              border: '1px solid var(--modalBorder, #222)',
              borderRadius: 16,
              padding: '24px 28px',
              width: '100%',
              maxWidth: 440,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Modal Title</h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'var(--bgCard)',
                  border: 'none',
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  fontSize: 16,
                  cursor: 'pointer',
                  color: 'var(--textMuted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <p style={{ fontSize: 13, color: 'var(--textMuted)', lineHeight: 1.5 }}>
              Modal content goes here.
            </p>

            {/* Footer */}
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Abbrechen
              </button>
              <button
                style={{ flex: 1, padding: 12, background: 'var(--text)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
