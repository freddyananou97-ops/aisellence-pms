import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import Logo from '../components/Logo'
import { loginEmployee } from '../lib/supabase'
import { ROLES } from '../lib/roles'

function getLoginMode() {
  const h = new Date().getHours()
  if (h >= 3 && h < 18) return 'light'
  return 'dark'
}

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 3 && h < 12) return 'Guten Morgen'
  if (h >= 12 && h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

function ParticleWave({ exiting, light }) {
  const mountRef = useRef(null)
  const exitRef = useRef(false)

  useEffect(() => { exitRef.current = exiting }, [exiting])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const w = window.innerWidth, h = window.innerHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 1000)
    camera.position.set(0, 14, 30)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const cols = 100, rows = 100, spacing = 0.5, count = cols * rows
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const basePositions = new Float32Array(count * 3)

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const idx = (i * rows + j) * 3
        const x = (i - cols / 2) * spacing
        const z = (j - rows / 2) * spacing
        positions[idx] = x; positions[idx + 1] = 0; positions[idx + 2] = z
        basePositions[idx] = x; basePositions[idx + 1] = 0; basePositions[idx + 2] = z
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const particleColor = light ? 0x6b7280 : 0x10b981
    const baseOpacity = light ? 0.35 : 0.6
    const material = new THREE.PointsMaterial({ size: 0.06, color: particleColor, transparent: true, opacity: baseOpacity, sizeAttenuation: true })
    const points = new THREE.Points(geometry, material)
    scene.add(points)

    let mouse = { x: 0, y: 0 }
    const handleMouseMove = (e) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1 }
    window.addEventListener('mousemove', handleMouseMove)

    let animationId, exitStart = null
    const clock = new THREE.Clock()

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const pos = geometry.attributes.position.array

      if (exitRef.current && !exitStart) exitStart = t
      const exitProgress = exitStart ? Math.min((t - exitStart) / 1.2, 1) : 0
      const scatter = exitProgress * exitProgress

      for (let i = 0; i < count; i++) {
        const idx = i * 3
        const bx = basePositions[idx]
        const bz = basePositions[idx + 2]
        const dist = Math.sqrt(bx * bx + bz * bz)
        pos[idx + 1] = Math.sin(dist * 0.4 - t * 1.2) * 1.5 +
                        Math.sin(bx * 0.3 + t * 0.8) * 0.5 +
                        Math.cos(bz * 0.3 + t * 0.6) * 0.5 +
                        scatter * (3 + dist * 0.15)
        if (scatter > 0) {
          pos[idx] = bx + scatter * bx * 0.3
          pos[idx + 2] = bz + scatter * bz * 0.3
        }
      }
      geometry.attributes.position.needsUpdate = true
      material.opacity = baseOpacity * (1 - scatter)

      camera.position.x = mouse.x * 2
      camera.position.y = 14 + mouse.y * 1.5 + scatter * 4
      camera.lookAt(0, scatter * 2, 0)

      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight) }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      geometry.dispose(); material.dispose(); renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [light])

  return <div ref={mountRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 0 }} />
}

export default function Login({ onLogin, transitioning }) {
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

  const mode = getLoginMode()
  const isLight = mode === 'light'
  const greeting = getGreeting()

  // Theme-aware colors
  const c = isLight ? {
    bg: '#f0f0f2', text: '#1a1a1a', textSec: '#333', textMuted: '#666', textDim: '#999',
    panelBg: 'rgba(255,255,255,0.75)', panelBorder: 'rgba(0,0,0,0.06)',
    inputBg: '#fff', inputBorder: '#d1d1d6', inputText: '#1a1a1a',
    label: '#666', accent: '#10b981',
    tierBorder: '#d1d1d6', tierText: '#666', tierBg: 'transparent',
    toggleOff: '#d1d1d6', statusDot: '#10b981', statusText: '#666', dateText: '#999',
    logoColor: '#1a1a1a',
  } : {
    bg: '#050505', text: '#fff', textSec: '#ccc', textMuted: '#888', textDim: '#444',
    panelBg: 'rgba(8,8,8,0.85)', panelBorder: 'rgba(255,255,255,0.06)',
    inputBg: '#0a0a0a', inputBorder: '#1a1a1a', inputText: '#fff',
    label: '#444', accent: '#10b981',
    tierBorder: '#1a1a1a', tierText: '#666', tierBg: 'transparent',
    toggleOff: '#222', statusDot: '#10b981', statusText: '#444', dateText: '#333',
    logoColor: '#fff',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: c.bg, position: 'relative', transition: 'background 0.3s' }}>

      {/* Fullscreen 3D Particle Wave Background */}
      <ParticleWave exiting={transitioning} light={isLight} />

      {/* Left Panel — Branding */}
      <div className="login-brand" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px', position: 'relative', zIndex: 2 }}>

        <div style={{ transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s', opacity: transitioning ? 0 : 1, transform: transitioning ? 'translateY(-20px)' : 'translateY(0)' }}>
          <div style={{ marginBottom: 12, '--text': c.logoColor }}><Logo /></div>
          <p style={{ color: c.textDim, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', margin: 0 }}>Property Management System</p>
        </div>

        <div style={{ transition: 'opacity 0.5s ease', opacity: transitioning ? 0 : 1 }}>
          <h1 style={{ fontSize: 42, fontWeight: 200, color: c.text, margin: '0 0 12px', lineHeight: 1.2, letterSpacing: -1.5 }}>
            {greeting}
          </h1>
          <p style={{ fontSize: 14, color: c.textMuted, margin: 0, lineHeight: 1.6, maxWidth: 360 }}>
            Willkommen im Aisellence PMS.<br />
            Melden Sie sich an, um Ihren Arbeitsbereich zu öffnen.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center', transition: 'opacity 0.4s ease', opacity: transitioning ? 0 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.statusDot }} />
            <span style={{ fontSize: 11, color: c.statusText }}>System Online</span>
          </div>
          <span style={{ fontSize: 11, color: c.dateText }}>{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="login-form" style={{
        width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderLeft: `1px solid ${c.panelBorder}`, background: c.panelBg, backdropFilter: 'blur(24px)',
        position: 'relative', zIndex: 2,
        transition: 'opacity 0.4s ease, transform 0.4s ease',
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? 'scale(1.03) translateY(-10px)' : 'scale(1) translateY(0)',
      }}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 40px' }}>

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 500, color: c.text, margin: '0 0 6px' }}>Anmelden</h2>
            <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>Bitte wählen Sie Ihr Produkt und melden Sie sich an.</p>
          </div>

          {/* Product Tier */}
          <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: c.label, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Produkt</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={() => setTier('pms')} style={{
              flex: 1, padding: '14px 10px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: '0.15s',
              border: tier === 'pms' ? '1px solid #10b981' : `1px solid ${c.tierBorder}`,
              background: tier === 'pms' ? 'rgba(16,185,129,0.06)' : c.tierBg,
            }}>
              <div style={{ fontSize: 12, color: tier === 'pms' ? '#10b981' : c.tierText, fontWeight: 600 }}>PMS + Marco</div>
              <div style={{ fontSize: 10, color: c.textDim, marginTop: 3 }}>Alle Module</div>
            </button>
            <button onClick={() => setTier('concierge')} style={{
              flex: 1, padding: '14px 10px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: '0.15s',
              border: tier === 'concierge' ? '1px solid #8b5cf6' : `1px solid ${c.tierBorder}`,
              background: tier === 'concierge' ? 'rgba(139,92,246,0.06)' : c.tierBg,
            }}>
              <div style={{ fontSize: 12, color: tier === 'concierge' ? '#8b5cf6' : c.tierText, fontWeight: 600 }}>Marco Concierge</div>
              <div style={{ fontSize: 10, color: c.textDim, marginTop: 3 }}>Service Requests</div>
            </button>
          </div>

          <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: c.label, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Name</label>
          <input style={{ width: '100%', padding: '12px 16px', border: `1px solid ${c.inputBorder}`, borderRadius: 10, fontSize: 14, outline: 'none', background: c.inputBg, color: c.inputText, boxSizing: 'border-box', marginBottom: 16, fontFamily: 'inherit', transition: 'border 0.15s' }}
            placeholder="Dein Name" value={name} onChange={e => setName(e.target.value)} />

          <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: c.label, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Passwort</label>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input style={{ width: '100%', padding: '12px 16px', paddingRight: 44, border: `1px solid ${c.inputBorder}`, borderRadius: 10, fontSize: 14, outline: 'none', background: c.inputBg, color: c.inputText, boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border 0.15s' }}
              type={showPin ? 'text' : 'password'} placeholder="••••••" value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button onClick={() => setShowPin(!showPin)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={showPin ? '#10b981' : c.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {showPin ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>}
              </svg>
            </button>
          </div>

          {/* Demo mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setDemoMode(!demoMode)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', background: demoMode ? '#10b981' : c.toggleOff, transition: '0.2s' }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: '#fff', position: 'absolute', top: 3, left: demoMode ? 19 : 3, transition: '0.2s' }} />
            </button>
            <span style={{ fontSize: 11, color: c.textMuted }}>Demo-Modus</span>
          </div>

          {demoMode && (
            <>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: c.label, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Rolle (Demo)</label>
              <select style={{ width: '100%', padding: '12px 16px', border: `1px solid ${c.inputBorder}`, borderRadius: 10, fontSize: 14, outline: 'none', background: c.inputBg, color: c.inputText, boxSizing: 'border-box', marginBottom: 16, fontFamily: 'inherit' }}
                value={demoRole} onChange={e => setDemoRole(e.target.value)}>
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

          <p style={{ fontSize: 10, color: c.textDim, textAlign: 'center', marginTop: 20 }}>
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
