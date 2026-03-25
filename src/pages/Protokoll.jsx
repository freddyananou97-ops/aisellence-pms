import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'
import { exportCSV, todayStr as csvDate } from '../lib/export'

const ACTION_LABELS = {
  booking_created: 'Buchung erstellt', booking_updated: 'Buchung geändert', booking_cancelled: 'Buchung storniert',
  checkin: 'Check-in', checkout: 'Check-out', room_blocked: 'Zimmer gesperrt', room_unblocked: 'Zimmer entsperrt',
  meldeschein_received: 'Meldeschein erhalten', payment_received: 'Zahlung erhalten', payment_cash: 'Barzahlung',
  guest_created: 'Gast angelegt', guest_updated: 'Gast bearbeitet',
  spa_booking_created: 'Spa-Buchung', spa_cancelled: 'Spa storniert', spa_charged: 'Spa auf Zimmer',
  restaurant_checkout: 'Restaurant-Abrechnung', employee_created: 'Mitarbeiter angelegt', employee_updated: 'Mitarbeiter geändert',
  login: 'Login',
}
const ACTION_COLORS = {
  booking_created: '#3b82f6', booking_cancelled: '#ef4444', checkin: '#10b981', checkout: '#f59e0b',
  room_blocked: '#ef4444', room_unblocked: '#10b981', meldeschein_received: '#8b5cf6',
  payment_received: '#10b981', payment_cash: '#10b981', guest_created: '#3b82f6',
  spa_booking_created: '#8b5cf6', restaurant_checkout: '#f59e0b', login: '#6b7280',
}

export default function Protokoll() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('alle')
  const [visibleCount, setVisibleCount] = useState(100)

  const load = useCallback(async () => {
    const { data } = await supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(500)
    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load(); const u = subscribeToTable('audit_log', () => load()); return u }, [load])

  const filtered = logs.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.user_name?.toLowerCase().includes(q) || l.entity_id?.toLowerCase().includes(q) || l.action?.includes(q) || (ACTION_LABELS[l.action] || '').toLowerCase().includes(q)
    const matchAction = actionFilter === 'alle' || l.action === actionFilter
    return matchSearch && matchAction
  })

  const actions = [...new Set(logs.map(l => l.action))].sort()

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={s.content}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Protokoll</h1>
        <p style={{ fontSize: 12, color: 'var(--textMuted)' }}>Audit-Log aller Aktionen im PMS</p>
        <button onClick={() => exportCSV(`protokoll_${csvDate()}.csv`, ['Zeitpunkt','Benutzer','Rolle','Aktion','Entity','Entity-ID','Details'], filtered.map(l => [l.timestamp ? new Date(l.timestamp).toLocaleString('de-DE') : '', l.user_name, l.user_role, ACTION_LABELS[l.action]||l.action, l.entity_type||'', l.entity_id||'', l.details ? JSON.stringify(l.details) : '']))} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textMuted)', marginTop: 8 }}>CSV Export</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche nach Name, Aktion, Entity-ID..."
          style={{ flex: 1, minWidth: 200, padding: '10px 14px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ padding: '8px 14px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--text)', fontFamily: 'inherit' }}>
          <option value="alle">Alle Aktionen</option>
          {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 120px 100px 1fr 100px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
          {['Zeitpunkt', 'Benutzer', 'Aktion', 'Details', 'Entity'].map(h => (
            <span key={h} style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Protokolleinträge</div>
        ) : filtered.slice(0, visibleCount).map(l => {
          const color = ACTION_COLORS[l.action] || '#6b7280'
          return (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '130px 120px 100px 1fr 100px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{l.timestamp ? new Date(l.timestamp).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              <div>
                <div style={{ fontSize: 12, color: 'var(--textSec)', fontWeight: 500 }}>{l.user_name}</div>
                <div style={{ fontSize: 9, color: 'var(--textDim)' }}>{l.user_role}</div>
              </div>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${color}12`, color, fontWeight: 500, textAlign: 'center' }}>{ACTION_LABELS[l.action] || l.action}</span>
              <span style={{ fontSize: 11, color: 'var(--textMuted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.details && typeof l.details === 'object' ? Object.entries(l.details).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--textDim)' }}>{l.entity_type}{l.entity_id ? ` #${l.entity_id.slice(-6)}` : ''}</span>
            </div>
          )
        })}

        {filtered.length > visibleCount && (
          <button onClick={() => setVisibleCount(v => v + 100)} style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Mehr laden ({visibleCount} von {filtered.length})
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 1400 },
}
