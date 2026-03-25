import { useState, useEffect, lazy, Suspense } from 'react'
import { ThemeProvider, useTheme } from './lib/theme'
import { TierProvider, useTier } from './lib/tier'
import { getAllowedModules, getDefaultRoute } from './lib/roles'

import ErrorBoundary from './components/ErrorBoundary'
import Sidebar from './components/Sidebar'
const Login = lazy(() => import('./pages/Login'))
import GuestDisplay from './pages/GuestDisplay'
import Dashboard from './pages/Dashboard'
import Buchungen from './pages/Buchungen'
import Kalender from './pages/Kalender'
import Gaeste from './pages/Gaeste'
import Rechnungen from './pages/Rechnungen'
import Analytics from './pages/Analytics'
import Schichtbuch from './pages/Schichtbuch'
import Zimmer from './pages/Zimmer'
import Housekeeping from './pages/Housekeeping'
import Kitchen from './pages/Kitchen'
import Restaurant from './pages/Restaurant'
import Spa from './pages/Spa'
import Wartung from './pages/Wartung'
import Feedback from './pages/Feedback'
import Fruehstueck from './pages/Fruehstueck'
import Settings from './pages/Settings'
import Meldeschein from './pages/Meldeschein'

const SESSION_KEY = 'aisellence-session'
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000 // 12 hours

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, _ts: Date.now() }))
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (Date.now() - session._ts > SESSION_MAX_AGE) { localStorage.removeItem(SESSION_KEY); return null }
    return session
  } catch { return null }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

function AppContent() {
  const [user, setUser] = useState(() => loadSession())
  const [page, setPage] = useState('/')
  const [transitioning, setTransitioning] = useState(false)
  const [showLogin, setShowLogin] = useState(true)
  const [dashboardReady, setDashboardReady] = useState(!loadSession()) // skip transition if restoring session
  const { theme, resolvedTheme } = useTheme()
  const { tier, setTier } = useTier()

  // Restore tier from session
  useEffect(() => {
    if (user?.tier) setTier(user.tier)
    if (user) { setShowLogin(false); setDashboardReady(true) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = (u) => {
    saveSession(u)
    setTransitioning(true)
    setUser(u)
    setTier(u.tier || 'pms')
    setPage(getDefaultRoute(u.role))
    setTimeout(() => setDashboardReady(true), 200)
    setTimeout(() => { setShowLogin(false); setTransitioning(false) }, 1600)
  }

  const handleLogout = () => {
    clearSession()
    setUser(null)
    setShowLogin(true)
    setDashboardReady(false)
    setPage('/')
  }

  // Guest Display: no auth, no sidebar, standalone route
  const isGuestDisplay = window.location.pathname === '/guest-display'
    || window.location.hash === '#/guest-display'
    || new URLSearchParams(window.location.search).get('page') === 'guest-display'
  if (isGuestDisplay) return <GuestDisplay />

  if (!user) return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050505' }} />}><Login onLogin={handleLogin} transitioning={false} /></Suspense>

  const allowed = getAllowedModules(user.role, tier)

  const renderPage = () => {
    if (!allowed.includes(page)) return <Dashboard user={user} />
    switch (page) {
      case '/': return <Dashboard user={user} />
      case '/buchungen': return <Buchungen />
      case '/kalender': return <Kalender />
      case '/gaeste': return <Gaeste />
      case '/rechnungen': return <Rechnungen />
      case '/analytics': return <Analytics />
      case '/schichtbuch': return <Schichtbuch />
      case '/zimmer': return <Zimmer />
      case '/housekeeping': return <Housekeeping />
      case '/kitchen': return <Kitchen />
      case '/restaurant': return <Restaurant />
      case '/spa': return <Spa />
      case '/wartung': return <Wartung />
      case '/feedback': return <Feedback />
      case '/fruehstueck': return <Fruehstueck />
      case '/settings': return <Settings />
      case '/meldeschein': return <Meldeschein />
      default: return <Dashboard user={user} />
    }
  }

  return (
    <>
      {resolvedTheme === 'light' && (
        <style>{`
          [data-theme="light"] input, [data-theme="light"] select { background: #f5f5f7 !important; border-color: #d1d1d6 !important; color: #1a1a1a !important; }
          [data-theme="light"] input::placeholder { color: #999 !important; }
        `}</style>
      )}

      {/* Login overlay during transition */}
      {showLogin && transitioning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
          <Suspense fallback={null}><Login onLogin={() => {}} transitioning={true} /></Suspense>
        </div>
      )}

      <div data-theme={resolvedTheme} style={{
        display: 'flex', minHeight: '100vh', background: theme.bg, fontFamily: 'system-ui,-apple-system,sans-serif', color: theme.text, transition: 'background 0.3s, color 0.3s',
        opacity: dashboardReady ? 1 : (transitioning ? 0 : 1),
        transform: dashboardReady ? 'translateY(0)' : (transitioning ? 'translateY(20px)' : 'translateY(0)'),
        transition: 'opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s, background 0.3s, color 0.3s',
        '--bg': theme.bg, '--bgSec': theme.bgSec, '--bgCard': theme.bgCard, '--border': theme.border, '--borderLight': theme.borderLight,
        '--text': theme.text, '--textSec': theme.textSec, '--textMuted': theme.textMuted, '--textDim': theme.textDim,
        '--active': theme.active, '--inputBg': theme.inputBg, '--overlayBg': theme.overlayBg, '--modalBg': theme.modalBg, '--modalBorder': theme.modalBorder,
        '--bg-primary': theme.bg, '--bg-secondary': theme.bgSec, '--bg-card': theme.bgCard, '--bg-active': theme.active,
        '--border-light': theme.borderLight, '--text-primary': theme.text, '--text-secondary': theme.textMuted, '--text-muted': theme.textDim, '--text-dim': theme.textDim,
      }}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={handleLogout} allowed={allowed} />
        <main className="main-content" style={{ flex: 1, overflow: 'auto' }}>
          <ErrorBoundary>{renderPage()}</ErrorBoundary>
        </main>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .main-content { padding-bottom: 70px !important; }
          .main-content > div { padding: 16px !important; }
          .main-content h1 { font-size: 18px !important; }
        }
      `}</style>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <TierProvider>
        <AppContent />
      </TierProvider>
    </ThemeProvider>
  )
}
