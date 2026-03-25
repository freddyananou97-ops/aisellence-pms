import { useState } from 'react'
import { ThemeProvider, useTheme } from './lib/theme'
import { TierProvider, useTier } from './lib/tier'
import { getAllowedModules, getDefaultRoute } from './lib/roles'

import Sidebar from './components/Sidebar'
import Login from './pages/Login'
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

function AppContent() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('/')
  const { theme, resolvedTheme } = useTheme()
  const { tier, setTier } = useTier()

  const handleLogin = (u) => {
    setUser(u)
    setTier(u.tier || 'pms')
    setPage(getDefaultRoute(u.role))
  }

  // Guest Display: no auth, no sidebar, standalone route
  // Supports /guest-display, /#/guest-display, and ?page=guest-display
  const isGuestDisplay = window.location.pathname === '/guest-display'
    || window.location.hash === '#/guest-display'
    || new URLSearchParams(window.location.search).get('page') === 'guest-display'
  if (isGuestDisplay) return <GuestDisplay />

  if (!user) return <Login onLogin={handleLogin} />

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
      <div data-theme={resolvedTheme} style={{
        display: 'flex', minHeight: '100vh', background: theme.bg, fontFamily: 'system-ui,-apple-system,sans-serif', color: theme.text, transition: 'background 0.3s, color 0.3s',
        '--bg': theme.bg, '--bgSec': theme.bgSec, '--bgCard': theme.bgCard, '--border': theme.border, '--borderLight': theme.borderLight,
        '--text': theme.text, '--textSec': theme.textSec, '--textMuted': theme.textMuted, '--textDim': theme.textDim,
        '--active': theme.active, '--inputBg': theme.inputBg, '--overlayBg': theme.overlayBg, '--modalBg': theme.modalBg, '--modalBorder': theme.modalBorder,
        // Legacy aliases for existing pages
        '--bg-primary': theme.bg, '--bg-secondary': theme.bgSec, '--bg-card': theme.bgCard, '--bg-active': theme.active,
        '--border-light': theme.borderLight, '--text-primary': theme.text, '--text-secondary': theme.textMuted, '--text-muted': theme.textDim, '--text-dim': theme.textDim,
      }}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={() => setUser(null)} allowed={allowed} />
        <main className="main-content" style={{ flex: 1, overflow: 'auto' }}>{renderPage()}</main>
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
