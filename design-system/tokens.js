/**
 * AISELLENCE PMS — Design Tokens (JavaScript)
 * Same values as tokens.css for use in React inline styles.
 */

export const colors = {
  dark: {
    bg: '#080808', bgSec: '#0b0b0b', bgCard: '#0e0e0e', inputBg: '#080808', active: 'rgba(255,255,255,0.06)',
    border: '#151515', borderLight: '#1a1a1a',
    text: '#fff', textSec: '#ccc', textMuted: '#888', textDim: '#444',
    overlayBg: 'rgba(0,0,0,0.7)', modalBg: '#111', modalBorder: '#222',
  },
  light: {
    bg: '#f5f5f7', bgSec: '#fff', bgCard: '#fff', inputBg: '#f5f5f7', active: 'rgba(0,0,0,0.05)',
    border: '#e5e5e7', borderLight: '#d1d1d6',
    text: '#1a1a1a', textSec: '#333', textMuted: '#666', textDim: '#bbb',
    overlayBg: 'rgba(0,0,0,0.35)', modalBg: '#fff', modalBorder: '#d1d1d6',
  },
}

export const accent = {
  green: '#10b981', blue: '#3b82f6', purple: '#8b5cf6', amber: '#f59e0b',
  red: '#ef4444', teal: '#14b8a6', yellow: '#eab308', darkRed: '#991b1b', stripe: '#635bff',
}

export const status = {
  success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6', blocked: '#6b7280',
}

export const categoryColors = {
  room_service: '#f59e0b', housekeeping: '#3b82f6', maintenance: '#ef4444',
  taxi: '#eab308', complaint: '#991b1b', late_checkout: '#8b5cf6', luggage: '#14b8a6', wake_up: '#6b7280',
}

export const typography = {
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontMono: "'SF Mono', 'Fira Code', monospace",
  sizes: { xs: 9, sm: 11, base: 13, md: 14, lg: 16, xl: 18, '2xl': 22, '3xl': 32, '4xl': 42 },
  weights: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 },
}

export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 }

export const radius = { sm: 4, md: 8, lg: 10, xl: 12, '2xl': 16, full: 9999 }

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.05)', md: '0 4px 12px rgba(0,0,0,0.1)',
  lg: '0 8px 30px rgba(0,0,0,0.12)', xl: '0 12px 40px rgba(0,0,0,0.5)',
}

export const zIndex = {
  sidebar: 40, dropdown: 50, sticky: 60, mobileNav: 80, mobileMenu: 85, modal: 100, toast: 110, loginTransition: 9999,
}

export const transitions = { fast: '0.15s ease', base: '0.3s ease', slow: '0.5s ease' }

/**
 * Common inline style patterns used across the PMS.
 */
export const patterns = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg)', border: '1px solid var(--modalBorder)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440 },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '10px 14px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  navBtn: { padding: '6px 10px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textMuted)' },
}
