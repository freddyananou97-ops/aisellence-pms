import { createContext, useContext, useState, useEffect } from 'react'

const THEMES = {
  dark: {
    bg: '#080808', bgSec: '#0b0b0b', bgCard: '#0e0e0e', border: '#151515', borderLight: '#1a1a1a',
    text: '#fff', textSec: '#ccc', textMuted: '#888', textDim: '#444',
    active: 'rgba(255,255,255,0.06)', inputBg: '#080808',
    overlayBg: 'rgba(0,0,0,0.7)', modalBg: '#111', modalBorder: '#222',
  },
  light: {
    bg: '#f5f5f7', bgSec: '#fff', bgCard: '#fff', border: '#e5e5e7', borderLight: '#d1d1d6',
    text: '#1a1a1a', textSec: '#333', textMuted: '#666', textDim: '#bbb',
    active: 'rgba(0,0,0,0.05)', inputBg: '#f5f5f7',
    overlayBg: 'rgba(0,0,0,0.35)', modalBg: '#fff', modalBorder: '#d1d1d6',
  },
}

function getAutoTheme() {
  const h = new Date().getHours()
  return (h >= 7 && h < 20) ? 'light' : 'dark'
}

const ThemeContext = createContext({ theme: THEMES.dark, themeMode: 'dark', resolvedTheme: 'dark', setThemeMode: () => {} })

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('aisellence-theme') || 'dark')
  const [resolvedTheme, setResolvedTheme] = useState('dark')

  useEffect(() => {
    const update = () => setResolvedTheme(themeMode === 'auto' ? getAutoTheme() : themeMode)
    update()
    localStorage.setItem('aisellence-theme', themeMode)
    if (themeMode === 'auto') {
      const iv = setInterval(update, 60000)
      return () => clearInterval(iv)
    }
  }, [themeMode])

  const theme = THEMES[resolvedTheme]

  return (
    <ThemeContext.Provider value={{ theme, themeMode, resolvedTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export { THEMES }
