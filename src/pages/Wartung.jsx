import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'
import { useNotifications } from '../hooks/useNotifications'

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
  const [rooms, setRooms] = useState([])
  const [blockHistory, setBlockHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('aktiv')
  const [showBlock, setShowBlock] = useState(null) // room to block
  const [blockForm, setBlockForm] = useState({ reason: '', type: 'indefinite', until: '' })

  const todayStr = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    const [req, rm, bh] = await Promise.all([
      supabase.from('maintenance').select('*').order('created_at', { ascending: false }),
      supabase.from('rooms').select('*').order('room_number', { ascending: true }),
      supabase.from('room_blocks').select('*').order('blocked_at', { ascending: false }),
    ])
    const roomData = rm.data || []

    // Auto-unblock: rooms with blocked_until in the past
    const toUnblock = roomData.filter(r => r.blocked_until && r.blocked_until < todayStr)
    for (const r of toUnblock) {
      await supabase.from('rooms').update({ blocked_until: null, blocked_reason: null, blocked_by: null }).eq('id', r.id)
      await supabase.from('room_blocks').update({ unblocked_at: new Date().toISOString() }).eq('room', String(r.room_number)).is('unblocked_at', null)
    }
    if (toUnblock.length > 0) {
      const { data: refreshed } = await supabase.from('rooms').select('*').order('room_number', { ascending: true })
      setRooms(refreshed || roomData)
    } else {
      setRooms(roomData)
    }

    setRequests(req.data || [])
    setBlockHistory(bh.data || [])
    setLoading(false)
  }, [todayStr])

  useEffect(() => {
    load()
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (id, status) => {
    await supabase.from('maintenance').update({ status, resolved_at: status === 'fixed' ? new Date().toISOString() : null }).eq('id', id)
  }

  const simulateDefect = async () => {
    const dt = defectTypes[Math.floor(Math.random() * defectTypes.length)]
    const room = [101, 102, 201, 202, 203, 301, 302, 401, 501][Math.floor(Math.random() * 9)]
    await supabase.from('maintenance').insert({ room_number: String(room), type: dt.type, request_details: `${dt.label} defekt in Zi. ${room}`, status: 'pending', priority: Math.random() > 0.7 ? 'high' : 'normal' })
  }

  const blockRoom = async () => {
    if (!blockForm.reason || !showBlock) return
    const rn = String(showBlock.room_number)
    const until = blockForm.type === 'until_date' ? blockForm.until : null
    await supabase.from('rooms').update({ blocked_reason: blockForm.reason, blocked_by: 'Rezeption', blocked_until: until }).eq('id', showBlock.id)
    await supabase.from('room_blocks').insert({ room: rn, reason: blockForm.reason, blocked_by: 'Rezeption', block_type: blockForm.type, blocked_until: until })
    setShowBlock(null); setBlockForm({ reason: '', type: 'indefinite', until: '' }); load()
  }

  const unblockRoom = async (room) => {
    await supabase.from('rooms').update({ blocked_until: null, blocked_reason: null, blocked_by: null }).eq('id', room.id)
    await supabase.from('room_blocks').update({ unblocked_at: new Date().toISOString() }).eq('room', String(room.room_number)).is('unblocked_at', null)
    load()
  }

  const active = requests.filter(r => r.status === 'pending' || r.status === 'in_progress')
  const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const history = requests.filter(r => r.status === 'fixed' && r.resolved_at && new Date(r.resolved_at) >= threeDaysAgo)
  const pending = requests.filter(r => r.status === 'pending')
  const inProgress = requests.filter(r => r.status === 'in_progress')

  const blockedRooms = rooms.filter(r => r.blocked_reason)
  const availableRooms = rooms.filter(r => !r.blocked_reason)

  const getTypeInfo = (type) => defectTypes.find(d => d.type === type) || { label: type, icon: '🔧' }
  const statusColors = { pending: '#3b82f6', in_progress: '#f59e0b', fixed: '#10b981' }
  const statusLabels = { pending: 'Offen', in_progress: 'In Arbeit', fixed: 'Behoben' }
  const timeAgo = (d) => { const m = Math.floor((Date.now() - new Date(d)) / 60000); return m < 60 ? `vor ${m} Min.` : `vor ${Math.floor(m / 60)} Std.` }

  if (loading) return <div style={S.content}><div style={{ textAlign: 'center', padding: 40, color: 'var(--textDim,#444)' }}>Laden...</div></div>

  return (
    <div style={S.content}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={S.h1}>Wartung & Zimmersperren</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted,#888)', marginTop: -12 }}>{pending.length} offene Defekte · {blockedRooms.length} gesperrte Zimmer</p>
        </div>
        <button onClick={simulateDefect} style={{ padding: '7px 14px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: 10, color: '#3b82f6', cursor: 'pointer', fontFamily: 'inherit' }}>Demo: Neuer Defekt</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['pending', 'Offen', pending.length], ['in_progress', 'In Arbeit', inProgress.length], ['blocked', 'Gesperrt', blockedRooms.length]].map(([s, l, c]) =>
          <div key={s} style={{ padding: '10px 16px', borderRadius: 8, background: `${s === 'blocked' ? '#ef4444' : statusColors[s]}10`, border: `1px solid ${s === 'blocked' ? '#ef4444' : statusColors[s]}30`, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: s === 'blocked' ? '#ef4444' : statusColors[s] }}>{c}</div>
            <div style={{ fontSize: 10, color: 'var(--textMuted,#888)' }}>{l}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['aktiv', `Defekte (${active.length})`], ['sperren', `Zimmer (${rooms.length})`], ['historie', `Sperrhistorie (${blockHistory.length})`], ['verlauf', `Verlauf 3T (${history.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            background: tab === k ? 'var(--text,#fff)' : 'var(--bgCard,#0e0e0e)', color: tab === k ? 'var(--bg,#080808)' : 'var(--textMuted,#888)',
            border: `1px solid ${tab === k ? 'var(--text,#fff)' : 'var(--borderLight,#1a1a1a)'}`,
          }}>{l}</button>
        ))}
      </div>

      {/* ====== DEFEKTE TAB ====== */}
      {(tab === 'aktiv' || tab === 'verlauf') && (
        (tab === 'aktiv' ? active : history).length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--textDim,#444)' }}>{tab === 'aktiv' ? 'Keine offenen Defektmeldungen' : 'Kein Verlauf in den letzten 3 Tagen'}</div> :
        <div style={S.card}>
          {(tab === 'aktiv' ? active : history).map(r => {
            const info = getTypeInfo(r.type)
            const isOverdue = r.status === 'pending' && (Date.now() - new Date(r.timestamp)) > 15 * 60000
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border,#151515)', gap: 12, background: isOverdue ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
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
      )}

      {/* ====== ZIMMER / SPERREN TAB ====== */}
      {tab === 'sperren' && (
        <div>
          {/* Blocked rooms first */}
          {blockedRooms.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontWeight: 500 }}>Gesperrte Zimmer ({blockedRooms.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {blockedRooms.map(r => (
                  <div key={r.id} style={{ background: 'var(--bgCard)', border: '2px solid #ef4444', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ height: 4, background: '#ef4444' }} />
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{r.room_number}</div>
                          <div style={{ fontSize: 10, color: 'var(--textDim)' }}>{r.room_type || ''}</div>
                        </div>
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 500 }}>Gesperrt</span>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--textSec)' }}>{r.blocked_reason}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--textDim)' }}>
                          {r.blocked_until ? `Bis ${new Date(r.blocked_until + 'T00:00').toLocaleDateString('de-DE')}` : 'Vorläufig gesperrt'}
                          {r.blocked_by && ` · ${r.blocked_by}`}
                        </span>
                        <button onClick={() => unblockRoom(r)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>Entsperren</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available rooms */}
          <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontWeight: 500 }}>Verfügbare Zimmer ({availableRooms.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {availableRooms.map(r => (
              <div key={r.id} style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{r.room_number}</div>
                  <div style={{ fontSize: 10, color: 'var(--textDim)' }}>{r.room_type || ''} · Etage {r.floor || '?'}</div>
                </div>
                <button onClick={() => { setShowBlock(r); setBlockForm({ reason: '', type: 'indefinite', until: '' }) }} style={{ padding: '6px 14px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Sperren</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====== SPERRHISTORIE TAB ====== */}
      {tab === 'historie' && (
        <div style={S.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px 100px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
            {['Zimmer', 'Grund', 'Gesperrt am', 'Typ', 'Entsperrt'].map(h => (
              <span key={h} style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>
            ))}
          </div>
          {blockHistory.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Sperrungen protokolliert</div>
          ) : blockHistory.map(b => (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px 100px', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{b.room}</span>
              <span style={{ fontSize: 12, color: 'var(--textSec)' }}>{b.reason}</span>
              <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{b.blocked_at ? new Date(b.blocked_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</span>
              <span style={{ fontSize: 10, color: b.block_type === 'indefinite' ? '#f59e0b' : '#3b82f6' }}>{b.block_type === 'indefinite' ? 'Vorläufig' : `Bis ${b.blocked_until || '—'}`}</span>
              <span style={{ fontSize: 11, color: b.unblocked_at ? '#10b981' : '#ef4444' }}>{b.unblocked_at ? new Date(b.unblocked_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'Aktiv'}</span>
            </div>
          ))}
        </div>
      )}

      {/* ====== BLOCK MODAL ====== */}
      {showBlock && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowBlock(null)}>
          <div style={{ background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Zimmer {showBlock.room_number} sperren</h3>
              <button onClick={() => setShowBlock(null)} style={{ background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Grund der Sperrung *</label>
              <input value={blockForm.reason} onChange={e => setBlockForm(p => ({ ...p, reason: e.target.value }))} placeholder="z.B. Wasserschaden, Renovierung, Defekte Heizung..."
                style={{ width: '100%', padding: '10px 14px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sperrart</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['indefinite', 'Vorläufig'], ['until_date', 'Bis Datum']].map(([k, l]) => (
                  <button key={k} onClick={() => setBlockForm(p => ({ ...p, type: k }))} style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, textAlign: 'center',
                    background: blockForm.type === k ? 'rgba(239,68,68,0.08)' : 'var(--bgCard)',
                    color: blockForm.type === k ? '#ef4444' : 'var(--textMuted)',
                    border: `1px solid ${blockForm.type === k ? '#ef4444' : 'var(--borderLight)'}`,
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {blockForm.type === 'until_date' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gesperrt bis</label>
                <input type="date" value={blockForm.until} min={todayStr} onChange={e => setBlockForm(p => ({ ...p, until: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setShowBlock(null)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button disabled={!blockForm.reason || (blockForm.type === 'until_date' && !blockForm.until)} onClick={blockRoom} style={{
                flex: 1, padding: 12, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: blockForm.reason ? '#ef4444' : '#555', color: '#fff', opacity: blockForm.reason ? 1 : 0.5,
              }}>Zimmer sperren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  h1: { fontSize: 22, fontWeight: 500, color: 'var(--text,#fff)', margin: '0 0 16px', letterSpacing: -0.5 },
  card: { background: 'var(--bgCard,#0e0e0e)', border: '1px solid var(--borderLight,#1a1a1a)', borderRadius: 12, overflow: 'hidden' },
}
