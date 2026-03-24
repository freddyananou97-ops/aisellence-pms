import { useState } from 'react'
import Logo from '../components/Logo'
import { loginEmployee } from '../lib/supabase'
import { ROLES } from '../lib/roles'

export default function Login({ onLogin }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [tier, setTier] = useState('pms')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [demoRole, setDemoRole] = useState('admin')
  const [showPin, setShowPin] = useState(false)

  const handleLogin = async () => {
    if (demoMode) {
      onLogin({ name: name || 'Demo User', role: demoRole, hotel: 'Maritim Hotel Ingolstadt', tier })
      return
    }
    if (!name || !pin) { setError('Name und PIN eingeben'); return }
    setLoading(true); setError('')
    const employee = await loginEmployee(name, pin)
    if (employee) {
      onLogin({ ...employee, hotel: 'Maritim Hotel Ingolstadt', tier })
    } else {
      setError('Name oder PIN falsch')
    }
    setLoading(false)
  }

  const hour = new Date().getHours()
  const greeting = hour >= 5 && hour < 12 ? 'Guten Morgen' : hour >= 12 && hour < 18 ? 'Guten Tag' : 'Guten Abend'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#050505' }}>

      {/* Left Panel — Branding */}
      <div className="login-brand" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px', position: 'relative', overflow: 'hidden' }}>
        {/* Subtle grid pattern */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        {/* Accent line */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: 'linear-gradient(to bottom, transparent, #10b981, transparent)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 12 }}><Logo /></div>
          <p style={{ color: '#333', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', margin: 0 }}>Property Management System</p>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 36, fontWeight: 300, color: '#fff', margin: '0 0 12px', lineHeight: 1.2, letterSpacing: -1 }}>
            {greeting}
          </h1>
          <p style={{ fontSize: 14, color: '#555', margin: 0, lineHeight: 1.6, maxWidth: 360 }}>
            Willkommen im Aisellence PMS.<br />
            Melden Sie sich an, um Ihren Arbeitsbereich zu öffnen.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 11, color: '#444' }}>System Online</span>
          </div>
          <span style={{ fontSize: 11, color: '#333' }}>{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="login-form" style={{ width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #111', background: '#080808' }}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 40px' }}>

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 500, color: '#fff', margin: '0 0 6px' }}>Anmelden</h2>
            <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Bitte wählen Sie Ihr Produkt und melden Sie sich an.</p>
          </div>

          {/* Product Tier */}
          <label style={s.label}>Produkt</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={() => setTier('pms')} style={{
              ...s.tierBtn,
              border: tier === 'pms' ? '1px solid #10b981' : '1px solid #1a1a1a',
              background: tier === 'pms' ? 'rgba(16,185,129,0.04)' : 'transparent',
            }}>
              <div style={{ fontSize: 12, color: tier === 'pms' ? '#10b981' : '#666', fontWeight: 600 }}>PMS + Marco</div>
              <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>Alle Module</div>
            </button>
            <button onClick={() => setTier('concierge')} style={{
              ...s.tierBtn,
              border: tier === 'concierge' ? '1px solid #8b5cf6' : '1px solid #1a1a1a',
              background: tier === 'concierge' ? 'rgba(139,92,246,0.04)' : 'transparent',
            }}>
              <div style={{ fontSize: 12, color: tier === 'concierge' ? '#8b5cf6' : '#666', fontWeight: 600 }}>Marco Concierge</div>
              <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>Service Requests</div>
            </button>
          </div>

          <label style={s.label}>Name</label>
          <input style={s.input} placeholder="Dein Name" value={name} onChange={e => setName(e.target.value)} />

          <label style={s.label}>Passwort</label>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input style={{ ...s.input, marginBottom: 0, paddingRight: 44 }} type={showPin ? 'text' : 'password'} placeholder="••••••" value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button onClick={() => setShowPin(!showPin)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={showPin ? '#10b981' : '#444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {showPin ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>}
              </svg>
            </button>
          </div>

          {/* Demo mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setDemoMode(!demoMode)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', background: demoMode ? '#10b981' : '#222', transition: '0.2s' }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: '#fff', position: 'absolute', top: 3, left: demoMode ? 19 : 3, transition: '0.2s' }} />
            </button>
            <span style={{ fontSize: 11, color: '#555' }}>Demo-Modus</span>
          </div>

          {demoMode && (
            <>
              <label style={s.label}>Rolle (Demo)</label>
              <select style={s.input} value={demoRole} onChange={e => setDemoRole(e.target.value)}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </>
          )}

          {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

          <button style={{
            width: '100%', padding: 14, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', opacity: loading ? 0.6 : 1, transition: '0.15s',
            background: tier === 'pms' ? '#10b981' : '#8b5cf6', color: '#fff',
          }} onClick={handleLogin} disabled={loading}>
            {loading ? 'Einloggen...' : 'Einloggen'}
          </button>

          <p style={{ fontSize: 10, color: '#333', textAlign: 'center', marginTop: 20 }}>
            Powered by Aisellence · v1.0
          </p>
        </div>
      </div>

      {/* Responsive: On small screens, hide left panel */}
      <style>{`
        @media (max-width: 768px) {
          .login-brand { display: none !important; }
          .login-form { width: 100% !important; border: none !important; }
        }
      `}</style>
    </div>
  )
}

const s = {
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: '#444', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  input: { width: '100%', padding: '12px 16px', border: '1px solid #1a1a1a', borderRadius: 10, fontSize: 14, outline: 'none', background: '#0a0a0a', color: '#fff', boxSizing: 'border-box', marginBottom: 16, fontFamily: 'inherit', transition: 'border 0.15s' },
  tierBtn: { flex: 1, padding: '14px 10px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: '0.15s' },
}
