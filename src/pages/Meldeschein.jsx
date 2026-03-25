import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'
import { loadInvoiceData } from '../lib/invoice'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Meldeschein() {
  const [sessions, setSessions] = useState([])
  const [forms, setForms] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewCheckin, setShowNewCheckin] = useState(false)
  const [showNewInvoice, setShowNewInvoice] = useState(false)
  const [newCheckin, setNewCheckin] = useState({ room: '', guest_name: '', booking_id: '' })
  const [newInvoice, setNewInvoice] = useState({ room: '', guest_name: '' })
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [displayConnected, setDisplayConnected] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [selectedForm, setSelectedForm] = useState(null)
  const [tab, setTab] = useState('meldescheine')

  const load = useCallback(async () => {
    const [sessRes, formRes, bookRes] = await Promise.all([
      supabase.from('guest_display_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('registration_forms').select('*').order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').in('status', ['confirmed', 'checked_in']).order('check_in', { ascending: true }),
    ])
    setSessions(sessRes.data || [])
    setForms(formRes.data || [])
    setBookings(bookRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const u1 = subscribeToTable('guest_display_sessions', () => load())
    const u2 = subscribeToTable('registration_forms', () => load())
    return () => { u1(); u2() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Check display connectivity via presence
  useEffect(() => {
    const channel = supabase.channel('display-heartbeat')
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      setDisplayConnected(Object.keys(state).length > 0)
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ type: 'pms', joined: new Date().toISOString() })
      }
    })
    return () => supabase.removeChannel(channel)
  }, [])

  const activeSession = sessions.find(s => s.status === 'active')

  const getSessionStatus = (s) => {
    if (s.status === 'active') return { label: 'Aktiv — Warte auf Gast...', color: '#f59e0b', pulse: true }
    if (s.status === 'completed') return { label: 'Meldeschein eingegangen', color: '#10b981', pulse: false }
    if (s.status === 'signed') return { label: 'Rechnung unterschrieben', color: '#10b981', pulse: false }
    if (s.status === 'waiting') return { label: 'Wartet', color: '#6b7280', pulse: false }
    return { label: s.status, color: '#6b7280', pulse: false }
  }

  const startCheckin = async () => {
    if (!newCheckin.room || !newCheckin.guest_name) return
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    await supabase.from('guest_display_sessions').insert({
      type: 'checkin', status: 'active', room: newCheckin.room,
      guest_name: newCheckin.guest_name, booking_id: newCheckin.booking_id || null,
      data: {}, created_at: new Date().toISOString(), expires_at: expiresAt,
    })
    setShowNewCheckin(false)
    setNewCheckin({ room: '', guest_name: '', booking_id: '' })
    load()
  }

  const startInvoice = async () => {
    if (!newInvoice.room || !newInvoice.guest_name) return
    // Find booking
    const booking = bookings.find(b => b.room === newInvoice.room)
    if (!booking) {
      setConfirm({ title: 'Keine Buchung', message: `Keine aktive Buchung für Zimmer ${newInvoice.room} gefunden.`, confirmLabel: 'OK', confirmColor: '#3b82f6', onConfirm: () => setConfirm(null) })
      return
    }

    // Load charges
    const charges = await loadInvoiceData(booking)
    const nights = Math.max(1, Math.round((new Date(booking.check_out) - new Date(booking.check_in)) / 86400000))

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    await supabase.from('guest_display_sessions').insert({
      type: 'invoice', status: 'active', room: newInvoice.room,
      guest_name: newInvoice.guest_name, booking_id: booking.booking_id || null,
      data: {
        room_total: parseFloat(booking.amount_due) || 0,
        nights,
        check_in: booking.check_in,
        check_out: booking.check_out,
        items: charges,
      },
      created_at: new Date().toISOString(), expires_at: expiresAt,
    })
    setShowNewInvoice(false)
    setNewInvoice({ room: '', guest_name: '' })
    setInvoiceSearch('')
    load()
  }

  const cancelSession = async (id) => {
    await supabase.from('guest_display_sessions').update({ status: 'waiting' }).eq('id', id)
    load()
  }

  const checkinSessions = sessions.filter(s => s.type === 'checkin')
  const invoiceSessions = sessions.filter(s => s.type === 'invoice')

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={s.content}>
      <div style={s.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Meldeschein & Gast-Display</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted)', margin: '4px 0 0' }}>Zwei-Geräte Check-in und Rechnungsunterschrift</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Display status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: displayConnected ? '#10b981' : '#ef4444', boxShadow: displayConnected ? '0 0 8px rgba(16,185,129,0.4)' : 'none' }} />
            <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{displayConnected ? 'Display verbunden' : 'Display offline'}</span>
          </div>
          <button onClick={() => setShowNewCheckin(true)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>+ Meldeschein</button>
          <button onClick={() => setShowNewInvoice(true)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#10b981', color: '#fff', border: 'none' }}>Rechnung anzeigen</button>
        </div>
      </div>

      {/* Active Session Banner */}
      {activeSession && (
        <div style={{ padding: '14px 20px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                {activeSession.type === 'checkin' ? 'Meldeschein aktiv' : 'Rechnung aktiv'} — Zimmer {activeSession.room}
              </div>
              <div style={{ fontSize: 11, color: 'var(--textMuted)' }}>{activeSession.guest_name} · Warte auf Gast...</div>
            </div>
          </div>
          <button onClick={() => cancelSession(activeSession.id)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>Abbrechen</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['meldescheine', `Meldescheine (${forms.length})`], ['sessions', `Sessions (${sessions.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            background: tab === k ? 'var(--text)' : 'var(--bgCard)', color: tab === k ? 'var(--bg)' : 'var(--textMuted)',
            border: `1px solid ${tab === k ? 'var(--text)' : 'var(--borderLight)'}`,
          }}>{l}</button>
        ))}
      </div>

      {/* Meldescheine Tab */}
      {tab === 'meldescheine' && (
        <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 100px 80px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
            {['Datum', 'Gast', 'Zimmer', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>
            ))}
          </div>

          {forms.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Noch keine Meldescheine vorhanden</div>
          ) : forms.map(f => (
            <div key={f.id} onClick={() => setSelectedForm(f)} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 100px 80px', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 8, cursor: 'pointer', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{new Date(f.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
              <span style={{ fontSize: 12, color: 'var(--textSec)' }}>{f.guest_name}</span>
              <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{f.room}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: f.status === 'completed' ? '#10b981' : '#f59e0b' }} />
                <span style={{ fontSize: 10, color: f.status === 'completed' ? '#10b981' : '#f59e0b' }}>{f.status === 'completed' ? 'Ausgefüllt' : 'Offen'}</span>
              </div>
              <span style={{ fontSize: 10, color: f.signature ? '#10b981' : 'var(--textDim)' }}>{f.signature ? 'Signiert' : '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sessions Tab */}
      {tab === 'sessions' && (
        <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 120px 1fr 80px 140px 80px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
            {['Typ', 'Datum', 'Gast', 'Zimmer', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>
            ))}
          </div>

          {sessions.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Keine Sessions vorhanden</div>
          ) : sessions.map(sess => {
            const st = getSessionStatus(sess)
            return (
              <div key={sess.id} style={{ display: 'grid', gridTemplateColumns: '80px 120px 1fr 80px 140px 80px', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: sess.type === 'checkin' ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)', color: sess.type === 'checkin' ? '#3b82f6' : '#8b5cf6', fontWeight: 500, textAlign: 'center' }}>
                  {sess.type === 'checkin' ? 'Check-in' : 'Rechnung'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{new Date(sess.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span style={{ fontSize: 12, color: 'var(--textSec)' }}>{sess.guest_name}</span>
                <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{sess.room}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {st.pulse && <div style={{ width: 6, height: 6, borderRadius: '50%', background: st.color, animation: 'pulse 1.5s ease-in-out infinite' }} />}
                  {!st.pulse && <div style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />}
                  <span style={{ fontSize: 10, color: st.color }}>{st.label}</span>
                </div>
                <div>
                  {sess.status === 'active' && (
                    <button onClick={() => cancelSession(sess.id)} style={{ padding: '4px 10px', borderRadius: 4, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>Stop</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ====== NEW CHECKIN MODAL ====== */}
      {showNewCheckin && (
        <div style={s.overlay} onClick={() => setShowNewCheckin(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Neuen Meldeschein starten</h3>
              <button onClick={() => setShowNewCheckin(false)} style={s.closeBtn}>✕</button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--textMuted)', margin: '0 0 16px' }}>Der Meldeschein wird auf dem Gast-Display angezeigt.</p>

            {/* Quick select from bookings */}
            {bookings.filter(b => b.status === 'checked_in' && !b.meldeschein_completed).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Schnellauswahl (eingecheckt, ohne Meldeschein)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {bookings.filter(b => b.status === 'checked_in' && !b.meldeschein_completed).slice(0, 8).map(b => (
                    <button key={b.id} onClick={() => setNewCheckin({ room: b.room, guest_name: b.guest_name, booking_id: b.booking_id || '' })} style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                      background: newCheckin.room === b.room ? 'rgba(59,130,246,0.1)' : 'var(--bgCard)',
                      color: newCheckin.room === b.room ? '#3b82f6' : 'var(--textMuted)',
                      border: `1px solid ${newCheckin.room === b.room ? '#3b82f6' : 'var(--borderLight)'}`,
                      fontWeight: newCheckin.room === b.room ? 600 : 400,
                    }}>
                      Zi. {b.room} · {b.guest_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label style={s.label}>Zimmernummer</label>
            <input style={s.input} placeholder="z.B. 201" value={newCheckin.room} onChange={e => setNewCheckin(p => ({ ...p, room: e.target.value }))} />

            <label style={s.label}>Gastname</label>
            <input style={s.input} placeholder="Max Mustermann" value={newCheckin.guest_name} onChange={e => setNewCheckin(p => ({ ...p, guest_name: e.target.value }))} />

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setShowNewCheckin(false)} style={s.cancelBtn}>Abbrechen</button>
              <button disabled={!newCheckin.room || !newCheckin.guest_name} onClick={startCheckin} style={{
                ...s.saveBtn, opacity: (!newCheckin.room || !newCheckin.guest_name) ? 0.4 : 1,
              }}>An Gast-Display senden</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== NEW INVOICE MODAL ====== */}
      {showNewInvoice && (
        <div style={s.overlay} onClick={() => setShowNewInvoice(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Rechnung auf Display anzeigen</h3>
              <button onClick={() => setShowNewInvoice(false)} style={s.closeBtn}>✕</button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--textMuted)', margin: '0 0 16px' }}>Wähle eine aktive Buchung oder gib die Zimmernummer ein.</p>

            <label style={s.label}>Suche</label>
            <input style={s.input} placeholder="Gast oder Zimmernummer..." value={invoiceSearch} onChange={e => { setInvoiceSearch(e.target.value) }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
              {bookings.filter(b => {
                const q = invoiceSearch.toLowerCase()
                return !q || b.guest_name?.toLowerCase().includes(q) || b.room?.includes(q)
              }).slice(0, 10).map(b => (
                <button key={b.id} onClick={() => setNewInvoice({ room: b.room, guest_name: b.guest_name })} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  background: newInvoice.room === b.room ? 'rgba(16,185,129,0.06)' : 'var(--bgCard)',
                  border: `1px solid ${newInvoice.room === b.room ? '#10b981' : 'var(--borderLight)'}`,
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--textSec)', fontWeight: 500 }}>{b.guest_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--textDim)' }}>Zimmer {b.room} · {b.check_in} – {b.check_out}</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>{parseFloat(b.amount_due || 0).toFixed(0)}€</div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNewInvoice(false)} style={s.cancelBtn}>Abbrechen</button>
              <button disabled={!newInvoice.room || !newInvoice.guest_name} onClick={startInvoice} style={{
                ...s.saveBtn, background: '#10b981', opacity: (!newInvoice.room || !newInvoice.guest_name) ? 0.4 : 1,
              }}>Rechnung senden</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== FORM DETAIL MODAL ====== */}
      {selectedForm && (
        <div style={s.overlay} onClick={() => setSelectedForm(null)}>
          <div style={{ ...s.modal, maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Meldeschein — {selectedForm.guest_name}</h3>
              <button onClick={() => setSelectedForm(null)} style={s.closeBtn}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[['Zimmer', selectedForm.room], ['Datum', new Date(selectedForm.created_at).toLocaleDateString('de-DE')], ['Status', selectedForm.status]].map(([l, v]) => (
                <div key={l} style={{ padding: '8px 12px', background: 'var(--bgCard)', borderRadius: 8, border: '1px solid var(--borderLight)' }}>
                  <div style={{ fontSize: 9, color: 'var(--textDim)', textTransform: 'uppercase' }}>{l}</div>
                  <div style={{ fontSize: 12, color: 'var(--textSec)', marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            {selectedForm.data?.main_guest && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Hauptgast</div>
                {Object.entries(selectedForm.data.main_guest).map(([k, v]) => v && (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{k}</span>
                    <span style={{ fontSize: 11, color: 'var(--textSec)' }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedForm.data?.companions?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Begleitpersonen</div>
                {selectedForm.data.companions.map((c, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'var(--bgCard)', borderRadius: 8, border: '1px solid var(--borderLight)', marginBottom: 4 }}>
                    <div style={{ fontSize: 12, color: 'var(--textSec)' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--textDim)' }}>{c.birth_date} · {c.nationality}</div>
                  </div>
                ))}
              </div>
            )}

            {selectedForm.signature && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Unterschrift</div>
                <img src={selectedForm.signature} alt="Unterschrift" style={{ width: '100%', maxHeight: 120, objectFit: 'contain', background: '#fff', borderRadius: 8, border: '1px solid var(--borderLight)' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 480 },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '10px 14px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 14, fontFamily: 'inherit' },
  cancelBtn: { flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  saveBtn: { flex: 1, padding: 12, background: '#3b82f6', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
