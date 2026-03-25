import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchSpaTreatments, fetchSpaBookings, subscribeToTable } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import SignatureCanvas from '../components/SignatureCanvas'

const TIME_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00']
const SLOT_H = 38
const CAT_LABELS = { massage: 'Massage', gesicht: 'Gesicht', beauty: 'Beauty', wellness: 'Wellness' }
const STATUS_CONF = {
  confirmed: { label: 'Bestätigt', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  in_progress: { label: 'Laufend', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  completed: { label: 'Abgeschlossen', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  cancelled: { label: 'Storniert', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  no_show: { label: 'No-Show', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
}

export default function Spa() {
  const [treatments, setTreatments] = useState([])
  const [bookings, setBookings] = useState([])
  const [allBookings, setAllBookings] = useState([])
  const [spaRooms, setSpaRooms] = useState([])
  const [therapists, setTherapists] = useState([])
  const [hotelBookings, setHotelBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [view, setView] = useState('tag')
  const [showBook, setShowBook] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [chargeSign, setChargeSign] = useState(null) // { booking, signature } for inline signing
  const [listBookings, setListBookings] = useState([])
  const [listSearch, setListSearch] = useState('')
  const [listStatus, setListStatus] = useState('alle')
  const [listFrom, setListFrom] = useState('')
  const [listTo, setListTo] = useState('')

  const todayStr = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    try {
      const ws = new Date(date); ws.setDate(ws.getDate() - ws.getDay() + 1)
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      const wsStr = ws.toISOString().split('T')[0]
      const weStr = we.toISOString().split('T')[0]
      const [t, b, rm, th, hb, ab, lb] = await Promise.all([
        fetchSpaTreatments(),
        fetchSpaBookings(date),
        supabase.from('spa_rooms').select('*').eq('active', true).order('sort_order').then(r => r).catch(() => ({ data: [] })),
        supabase.from('spa_therapists').select('*').eq('active', true).order('name').then(r => r).catch(() => ({ data: [] })),
        supabase.from('bookings').select('*').eq('status', 'checked_in'),
        supabase.from('spa_bookings').select('*').gte('date', wsStr).lte('date', weStr).order('time'),
        supabase.from('spa_bookings').select('*').order('date', { ascending: false }).order('time', { ascending: false }).limit(200),
      ])
      setTreatments(t); setBookings(b); setSpaRooms(rm.data || []); setTherapists(th.data || [])
      setHotelBookings(hb.data || []); setAllBookings(ab.data || []); setListBookings(lb.data || [])
    } catch (e) { console.error('Spa load error:', e) }
    setLoading(false)
  }, [date])

  useEffect(() => { load(); const u = subscribeToTable('spa_bookings', () => load()); return u }, [load])

  const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

  const getBookingForSlot = (roomId, time, dayBookings) => {
    const src = dayBookings || bookings
    return src.find(b => {
      if (b.room !== roomId || (b.status === 'cancelled' || b.status === 'no_show')) return false
      const bStart = timeToMin(b.time); const bEnd = bStart + (b.duration || 60)
      return timeToMin(time) >= bStart && timeToMin(time) < bEnd
    })
  }

  const isBookingStart = (roomId, time, dayBookings) => {
    const src = dayBookings || bookings
    return src.find(b => b.room === roomId && b.time === time && b.status !== 'cancelled' && b.status !== 'no_show')
  }

  const hasCollision = (roomId, startTime, duration, excludeId) => {
    const start = timeToMin(startTime); const end = start + duration
    return bookings.some(b => {
      if (b.room !== roomId || b.id === excludeId || b.status === 'cancelled' || b.status === 'no_show') return false
      const bs = timeToMin(b.time); const be = bs + (b.duration || 60)
      return start < be && end > bs
    })
  }

  const addBooking = async (data) => {
    const treatment = treatments.find(t => t.id === data.treatmentId)
    const dur = treatment?.duration || 60
    if (hasCollision(data.room, data.time, dur)) {
      setConfirm({ title: 'Zeitkonflikt', message: 'Dieser Raum ist im gewählten Zeitfenster bereits belegt.', confirmLabel: 'OK', confirmColor: '#3b82f6', onConfirm: () => setConfirm(null) })
      return
    }
    await supabase.from('spa_bookings').insert({
      room: data.room, date, time: data.time, duration: dur,
      guest_name: data.guest, treatment: treatment?.name || 'Behandlung',
      price: treatment?.price || 0, status: 'confirmed',
      therapist_id: data.therapistId || null,
      therapist_name: data.therapistId ? therapists.find(t => t.id === data.therapistId)?.name : null,
      room_number: data.roomNumber || null, booking_id: data.bookingId || null,
    })
    setShowBook(null); load()
  }

  const updateStatus = async (id, status) => {
    await supabase.from('spa_bookings').update({ status }).eq('id', id)
    setSelected(null); load()
  }

  const chargeToRoom = (booking) => {
    if (!booking.room_number) {
      setConfirm({ title: 'Kein Zimmer', message: 'Diese Buchung ist nicht mit einem Hotelzimmer verknüpft.', confirmLabel: 'OK', confirmColor: '#3b82f6', onConfirm: () => setConfirm(null) })
      return
    }
    setChargeSign({ booking, signature: null })
    setSelected(null)
  }

  const confirmCharge = async () => {
    if (!chargeSign?.signature) return
    const booking = chargeSign.booking
    await supabase.from('service_requests').insert({
      room: booking.room_number, guest_name: booking.guest_name,
      category: 'spa', request_details: `Spa: ${booking.treatment} (${booking.duration}min)`,
      status: 'delivered', order_total: booking.price || 0, resolved_at: new Date().toISOString(),
      image_url: chargeSign.signature,
    })
    await supabase.from('spa_bookings').update({ payment_status: 'charged_to_room' }).eq('id', booking.id)
    setChargeSign(null)
    setConfirm({ title: 'Auf Zimmer gebucht', message: `${(booking.price || 0).toFixed(2)}€ auf Zimmer ${booking.room_number} gebucht.`, confirmLabel: 'OK', confirmColor: '#10b981', onConfirm: () => { setConfirm(null); load() } })
  }

  const cancelBooking = (booking) => {
    setConfirm({
      title: 'Stornieren', message: `Spa-Buchung von ${booking.guest_name} (${booking.treatment}) stornieren?`,
      confirmLabel: 'Stornieren', confirmColor: '#ef4444',
      onConfirm: async () => { await supabase.from('spa_bookings').update({ status: 'cancelled' }).eq('id', booking.id); setConfirm(null); setSelected(null); load() },
    })
  }

  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split('T')[0]) }
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split('T')[0]) }

  const todayStats = {
    total: bookings.filter(b => b.status !== 'cancelled' && b.status !== 'no_show').length,
    revenue: bookings.filter(b => b.status !== 'cancelled' && b.status !== 'no_show').reduce((s, b) => s + (parseFloat(b.price) || 0), 0),
  }

  const rooms = spaRooms.length > 0 ? spaRooms : [{ id: 'r1', name: 'Raum 1 — Massage' }, { id: 'r2', name: 'Raum 2 — Gesicht' }, { id: 'r3', name: 'Raum 3 — Beauty' }, { id: 'r4', name: 'Sauna' }]

  // Week view dates (use T12:00 to avoid timezone rollover issues)
  const weekStartD = new Date(date + 'T12:00:00')
  weekStartD.setDate(weekStartD.getDate() - ((weekStartD.getDay() + 6) % 7)) // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStartD); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0] })

  if (loading) return <div style={st.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={st.content}>
      <div style={st.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Spa</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted)', margin: '4px 0 0' }}>{todayStats.total} Buchungen · {todayStats.revenue.toFixed(0)}€ Umsatz</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowBook({ room: rooms[0]?.id || 'r1', time: '10:00' })} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#8b5cf6', color: '#fff', border: 'none' }}>+ Neue Buchung</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={st.statBox}><div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{todayStats.total}</div><div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Buchungen heute</div></div>
        <div style={st.statBox}><div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{todayStats.revenue.toFixed(0)}€</div><div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Umsatz heute</div></div>
        <div style={st.statBox}><div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{treatments.length}</div><div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Behandlungen</div></div>
      </div>

      {/* Inline Signature Modal for Room Charge */}
      {chargeSign && (
        <div style={st.overlay} onClick={() => setChargeSign(null)}>
          <div style={{ ...st.modal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Auf Zimmer {chargeSign.booking.room_number} buchen</h3>
              <button onClick={() => setChargeSign(null)} style={st.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--bgCard)', borderRadius: 10, border: '1px solid var(--borderLight)', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{chargeSign.booking.treatment}</div>
              <div style={{ fontSize: 11, color: 'var(--textMuted)', marginTop: 2 }}>{chargeSign.booking.guest_name} · {chargeSign.booking.duration}min</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#8b5cf6', marginTop: 6 }}>{parseFloat(chargeSign.booking.price || 0).toFixed(2)}€</div>
              <div style={{ fontSize: 10, color: 'var(--textDim)', marginTop: 2 }}>Wird auf Zimmer {chargeSign.booking.room_number} gebucht</div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--textMuted)', marginBottom: 8 }}>Bitte lassen Sie den Gast hier unterschreiben:</div>
            <SignatureCanvas onSign={(sig) => setChargeSign(prev => ({ ...prev, signature: sig }))} label="Unterschrift Gast" clearLabel="Unterschrift löschen" />

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setChargeSign(null)} style={st.cancelBtn}>Abbrechen</button>
              <button disabled={!chargeSign.signature} onClick={confirmCharge} style={{
                ...st.saveBtn, background: chargeSign.signature ? '#8b5cf6' : 'var(--bgCard)',
                color: chargeSign.signature ? '#fff' : 'var(--textDim)',
                opacity: chargeSign.signature ? 1 : 0.5,
              }}>Bestätigen & Buchen</button>
            </div>
          </div>
        </div>
      )}

      {/* View Tabs + Date Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['tag', 'Tag'], ['woche', 'Woche'], ['buchungen', `Buchungen (${listBookings.length})`]].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              background: view === k ? 'var(--text)' : 'var(--bgCard)', color: view === k ? 'var(--bg)' : 'var(--textMuted)',
              border: `1px solid ${view === k ? 'var(--text)' : 'var(--borderLight)'}`,
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={prevDay} style={st.navBtn}>←</button>
          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, minWidth: 120, textAlign: 'center' }}>
            {new Date(date + 'T00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <button onClick={() => setDate(todayStr)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: date === todayStr ? 'var(--text)' : 'var(--bgCard)', color: date === todayStr ? 'var(--bg)' : 'var(--textMuted)', border: `1px solid ${date === todayStr ? 'var(--text)' : 'var(--borderLight)'}` }}>Heute</button>
          <button onClick={nextDay} style={st.navBtn}>→</button>
        </div>
      </div>

      {/* ====== DAY VIEW ====== */}
      {view === 'tag' && (
        <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 700 }}>
              {/* Header */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 56, padding: '10px 8px', fontSize: 10, color: 'var(--textDim)' }}>Zeit</div>
                {rooms.map(r => (
                  <div key={r.id} style={{ flex: 1, padding: '10px 8px', fontSize: 11, color: 'var(--textMuted)', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>{r.name}</div>
                ))}
              </div>
              {/* Time Rows */}
              {TIME_SLOTS.map(time => (
                <div key={time} style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 56, padding: '8px 6px', fontSize: 10, color: 'var(--textDim)', display: 'flex', alignItems: 'center' }}>{time}</div>
                  {rooms.map(room => {
                    const rid = room.id || room.name
                    const booking = getBookingForSlot(rid, time)
                    const startBooking = isBookingStart(rid, time)
                    const slotSpan = startBooking ? Math.ceil((startBooking.duration || 60) / 30) : 1
                    return (
                      <div key={rid} style={{ flex: 1, height: SLOT_H, borderLeft: '1px solid var(--border)', padding: '1px 3px', cursor: !booking ? 'pointer' : 'default', position: 'relative' }}
                        onClick={() => { if (!booking) setShowBook({ room: rid, time }) }}>
                        {startBooking && (
                          <div onClick={e => { e.stopPropagation(); setSelected(startBooking) }}
                            style={{
                              position: 'absolute', top: 1, left: 3, right: 3, zIndex: 2,
                              height: slotSpan * SLOT_H - 4, overflow: 'hidden',
                              background: STATUS_CONF[startBooking.status]?.bg || 'rgba(139,92,246,0.12)',
                              border: `1px solid ${STATUS_CONF[startBooking.status]?.color || '#8b5cf6'}40`,
                              borderLeft: `3px solid ${STATUS_CONF[startBooking.status]?.color || '#8b5cf6'}`,
                              borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                            }}>
                            <div style={{ fontSize: 10, color: STATUS_CONF[startBooking.status]?.color || '#8b5cf6', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{startBooking.treatment}</div>
                            <div style={{ fontSize: 9, color: 'var(--textMuted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{startBooking.guest_name}{startBooking.therapist_name ? ` · ${startBooking.therapist_name}` : ''}</div>
                            {slotSpan >= 3 && <div style={{ fontSize: 8, color: 'var(--textDim)', marginTop: 1 }}>{startBooking.duration}min{startBooking.room_number ? ` · Zi.${startBooking.room_number}` : ''}</div>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====== WEEK VIEW ====== */}
      {view === 'woche' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {weekDays.map(day => {
            const dayB = allBookings.filter(b => b.date === day && b.status !== 'cancelled' && b.status !== 'no_show')
            const isToday = day === todayStr
            const openDay = () => { setDate(day); setView('tag') }
            return (
              <button key={day} onClick={openDay} style={{
                background: 'var(--bgCard)', border: `1px solid ${isToday ? '#8b5cf6' : 'var(--borderLight)'}`, borderRadius: 10, padding: 12, cursor: 'pointer', minHeight: 140,
                textAlign: 'left', fontFamily: 'inherit',
              }}>
                <div style={{ fontSize: 10, color: isToday ? '#8b5cf6' : 'var(--textMuted)', fontWeight: 500 }}>{new Date(day + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short' })}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: isToday ? '#8b5cf6' : 'var(--text)' }}>{new Date(day + 'T12:00').getDate()}</div>
                {dayB.length > 0 ? (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {dayB.slice(0, 5).map(b => (
                      <div key={b.id} style={{ fontSize: 9, color: STATUS_CONF[b.status]?.color || '#8b5cf6', background: STATUS_CONF[b.status]?.bg || 'rgba(139,92,246,0.06)', padding: '2px 5px', borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.time} {b.guest_name?.split(' ')[0]}
                      </div>
                    ))}
                    {dayB.length > 5 && <div style={{ fontSize: 9, color: 'var(--textDim)' }}>+{dayB.length - 5} weitere</div>}
                  </div>
                ) : <div style={{ fontSize: 9, color: 'var(--textDim)', marginTop: 8 }}>—</div>}
              </button>
            )
          })}
        </div>
      )}

      {/* ====== BUCHUNGEN LIST VIEW ====== */}
      {view === 'buchungen' && (() => {
        const filtered = listBookings.filter(b => {
          const q = listSearch.toLowerCase()
          const matchSearch = !q || b.guest_name?.toLowerCase().includes(q)
          const matchStatus = listStatus === 'alle' || b.status === listStatus
          const matchFrom = !listFrom || b.date >= listFrom
          const matchTo = !listTo || b.date <= listTo
          return matchSearch && matchStatus && matchFrom && matchTo
        })
        return (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Gastname suchen..."
                style={{ flex: 1, minWidth: 160, padding: '8px 12px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
              <input type="date" value={listFrom} onChange={e => setListFrom(e.target.value)} style={{ padding: '8px 10px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 11, color: 'var(--text)', fontFamily: 'inherit' }} />
              <span style={{ fontSize: 11, color: 'var(--textDim)', alignSelf: 'center' }}>bis</span>
              <input type="date" value={listTo} onChange={e => setListTo(e.target.value)} style={{ padding: '8px 10px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 11, color: 'var(--text)', fontFamily: 'inherit' }} />
              {[['alle', 'Alle'], ['confirmed', 'Bestätigt'], ['completed', 'Abgeschl.'], ['cancelled', 'Storniert']].map(([k, l]) => (
                <button key={k} onClick={() => setListStatus(k)} style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                  background: listStatus === k ? 'var(--text)' : 'var(--bgCard)', color: listStatus === k ? 'var(--bg)' : 'var(--textMuted)',
                  border: `1px solid ${listStatus === k ? 'var(--text)' : 'var(--borderLight)'}`,
                }}>{l}</button>
              ))}
            </div>

            {/* Table */}
            <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 50px 1fr 1fr 100px 90px 80px 60px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
                {['Datum', 'Zeit', 'Gast', 'Behandlung', 'Raum', 'Therapeut', 'Status', 'Preis'].map(h => (
                  <span key={h} style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>{h}</span>
                ))}
              </div>
              {filtered.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Buchungen gefunden</div>
              ) : filtered.map(b => {
                const sc = STATUS_CONF[b.status] || STATUS_CONF.confirmed
                return (
                  <div key={b.id} onClick={() => setSelected(b)} style={{ display: 'grid', gridTemplateColumns: '80px 50px 1fr 1fr 100px 90px 80px 60px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8, cursor: 'pointer', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{b.date ? new Date(b.date + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '—'}</span>
                    <span style={{ fontSize: 11, color: 'var(--textSec)' }}>{b.time || '—'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.guest_name}{b.room_number ? <span style={{ fontSize: 9, color: 'var(--textDim)', marginLeft: 4 }}>Zi.{b.room_number}</span> : ''}</span>
                    <span style={{ fontSize: 11, color: 'var(--textSec)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.treatment}</span>
                    <span style={{ fontSize: 10, color: 'var(--textMuted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rooms.find(r => (r.id || r.name) === b.room)?.name || b.room}</span>
                    <span style={{ fontSize: 10, color: 'var(--textMuted)' }}>{b.therapist_name || '—'}</span>
                    <span style={{ fontSize: 9, padding: '3px 6px', borderRadius: 4, background: sc.bg, color: sc.color, fontWeight: 500, textAlign: 'center' }}>{sc.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{parseFloat(b.price || 0).toFixed(0)}€</span>
                  </div>
                )
              })}
            </div>
            {filtered.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0', fontSize: 11, color: 'var(--textMuted)' }}>
                {filtered.length} Buchungen · {filtered.reduce((s, b) => s + (parseFloat(b.price) || 0), 0).toFixed(0)}€ Umsatz
              </div>
            )}
          </div>
        )
      })()}

      {/* Treatment Catalog */}
      {treatments.length > 0 && (
        <div style={{ ...st.card, marginTop: 16 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Behandlungskatalog</span>
            <span style={{ fontSize: 10, color: 'var(--textMuted)', background: 'var(--border)', padding: '2px 8px', borderRadius: 10 }}>{treatments.length}</span>
          </div>
          {Object.entries(treatments.reduce((a, t) => { const cat = t.category || 'sonstige'; a[cat] = a[cat] || []; a[cat].push(t); return a }, {})).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ padding: '8px 16px', fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, background: 'var(--bgSec)' }}>{CAT_LABELS[cat] || cat}</div>
              {items.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--textSec)', flex: 1 }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{t.duration} Min.</span>
                  <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{t.price}€</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ====== DETAIL PANEL ====== */}
      {selected && (
        <div style={st.overlay} onClick={() => setSelected(null)}>
          <div style={{ ...st.modal, maxWidth: 440, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Spa-Buchung</h3>
              <button onClick={() => setSelected(null)} style={st.closeBtn}>✕</button>
            </div>

            {/* Status Badge */}
            {(() => { const sc = STATUS_CONF[selected.status] || STATUS_CONF.confirmed; return (
              <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 8, background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>{sc.label}</div>
            ) })()}

            {[
              ['Behandlung', selected.treatment], ['Gast', selected.guest_name],
              ['Raum', rooms.find(r => (r.id || r.name) === selected.room)?.name || selected.room],
              ['Datum', selected.date], ['Uhrzeit', selected.time], ['Dauer', `${selected.duration || 60} Min.`],
              ['Preis', `${parseFloat(selected.price || 0).toFixed(2)}€`],
              ['Therapeut', selected.therapist_name || '—'],
              ['Hotelzimmer', selected.room_number || '—'],
              ['Zahlung', selected.payment_status === 'charged_to_room' ? 'Auf Zimmer gebucht' : 'Offen'],
            ].map(([l, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{l}</span>
                <span style={{ fontSize: 11, color: 'var(--textSec)', fontWeight: l === 'Preis' ? 600 : 400 }}>{v}</span>
              </div>
            ))}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {/* Status transitions */}
              {selected.status === 'confirmed' && (
                <button onClick={() => updateStatus(selected.id, 'in_progress')} style={{ ...st.actionBtn, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>Behandlung starten</button>
              )}
              {selected.status === 'in_progress' && (
                <button onClick={() => updateStatus(selected.id, 'completed')} style={{ ...st.actionBtn, background: '#10b981', color: '#fff', border: 'none' }}>Abschließen</button>
              )}

              {/* Charge to room */}
              {selected.room_number && selected.payment_status !== 'charged_to_room' && selected.status !== 'cancelled' && (
                <button onClick={() => chargeToRoom(selected)} style={{ ...st.actionBtn, background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
                  Auf Zimmer {selected.room_number} buchen ({parseFloat(selected.price || 0).toFixed(2)}€)
                </button>
              )}

              {/* Cancel */}
              {selected.status !== 'cancelled' && selected.status !== 'completed' && (
                <button onClick={() => cancelBooking(selected)} style={{ ...st.actionBtn, color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>Stornieren</button>
              )}
              {selected.status === 'confirmed' && (
                <button onClick={() => updateStatus(selected.id, 'no_show')} style={{ ...st.actionBtn, color: '#6b7280', border: '1px solid var(--borderLight)' }}>No-Show</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== NEW BOOKING MODAL ====== */}
      {showBook && (
        <div style={st.overlay} onClick={() => setShowBook(null)}>
          <div style={st.modal} onClick={e => e.stopPropagation()}>
            <BookingForm
              room={showBook.room} time={showBook.time} rooms={rooms}
              treatments={treatments} therapists={therapists} hotelBookings={hotelBookings}
              onSave={addBooking} onCancel={() => setShowBook(null)}
            />
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
    </div>
  )
}

function BookingForm({ room, time, rooms, treatments, therapists, hotelBookings, onSave, onCancel }) {
  const [guest, setGuest] = useState('')
  const [treatmentId, setTreatmentId] = useState(treatments[0]?.id || '')
  const [therapistId, setTherapistId] = useState('')
  const [selectedRoom, setSelectedRoom] = useState(room)
  const [selectedTime, setSelectedTime] = useState(time)
  const [hotelGuest, setHotelGuest] = useState(null) // { guest_name, room, booking_id }
  const [guestMode, setGuestMode] = useState('hotel') // 'hotel' or 'walkin'

  const roomName = rooms.find(r => (r.id || r.name) === selectedRoom)?.name || selectedRoom

  const selectHotelGuest = (b) => {
    setHotelGuest(b)
    setGuest(b.guest_name)
  }

  const finalGuest = guestMode === 'hotel' && hotelGuest ? hotelGuest.guest_name : guest

  return (
    <>
      <h3 style={{ fontSize: 16, color: 'var(--text)', margin: '0 0 4px', fontWeight: 500 }}>Neue Spa-Buchung</h3>
      <p style={{ fontSize: 11, color: 'var(--textMuted)', margin: '0 0 16px' }}>{roomName} · {selectedTime}</p>

      {/* Guest selection mode */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[['hotel', 'Hotelgast'], ['walkin', 'Walk-in']].map(([k, l]) => (
          <button key={k} onClick={() => { setGuestMode(k); setHotelGuest(null); setGuest('') }} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            background: guestMode === k ? 'rgba(139,92,246,0.08)' : 'var(--bgCard)', color: guestMode === k ? '#8b5cf6' : 'var(--textMuted)',
            border: `1px solid ${guestMode === k ? '#8b5cf6' : 'var(--borderLight)'}`,
          }}>{l}</button>
        ))}
      </div>

      {guestMode === 'hotel' ? (
        <div style={{ marginBottom: 14 }}>
          <label style={st.label}>Hotelgast auswählen</label>
          {hotelBookings.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--textDim)', padding: '8px 0' }}>Keine eingecheckten Gäste</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hotelBookings.map(b => (
                <button key={b.id} onClick={() => selectHotelGuest(b)} style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  background: hotelGuest?.id === b.id ? 'rgba(139,92,246,0.1)' : 'var(--bgCard)',
                  color: hotelGuest?.id === b.id ? '#8b5cf6' : 'var(--textMuted)',
                  border: `1px solid ${hotelGuest?.id === b.id ? '#8b5cf6' : 'var(--borderLight)'}`,
                  fontWeight: hotelGuest?.id === b.id ? 600 : 400,
                }}>Zi.{b.room} · {b.guest_name}</button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <label style={st.label}>Gastname</label>
          <input style={st.input} placeholder="Name des Gastes" value={guest} onChange={e => setGuest(e.target.value)} />
        </div>
      )}

      <label style={st.label}>Behandlung</label>
      <select style={{ ...st.input, marginBottom: 14 }} value={treatmentId} onChange={e => setTreatmentId(e.target.value)}>
        {treatments.map(t => <option key={t.id} value={t.id}>{t.name} — {t.duration}min — {t.price}€</option>)}
      </select>

      {/* Room + Time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div>
          <label style={st.label}>Raum</label>
          <select style={st.input} value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
            {rooms.map(r => <option key={r.id || r.name} value={r.id || r.name}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label style={st.label}>Uhrzeit</label>
          <select style={st.input} value={selectedTime} onChange={e => setSelectedTime(e.target.value)}>
            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Therapist */}
      {therapists.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={st.label}>Therapeut (optional)</label>
          <select style={st.input} value={therapistId} onChange={e => setTherapistId(e.target.value)}>
            <option value="">— Kein Therapeut —</option>
            {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={st.cancelBtn} onClick={onCancel}>Abbrechen</button>
        <button style={{ ...st.saveBtn, opacity: !finalGuest ? 0.4 : 1 }} disabled={!finalGuest} onClick={() => onSave({
          room: selectedRoom, time: selectedTime, guest: finalGuest, treatmentId,
          therapistId: therapistId || null,
          roomNumber: hotelGuest?.room || null,
          bookingId: hotelGuest?.booking_id || null,
        })}>Buchen</button>
      </div>
    </>
  )
}

const st = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  statBox: { background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, padding: 16, textAlign: 'center' },
  navBtn: { padding: '6px 10px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textMuted)' },
  card: { background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 480 },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionBtn: { width: '100%', padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textSec)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, textAlign: 'center' },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '10px 14px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  cancelBtn: { flex: 1, padding: 10, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  saveBtn: { flex: 1, padding: 10, background: 'var(--text)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
}
