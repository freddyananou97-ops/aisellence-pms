import { useState } from 'react'
import { ROLES } from '../lib/roles'
import { useTheme } from '../lib/theme'
import { useTier } from '../lib/tier'
import Logo from './Logo'

const ALL_MODULES = [
  { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { path: '/buchungen', label: 'Buchungen', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { path: '/gaeste', label: 'Gäste', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { path: '/rechnungen', label: 'Rechnungen', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  { path: '/analytics', label: 'Analytics', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { path: '/schichtbuch', label: 'Schichtbuch', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { path: '/zimmer', label: 'Zimmer', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { path: '/housekeeping', label: 'Housekeeping', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { path: '/kitchen', label: 'Küche', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1' },
  { path: '/restaurant', label: 'Restaurant', icon: 'M3 3h18v18H3V3zm4 4v4m0 4h.01M10 7v10m4-10v4m0 4h.01M17 7v10' },
  { path: '/fruehstueck', label: 'Frühstück', icon: 'M17 8h1a4 4 0 110 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zm0 0V6a2 2 0 012-2h2.5M6 2l1 4' },
  { path: '/spa', label: 'Spa', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { path: '/wartung', label: 'Wartung', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { path: '/meldeschein', label: 'Meldeschein', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { path: '/feedback', label: 'Feedback', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
  { path: '/preise', label: 'Preise', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 8v2M5 12h14' },
  { path: '/protokoll', label: 'Protokoll', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { path: '/settings', label: 'Einstellungen', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
]

// Bottom nav shows these 5 on mobile
const MOBILE_NAV = ['/', '/buchungen', '/housekeeping', '/zimmer', '/settings']

function Icon({ d, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function Sidebar({ page, setPage, user, onLogout, allowed }) {
  const { theme, themeMode, setThemeMode } = useTheme()
  const { tier, setTier } = useTier()
  const roleLabel = ROLES[user.role]?.label || 'Admin'
  const modules = ALL_MODULES.filter(m => allowed.includes(m.path))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigate = (path) => { setPage(path); setMobileMenuOpen(false) }

  return (
    <>
      {/* ====== DESKTOP SIDEBAR ====== */}
      <aside className="desktop-sidebar" style={{ width: 210, background: theme.bgSec, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0, overflowY: 'auto', transition: 'background 0.3s' }}>
        <div style={{ padding: '20px 14px 16px' }}>
          <Logo size="small" />
          <div style={{ marginTop: 8, fontSize: 9, color: tier === 'pms' ? '#10b981' : '#8b5cf6', background: tier === 'pms' ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.08)', padding: '3px 8px', borderRadius: 4, display: 'inline-block', fontWeight: 500 }}>
            {tier === 'pms' ? 'PMS + Marco' : 'Marco Concierge'}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 8px' }}>
          {modules.map(m => (
            <button key={m.path} onClick={() => setPage(m.path)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', width: '100%', fontSize: 13, textAlign: 'left', marginBottom: 1, fontFamily: 'inherit',
              background: page === m.path ? theme.active : 'transparent',
              color: page === m.path ? theme.text : theme.textMuted,
              cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
            }}>
              <Icon d={m.icon} /><span>{m.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ padding: 16, borderTop: `1px solid ${theme.border}`, marginTop: 'auto' }}>
          <div style={{ color: theme.textMuted, fontSize: 11 }}>{user.hotel}</div>
          <div style={{ color: theme.textDim, fontSize: 10, marginTop: 3 }}>{user.name}</div>
          <div style={{ fontSize: 9, color: roleLabel === 'Administrator' || roleLabel === 'Rezeption' ? '#10b981' : '#3b82f6', marginTop: 2 }}>{roleLabel}</div>

          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            <button onClick={() => { setTier('pms'); }} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: tier === 'pms' ? '1px solid #10b981' : `1px solid ${theme.border}`, background: tier === 'pms' ? 'rgba(16,185,129,0.08)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 9, color: tier === 'pms' ? '#10b981' : theme.textDim, fontWeight: tier === 'pms' ? 600 : 400, textAlign: 'center' }}>PMS</button>
            <button onClick={() => { setTier('concierge'); setPage('/'); }} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: tier === 'concierge' ? '1px solid #8b5cf6' : `1px solid ${theme.border}`, background: tier === 'concierge' ? 'rgba(139,92,246,0.08)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 9, color: tier === 'concierge' ? '#8b5cf6' : theme.textDim, fontWeight: tier === 'concierge' ? 600 : 400, textAlign: 'center' }}>Concierge</button>
          </div>

          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {[['dark', 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z'], ['light', 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42 M17 12a5 5 0 11-10 0 5 5 0 0110 0z'], ['auto', 'M12 2a10 10 0 100 20 10 10 0 000-20z M12 2a10 10 0 010 20z']].map(([m, d]) => (
              <button key={m} onClick={() => setThemeMode(m)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: themeMode === m ? `1px solid ${theme.textMuted}` : `1px solid ${theme.border}`, background: themeMode === m ? theme.active : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={themeMode === m ? theme.text : theme.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
              </button>
            ))}
          </div>

          <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: theme.textDim, fontSize: 11, cursor: 'pointer', padding: '10px 0 0', fontFamily: 'inherit' }}>
            <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" size={13} /> Abmelden
          </button>
        </div>
      </aside>

      {/* ====== MOBILE BOTTOM NAV ====== */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
        background: theme.bgSec, borderTop: `1px solid ${theme.border}`,
        display: 'none', justifyContent: 'space-around', alignItems: 'center',
        padding: '6px 0 env(safe-area-inset-bottom, 6px)',
        backdropFilter: 'blur(12px)',
      }}>
        {MOBILE_NAV.map(path => {
          const m = ALL_MODULES.find(mod => mod.path === path)
          if (!m || !allowed.includes(path)) return null
          return (
            <button key={path} onClick={() => navigate(path)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px',
              color: page === path ? '#10b981' : theme.textDim, fontFamily: 'inherit',
            }}>
              <Icon d={m.icon} size={20} />
              <span style={{ fontSize: 9 }}>{m.label}</span>
            </button>
          )
        })}
        {/* Hamburger for full menu */}
        <button onClick={() => setMobileMenuOpen(true)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px',
          color: mobileMenuOpen ? '#10b981' : theme.textDim, fontFamily: 'inherit',
        }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span style={{ fontSize: 9 }}>Mehr</span>
        </button>
      </nav>

      {/* ====== MOBILE FULL MENU OVERLAY ====== */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.5)',
        }} onClick={() => setMobileMenuOpen(false)}>
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '75%', maxWidth: 300,
            background: theme.bgSec, borderLeft: `1px solid ${theme.border}`,
            overflow: 'auto', padding: '20px 0',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${theme.border}`, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Logo size="small" />
                <button onClick={() => setMobileMenuOpen(false)} style={{ background: theme.bgCard, border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: 'pointer', color: theme.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>{user.name}</div>
              <div style={{ fontSize: 10, color: theme.textDim }}>{user.hotel} · {roleLabel}</div>
            </div>

            {/* All modules */}
            <div style={{ padding: '0 8px' }}>
              {modules.map(m => (
                <button key={m.path} onClick={() => navigate(m.path)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: 'none', width: '100%', fontSize: 14, textAlign: 'left', marginBottom: 2, fontFamily: 'inherit',
                  background: page === m.path ? theme.active : 'transparent',
                  color: page === m.path ? theme.text : theme.textMuted,
                  cursor: 'pointer',
                }}>
                  <Icon d={m.icon} size={18} /><span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Bottom actions */}
            <div style={{ padding: '16px', borderTop: `1px solid ${theme.border}`, marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button onClick={() => { setTier('pms'); setMobileMenuOpen(false) }} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: tier === 'pms' ? '1px solid #10b981' : `1px solid ${theme.border}`, background: tier === 'pms' ? 'rgba(16,185,129,0.08)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: tier === 'pms' ? '#10b981' : theme.textDim, fontWeight: 500, textAlign: 'center' }}>PMS</button>
                <button onClick={() => { setTier('concierge'); navigate('/') }} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: tier === 'concierge' ? '1px solid #8b5cf6' : `1px solid ${theme.border}`, background: tier === 'concierge' ? 'rgba(139,92,246,0.08)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: tier === 'concierge' ? '#8b5cf6' : theme.textDim, fontWeight: 500, textAlign: 'center' }}>Concierge</button>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[['dark', 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z'], ['light', 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42 M17 12a5 5 0 11-10 0 5 5 0 0110 0z'], ['auto', 'M12 2a10 10 0 100 20 10 10 0 000-20z M12 2a10 10 0 010 20z']].map(([m, d]) => (
                  <button key={m} onClick={() => setThemeMode(m)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: themeMode === m ? `1px solid ${theme.textMuted}` : `1px solid ${theme.border}`, background: themeMode === m ? theme.active : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={themeMode === m ? theme.text : theme.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
                  </button>
                ))}
              </div>

              <button onClick={() => { onLogout(); setMobileMenuOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', padding: '8px 0', fontFamily: 'inherit', width: '100%' }}>
                <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" size={16} /> Abmelden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== RESPONSIVE CSS ====== */}
      <style>{`
        .mobile-bottom-nav { display: none !important; }
        .desktop-sidebar { display: flex !important; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-bottom-nav { display: flex !important; }
        }
      `}</style>
    </>
  )
}
