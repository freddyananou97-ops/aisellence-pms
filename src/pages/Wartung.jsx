import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNotifications } from '../hooks/useNotifications'

const S = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  h1: { fontSize: 22, fontWeight: 500, color: 'var(--text,#fff)', margin: '0 0 16px', letterSpacing: -0.5 },
  card: { background: 'var(--bgCard,#0e0e0e)', border: '1px solid var(--borderLight,#1a1a1a)', borderRadius: 12, overflow: 'hidden' },
  cardHead: { padding: '14px 16px', borderBottom: '1px solid var(--border,#151515)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 12, fontWeight: 500, color: 'var(--text,#fff)' },
}

const defectTypes = [
  { type: 'ac', label: 'Klimaanlage', icon: '❄️' },
  { type: 'tv', label: 'TV / Fernseher', icon: '📺' },
  { type: 'plumbing', label: 'Sanitär', icon: '🚿' },
  { type: 'wifi', label: 'WLAN', icon: '📶' },
  { type: 'electric', label: 'Elektrik', icon: '⚡' },
  { type: 'door', label: 'Tür / Schloss', icon: '🚪' },
  { type: 'heating', label: 'Heizung', icon: '🔥' },
  { type: 'furniture', label: 'Möbel', icon: '🪑' },
]

export default function Wartung() {
  const { flash, notify } = useNotifications('wartung')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRequests()
    const channel = supabase.channel('wartung-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'maintenance' }, (payload) => {
        setRequests(prev => [payload.new, ...prev])
        notify('Neue Defektmeldung', `Zimmer ${payload.new.room_number}: ${payload.new.type}`)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maintenance' }, (payload) => {
        setRequests(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const loadRequests = async () => {
    const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const { data } = await supabase.from('maintenance').select('*').order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('maintenance').update({ status, resolved_at: status === 'fixed' ? new Date().toISOString() : null }).eq('id', id)
  }

  const simulateDefect = async () => {
    const dt = defectTypes[Math.floor(Math.random() * defectTypes.length)]
    const room = [101, 102, 201, 202, 203, 301, 302, 401, 501][Math.floor(Math.random() * 9)]
    await supabase.from('maintenance').insert({ room_number: String(room), type: dt.type, request_details: `${dt.label} defekt in Zi. ${room}`, status: 'pending', priority: Math.random() > 0.7 ? 'high' : 'normal' })
  }

  const [tab, setTab] = useState('aktiv')

  const active = requests.filter(r => r.status === 'pending' || r.status === 'in_progress')
  const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const history = requests.filter(r => r.status === 'fixed' && r.resolved_at && new Date(r.resolved_at) >= threeDaysAgo)
  const pending = requests.filter(r => r.status === 'pending')
  const inProgress = requests.filter(r => r.status === 'in_progress')

  const getTypeInfo = (type) => defectTypes.find(d => d.type === type) || { label: type, icon: '🔧' }
  const statusColors = { pending: '#3b82f6', in_progress: '#f59e0b', fixed: '#10b981' }
  const statusLabels = { pending: 'Offen', in_progress: 'In Arbeit', fixed: 'Behoben' }
  const timeAgo = (d) => { const m = Math.floor((Date.now() - new Date(d)) / 60000); return m < 60 ? `vor ${m} Min.` : `vor ${Math.floor(m / 60)} Std.` }

  return (
    <div style={S.content}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={S.h1}>Wartung</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted,#888)', marginTop: -12 }}>{pending.length} offene Defektmeldungen</p>
        </div>
        <button onClick={simulateDefect} style={{ padding: '7px 14px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: 10, color: '#3b82f6', cursor: 'pointer', fontFamily: 'inherit' }}>Demo: Neuer Defekt</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['pending', 'Offen', pending.length], ['in_progress', 'In Arbeit', inProgress.length]].map(([s, l, c]) =>
          <div key={s} style={{ padding: '10px 16px', borderRadius: 8, background: `${statusColors[s]}10`, border: `1px solid ${statusColors[s]}30`, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: statusColors[s] }}>{c}</div>
            <div style={{ fontSize: 10, color: 'var(--textMuted,#888)' }}>{l}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['aktiv', `Aktiv (${active.length})`], ['verlauf', `Verlauf 3 Tage (${history.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            background: tab === k ? 'var(--text,#fff)' : 'var(--bgCard,#0e0e0e)', color: tab === k ? 'var(--bg,#080808)' : 'var(--textMuted,#888)',
            border: `1px solid ${tab === k ? 'var(--text,#fff)' : 'var(--borderLight,#1a1a1a)'}`,
          }}>{l}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--textDim,#444)' }}>Laden...</div> :
        (tab === 'aktiv' ? active : history).length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--textDim,#444)' }}>{tab === 'aktiv' ? 'Keine offenen Defektmeldungen' : 'Kein Verlauf in den letzten 3 Tagen'}</div> :
        <div style={S.card}>
          {(tab === 'aktiv' ? active : history).map(r => {
            const info = getTypeInfo(r.type)
            const isOverdue = r.status === 'pending' && (Date.now() - new Date(r.timestamp)) > 15 * 60000
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border,#151515)', gap: 12, background: isOverdue ? 'rgba(239,68,68,0.03)' : flash ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                <div style={{ fontSize: 20 }}>{info.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--textSec,#ccc)' }}>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, background: `${statusColors[r.status]}15`, color: statusColors[r.status], marginRight: 6 }}>Zi. {r.room_number}</span>
                    {info.label}
                    {isOverdue && <span style={{ color: '#ef4444', fontSize: 9, marginLeft: 6, fontWeight: 600 }}>ÜBERFÄLLIG</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--textDim,#444)', marginTop: 2 }}>{r.request_details || 'Keine Beschreibung'} · {timeAgo(r.timestamp)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {r.status === 'pending' && <button onClick={() => updateStatus(r.id, 'in_progress')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#000', fontSize: 10, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>Annehmen</button>}
                  {r.status === 'in_progress' && <button onClick={() => updateStatus(r.id, 'fixed')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>Behoben</button>}
                  {r.status === 'fixed' && <span style={{ fontSize: 10, color: '#10b981' }}>✓ Erledigt</span>}
                </div>
              </div>
            )
          })}
        </div>
      }
    </div>
  )
}
