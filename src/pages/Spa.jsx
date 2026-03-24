import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchSpaTreatments, fetchSpaBookings, subscribeToTable } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'

const TIME_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00']
const ROOMS = [{ id: 'r1', name: 'Raum 1 — Massage' }, { id: 'r2', name: 'Raum 2 — Gesicht' }, { id: 'r3', name: 'Raum 3 — Beauty' }, { id: 'r4', name: 'Sauna' }]
const CAT_LABELS = { massage: 'Massage', gesicht: 'Gesicht', beauty: 'Beauty', wellness: 'Wellness' }

export default function Spa({ user }) {
  const [treatments, setTreatments] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [showBook, setShowBook] = useState(null) // { room, time }
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    const [t, b] = await Promise.all([fetchSpaTreatments(), fetchSpaBookings(date)])
    setTreatments(t); setBookings(b); setLoading(false)
  }, [date])

  useEffect(() => { load(); const u1 = subscribeToTable('spa_bookings', () => load()); return u1 }, [load])

  // Demo bookings
  const displayBookings = bookings.length > 0 ? bookings : [
    { id: 'd1', room: 'r1', time: '10:00', duration: 60, guest_name: 'Sarah Fischer', treatment: 'Thai Massage', date },
    { id: 'd2', room: 'r1', time: '14:00', duration: 75, guest_name: 'Dr. Schmidt', treatment: 'Hot Stone Massage', date },
    { id: 'd3', room: 'r2', time: '11:00', duration: 60, guest_name: 'Anna Braun', treatment: 'Gesichtsbehandlung Classic', date },
    { id: 'd4', room: 'r3', time: '15:00', duration: 45, guest_name: 'Maria Weber', treatment: 'Maniküre', date },
    { id: 'd5', room: 'r4', time: '09:00', duration: 120, guest_name: 'Thomas Keller', treatment: 'Sauna & Relax Package', date },
  ]

  const getBookingForSlot = (roomId, time) => {
    return displayBookings.find(b => {
      if (b.room !== roomId) return false
      const bStart = timeToMin(b.time)
      const bEnd = bStart + (b.duration || 60)
      const slotMin = timeToMin(time)
      return slotMin >= bStart && slotMin < bEnd
    })
  }

  const isBookingStart = (roomId, time) => {
    return displayBookings.find(b => b.room === roomId && b.time === time)
  }

  const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

  const addBooking = async (data) => {
    const treatment = treatments.find(t => t.id === data.treatmentId)
    await supabase.from('spa_bookings').insert({
      room: data.room, date, time: data.time, duration: treatment?.duration || 60,
      guest_name: data.guest, treatment: treatment?.name || 'Behandlung',
      price: treatment?.price || 0,
    })
    setShowBook(null); load()
  }

  const cancelBooking = (booking) => {
    setConfirm({
      title: 'Buchung stornieren', message: `Spa-Buchung von ${booking.guest_name} (${booking.treatment}) stornieren?`,
      warning: null, confirmLabel: 'Stornieren', confirmColor: '#ef4444',
      onConfirm: async () => { await supabase.from('spa_bookings').delete().eq('id', booking.id); setConfirm(null); load() },
    })
  }

  const todayStats = {
    total: displayBookings.length,
    revenue: displayBookings.reduce((s, b) => s + (b.price || treatments.find(t => t.name === b.treatment)?.price || 0), 0),
  }

  const grouped = treatments.reduce((a, t) => { const cat = t.category || 'sonstige'; a[cat] = a[cat] || []; a[cat].push(t); return a }, {})

  return (
    <div style={s.content}>
      <div style={s.header}>
        <h1 style={s.h1}>Spa</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={s.dateInput} />
        </div>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statBox}><div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>{todayStats.total}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Buchungen heute</div></div>
        <div style={s.statBox}><div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>{todayStats.revenue}€</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Umsatz heute</div></div>
        <div style={s.statBox}><div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>{treatments.length || 10}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Behandlungen</div></div>
      </div>

      {/* Day Calendar */}
      {loading ? <div className="pulse" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</div> : (
        <div style={s.calWrap}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 700 }}>
              {/* Header */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ width: 60, padding: '10px 8px', fontSize: 10, color: 'var(--text-dim)' }}>Zeit</div>
                {ROOMS.map(r => (
                  <div key={r.id} style={{ flex: 1, padding: '10px 8px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>{r.name}</div>
                ))}
              </div>
              {/* Time Rows */}
              {TIME_SLOTS.map(time => (
                <div key={time} style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 60, padding: '8px', fontSize: 10, color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>{time}</div>
                  {ROOMS.map(room => {
                    const booking = getBookingForSlot(room.id, time)
                    const isStart = isBookingStart(room.id, time)
                    return (
                      <div key={room.id} style={{ flex: 1, minHeight: 36, borderLeft: '1px solid var(--border)', padding: '2px 4px', cursor: !booking ? 'pointer' : 'default', background: !booking ? 'transparent' : 'transparent' }}
                        onClick={() => { if (!booking) setShowBook({ room: room.id, time }) }}>
                        {isStart && (
                          <div onClick={e => { e.stopPropagation(); cancelBooking(booking) }}
                            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                            <div style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 500 }}>{booking.treatment}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{booking.guest_name} · {booking.duration || 60}min</div>
                          </div>
                        )}
                        {!booking && <div style={{ width: '100%', height: '100%', minHeight: 32, borderRadius: 4 }} />}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Treatment Catalog */}
      <div style={{ ...s.card, marginTop: 16 }}>
        <div style={s.cardHead}><span style={s.cardTitle}>Behandlungskatalog</span><span style={s.cardCount}>{treatments.length || 10}</span></div>
        {(Object.keys(grouped).length > 0 ? Object.entries(grouped) : [
          ['massage', [{ name: 'Thai Massage', duration: 60, price: 89 }, { name: 'Schwedische Massage', duration: 60, price: 79 }, { name: 'Hot Stone Massage', duration: 75, price: 99 }, { name: 'Rückenmassage', duration: 30, price: 49 }]],
          ['gesicht', [{ name: 'Gesichtsbehandlung Classic', duration: 60, price: 75 }, { name: 'Anti-Aging Facial', duration: 75, price: 95 }]],
          ['beauty', [{ name: 'Maniküre', duration: 45, price: 45 }, { name: 'Pediküre', duration: 45, price: 49 }]],
          ['wellness', [{ name: 'Sauna & Relax Package', duration: 120, price: 59 }, { name: 'Day Spa Komplett', duration: 180, price: 149 }]],
        ]).map(([cat, items]) => (
          <div key={cat}>
            <div style={{ padding: '8px 16px', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, background: 'rgba(255,255,255,0.02)' }}>
              {CAT_LABELS[cat] || cat}
            </div>
            {items.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#ccc', flex: 1 }}>{t.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.duration} Min.</span>
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{t.price}€</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Add Booking Modal */}
      {showBook && (
        <div style={s.overlay} onClick={() => setShowBook(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <BookingForm
              room={showBook.room} time={showBook.time}
              treatments={treatments.length > 0 ? treatments : [
                { id: 'd1', name: 'Thai Massage', duration: 60, price: 89 }, { id: 'd2', name: 'Schwedische Massage', duration: 60, price: 79 },
                { id: 'd3', name: 'Hot Stone Massage', duration: 75, price: 99 }, { id: 'd4', name: 'Rückenmassage', duration: 30, price: 49 },
                { id: 'd5', name: 'Gesichtsbehandlung Classic', duration: 60, price: 75 }, { id: 'd6', name: 'Anti-Aging Facial', duration: 75, price: 95 },
                { id: 'd7', name: 'Maniküre', duration: 45, price: 45 }, { id: 'd8', name: 'Pediküre', duration: 45, price: 49 },
                { id: 'd9', name: 'Sauna & Relax Package', duration: 120, price: 59 }, { id: 'd10', name: 'Day Spa Komplett', duration: 180, price: 149 },
              ]}
              onSave={addBooking} onCancel={() => setShowBook(null)}
            />
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
    </div>
  )
}

function BookingForm({ room, time, treatments, onSave, onCancel }) {
  const [guest, setGuest] = useState(''); const [treatmentId, setTreatmentId] = useState(treatments[0]?.id || '')
  const roomName = ROOMS.find(r => r.id === room)?.name || room
  return (
    <>
      <h3 style={{ fontSize: 16, color: '#fff', margin: '0 0 4px', fontWeight: 500 }}>Neue Spa-Buchung</h3>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px' }}>{roomName} · {time}</p>
      <label style={s.label}>Gastname</label><input style={s.input} placeholder="Name" value={guest} onChange={e => setGuest(e.target.value)} />
      <label style={s.label}>Behandlung</label>
      <select style={s.input} value={treatmentId} onChange={e => setTreatmentId(e.target.value)}>
        {treatments.map(t => <option key={t.id} value={t.id}>{t.name} — {t.duration}min — {t.price}€</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={s.cancelBtn} onClick={onCancel}>Abbrechen</button>
        <button style={{ ...s.saveBtn, opacity: !guest ? 0.4 : 1 }} disabled={!guest} onClick={() => onSave({ room, time, guest, treatmentId })}>Buchen</button>
      </div>
    </>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  h1: { fontSize: 22, fontWeight: 500, color: '#fff', margin: 0 },
  dateInput: { padding: '7px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 12, color: '#fff', outline: 'none', colorScheme: 'dark' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 },
  statBox: { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: 16, textAlign: 'center' },
  calWrap: { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, overflow: 'hidden' },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, overflow: 'hidden' },
  cardHead: { padding: '14px 16px', borderBottom: '1px solid #141414', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 12, fontWeight: 500, color: '#fff' }, cardCount: { fontSize: 10, color: 'var(--text-muted)', background: '#141414', padding: '2px 8px', borderRadius: 10 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  modal: { background: '#111', border: '1px solid #222', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 400 },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 16, fontFamily: 'inherit' },
  cancelBtn: { flex: 1, padding: '10px', background: '#1a1a1a', border: '1px solid #222', borderRadius: 8, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { flex: 1, padding: '10px', background: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#080808', cursor: 'pointer', fontFamily: 'inherit' },
}
