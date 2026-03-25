import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 32 }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text, #fff)', margin: '0 0 8px' }}>Etwas ist schiefgelaufen</h2>
            <p style={{ fontSize: 13, color: 'var(--textMuted, #888)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Ein unerwarteter Fehler ist aufgetreten. Bitte laden Sie die Seite neu.
            </p>
            <button onClick={() => this.setState({ hasError: false, error: null })} style={{
              padding: '10px 24px', background: 'var(--text, #fff)', color: 'var(--bg, #080808)',
              border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>Seite neu laden</button>
            {this.state.error && (
              <p style={{ fontSize: 10, color: 'var(--textDim, #444)', marginTop: 16, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {this.state.error.message}
              </p>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
