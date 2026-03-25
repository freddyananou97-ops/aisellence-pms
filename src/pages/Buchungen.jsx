import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'
import { loadInvoiceData, openInvoicePDF } from '../lib/invoice'
import ConfirmDialog from '../components/ConfirmDialog'

const STATUS_CONF = {
  reserved: { label: 'Reserviert', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  confirmed: { label: 'Bestätigt', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  checked_in: { label: 'Eingecheckt', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  checked_out: { label: 'Ausgecheckt', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
  cancelled: { label: 'Storniert', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
}

export default function Buchungen() {
  const [bookings, setBookings] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('liste')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [confirm, setConfirm] = useState(null)
  const [filter, setFilter] = useState('alle')
  const [calStart, setCalStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]
  })
  const [charges, setCharges] = useState([])
  const [signatureView, setSignatureView] = useState(null)
  const [checkoutPreview, setCheckoutPreview] = useState(null)
  const [checkoutItems, setCheckoutItems] = useState([])
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [newBooking, setNewBooking] = useState({ guest_name: '', guest_id: '', room: '', check_in: '', check_out: '', amount_due: '', source: 'Direkt', status: 'reserved', booking_id: '', breakfast_included: false, breakfast_persons: 1 })
  const [guests, setGuests] = useState([])
  const [guestSearch, setGuestSearch] = useState('')
  const [guestDropdown, setGuestDropdown] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    const [b, r, g] = await Promise.all([
      supabase.from('bookings').select('*').order('check_in', { ascending: true }),
      supabase.from('rooms').select('*').order('room_number', { ascending: true }),
      supabase.from('guests').select('*').order('last_name', { ascending: true }),
    ])
    setBookings(b.data || [])
    setRooms(r.data || [])
    setGuests(g.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const u = subscribeToTable('bookings', () => load())
    return () => u()
  }, [load])

  const nights = (ci, co) => Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000))

  const loadCharges = async (room) => {
    const [sr, mb] = await Promise.all([
      supabase.from('service_requests').select('*').eq('room', String(room)).eq('status', 'delivered').order('timestamp', { ascending: false }),
      supabase.from('minibar_consumption').select('*').eq('room', String(room)).order('created_at', { ascending: false }),
    ])
    const srCharges = (sr.data || []).map(r => ({ type: r.category === 'room_service' ? 'Room Service' : 'Housekeeping', details: r.request_details, amount: r.order_total || 0, date: r.timestamp, signature: r.image_url }))
    const mbCharges = (mb.data || []).map(r => ({ type: 'Minibar', details: `${r.quantity}x ${r.product_name}`, amount: r.total || 0, date: r.created_at, signature: null }))
    setCharges([...srCharges, ...mbCharges].sort((a, b) => new Date(b.date) - new Date(a.date)))
  }

  const selectBooking = (b) => {
    setSelected(b); setEditing(false); loadCharges(b.room)
  }

  // Status actions
  const doCheckIn = (booking) => {
    setConfirm({
      title: 'Gast einchecken',
      message: `${booking.guest_name} in Zimmer ${booking.room} einchecken?`,
      warning: booking.meldeschein_completed ? null : '⚠️ Meldeschein wurde noch nicht ausgefüllt. Bitte auf der Meldeschein-Seite starten.',
      confirmLabel: 'Einchecken', confirmColor: '#10b981',
      onConfirm: async () => {
        await supabase.from('bookings').update({ status: 'checked_in' }).eq('id', booking.id)
        setConfirm(null); setSelected(null); load()
      },
    })
  }

  const doCheckOut = async (booking) => {
    const ch = await loadInvoiceData(booking)
    const roomTotal = parseFloat(booking.amount_due) || 0
    const n = Math.max(1, Math.round((new Date(booking.check_out) - new Date(booking.check_in)) / 86400000))
    setCheckoutItems([
      { id: 'room', type: 'Übernachtung', details: `${n} Nächte · Zimmer ${booking.room}`, amount: roomTotal, locked: false },
      ...ch.map((c, i) => ({ id: `ch-${i}`, type: c.type, details: c.details, amount: c.amount, locked: false })),
    ])
    setCheckoutPreview(booking)
    setSelected(null)
    setNewItemLabel(''); setNewItemAmount('')
  }

  const updateCheckoutItem = (id, field, value) => {
    setCheckoutItems(prev => prev.map(item => item.id === id ? { ...item, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : item))
  }

  const removeCheckoutItem = (id) => {
    setCheckoutItems(prev => prev.filter(item => item.id !== id))
  }

  const addCheckoutItem = () => {
    if (!newItemLabel) return
    setCheckoutItems(prev => [...prev, { id: `new-${Date.now()}`, type: 'Sonstige', details: newItemLabel, amount: parseFloat(newItemAmount) || 0, locked: false }])
    setNewItemLabel(''); setNewItemAmount('')
  }

  const finalizeCheckout = async () => {
    await supabase.from('bookings').update({ status: 'checked_out' }).eq('id', checkoutPreview.id)
    const invoiceCharges = checkoutItems.filter(i => i.id !== 'room').map(i => ({ type: i.type, details: i.details, amount: i.amount, date: new Date().toISOString() }))
    openInvoicePDF({ ...checkoutPreview, amount_due: checkoutItems.find(i => i.id === 'room')?.amount || 0 }, invoiceCharges)
    setCheckoutPreview(null); setCheckoutItems([]); load()
  }

  const doCancel = (booking) => {
    setConfirm({
      title: 'Buchung stornieren',
      message: `Buchung von ${booking.guest_name} (Zi. ${booking.room}) wirklich stornieren?`,
      warning: 'Diese Aktion kann nicht rückgängig gemacht werden.',
      confirmLabel: 'Stornieren', confirmColor: '#ef4444',
      onConfirm: async () => {
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
        setConfirm(null); setSelected(null); load()
      },
    })
  }

  const startEdit = (booking) => {
    setEditing(true)
    setEditData({ room: booking.room, check_in: booking.check_in, check_out: booking.check_out, guest_name: booking.guest_name, amount_due: booking.amount_due })
  }

  const saveEdit = async () => {
    await supabase.from('bookings').update(editData).eq('id', selected.id)
    setEditing(false); setSelected(null); load()
  }

  const createBooking = async () => {
    const id = `BK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
    const { guest_id, breakfast_persons, ...bookingData } = newBooking
    const nightCount = bookingData.check_in && bookingData.check_out ? Math.max(1, Math.ceil((new Date(bookingData.check_out) - new Date(bookingData.check_in)) / 86400000)) : 1
    await supabase.from('bookings').insert({ ...bookingData, booking_id: id, breakfast_persons: bookingData.breakfast_included ? breakfast_persons : null })
    // Add breakfast charge to room bill
    if (bookingData.breakfast_included) {
      const totalBreakfast = 18 * breakfast_persons * nightCount
      await supabase.from('service_requests').insert({
        room: bookingData.room, guest_name: bookingData.guest_name,
        category: 'breakfast', request_details: `Frühstück (${breakfast_persons} Pers. × ${nightCount} Nächte)`,
        status: 'resolved', order_total: totalBreakfast, resolved_at: new Date().toISOString(),
      })
    }
    // Update guest total_stays
    if (guest_id) {
      const guest = guests.find(g => g.id === guest_id)
      if (guest) await supabase.from('guests').update({ total_stays: (guest.total_stays || 0) + 1 }).eq('id', guest_id)
    }
    setShowNewBooking(false)
    setNewBooking({ guest_name: '', guest_id: '', room: '', check_in: '', check_out: '', amount_due: '', source: 'Direkt', status: 'reserved', booking_id: '', breakfast_included: false, breakfast_persons: 1 })
    setGuestSearch('')
    load()
  }

  // Filtering
  const filtered = filter === 'alle' ? bookings : bookings.filter(b => b.status === filter)
  const statusCounts = Object.keys(STATUS_CONF).reduce((a, k) => { a[k] = bookings.filter(b => b.status === k).length; return a }, {})

  // Calendar
  const calDays = 14
  const calDates = Array.from({ length: calDays }, (_, i) => {
    const d = new Date(calStart); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]
  })
  const calRooms = rooms.map(r => String(r.room_number)).sort()

  const getBookingForCell = (room, date) => {
    return bookings.find(b => String(b.room) === room && b.check_in <= date && b.check_out > date && b.status !== 'cancelled')
  }

  const getBookingStart = (booking, date) => booking.check_in === date

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={s.content}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={s.h1}>Buchungen</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted)', marginTop: -12 }}>{bookings.length} Buchungen · {bookings.filter(b => b.status === 'checked_in').length} eingecheckt</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setShowNewBooking(true); setGuestSearch(''); setGuestDropdown(false) }} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#10b981', color: '#fff', border: 'none' }}>+ Neue Buchung</button>
          {[['liste', 'Liste'], ['kalender', 'Kalender']].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              background: view === k ? 'var(--text)' : 'var(--bgCard)', color: view === k ? 'var(--bg)' : 'var(--textMuted)',
              border: `1px solid ${view === k ? 'var(--text)' : 'var(--borderLight)'}`,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* LIST VIEW */}
      {view === 'liste' && <>
        {/* Status filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setFilter('alle')} style={{ ...s.filterBtn, background: filter === 'alle' ? 'var(--text)' : 'var(--bgCard)', color: filter === 'alle' ? 'var(--bg)' : 'var(--textMuted)', border: `1px solid ${filter === 'alle' ? 'var(--text)' : 'var(--borderLight)'}` }}>Alle {bookings.length}</button>
          {Object.entries(STATUS_CONF).map(([k, v]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ ...s.filterBtn, background: filter === k ? v.bg : 'var(--bgCard)', color: filter === k ? v.color : 'var(--textMuted)', border: `1px solid ${filter === k ? v.color : 'var(--borderLight)'}` }}>
              {v.label} {statusCounts[k] || 0}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={s.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 60px 80px 100px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
            {['Gast', 'Zimmer', 'Check-in', 'Check-out', 'Nächte', 'Betrag', 'Status'].map(h => (
              <span key={h} style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>{h}</span>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Buchungen</div>
          ) : filtered.map(b => {
            const sc = STATUS_CONF[b.status] || STATUS_CONF.reserved
            return (
              <div key={b.id} onClick={() => selectBooking(b)} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 60px 80px 100px', padding: '12px 16px',
                borderBottom: '1px solid var(--border)', gap: 8, cursor: 'pointer',
                background: selected?.id === b.id ? 'var(--active)' : b.check_in === todayStr ? 'rgba(59,130,246,0.03)' : 'transparent',
              }}>
                <div>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{b.guest_name}</span>
                  {b.source && <span style={{ fontSize: 9, color: 'var(--textDim)', marginLeft: 6 }}>{b.source}</span>}
                </div>
                <span style={{ fontSize: 12, color: 'var(--textSec)' }}>{b.room}</span>
                <span style={{ fontSize: 12, color: b.check_in === todayStr ? '#3b82f6' : 'var(--textSec)' }}>{b.check_in}</span>
                <span style={{ fontSize: 12, color: b.check_out === todayStr ? '#f59e0b' : 'var(--textSec)' }}>{b.check_out}</span>
                <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{nights(b.check_in, b.check_out)}</span>
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{parseFloat(b.amount_due || 0).toFixed(0)}€</span>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: sc.bg, color: sc.color, fontWeight: 500, textAlign: 'center' }}>{sc.label}</span>
              </div>
            )
          })}
        </div>
      </>}

      {/* CALENDAR VIEW */}
      {view === 'kalender' && <>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <button onClick={() => { const d = new Date(calStart); d.setDate(d.getDate() - 7); setCalStart(d.toISOString().split('T')[0]) }} style={s.navBtn}>← Woche</button>
          <button onClick={() => setCalStart(new Date().toISOString().split('T')[0])} style={s.navBtn}>Heute</button>
          <button onClick={() => { const d = new Date(calStart); d.setDate(d.getDate() + 7); setCalStart(d.toISOString().split('T')[0]) }} style={s.navBtn}>Woche →</button>
          <span style={{ fontSize: 11, color: 'var(--textMuted)', marginLeft: 8 }}>{new Date(calStart).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
        </div>

        <div style={{ ...s.card, overflow: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: `70px repeat(${calDays}, minmax(60px, 1fr))`, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bgCard)', zIndex: 2 }}>
            <div style={{ padding: '10px 8px', fontSize: 10, color: 'var(--textDim)', fontWeight: 500 }}>Zimmer</div>
            {calDates.map(d => {
              const dt = new Date(d)
              const isToday = d === todayStr
              return (
                <div key={d} style={{ padding: '6px 4px', textAlign: 'center', background: isToday ? 'rgba(59,130,246,0.06)' : 'transparent', borderLeft: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, color: isToday ? '#3b82f6' : 'var(--textDim)' }}>{dt.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
                  <div style={{ fontSize: 13, color: isToday ? '#3b82f6' : 'var(--textSec)', fontWeight: isToday ? 600 : 400 }}>{dt.getDate()}</div>
                </div>
              )
            })}
          </div>

          {/* Rows */}
          {calRooms.map(room => (
            <div key={room} style={{ display: 'grid', gridTemplateColumns: `70px repeat(${calDays}, minmax(60px, 1fr))`, borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '10px 8px', fontSize: 12, color: 'var(--text)', fontWeight: 500, borderRight: '1px solid var(--border)' }}>{room}</div>
              {calDates.map(date => {
                const booking = getBookingForCell(room, date)
                const isStart = booking && booking.check_in === date
                const sc = booking ? (STATUS_CONF[booking.status] || STATUS_CONF.reserved) : null
                const isToday = date === todayStr
                return (
                  <div key={date} onClick={() => booking && selectBooking(booking)} style={{
                    padding: '4px 2px', borderLeft: '1px solid var(--border)', minHeight: 36,
                    background: isToday ? 'rgba(59,130,246,0.03)' : 'transparent', cursor: booking ? 'pointer' : 'default',
                  }}>
                    {booking && (
                      <div style={{
                        background: sc.bg, borderLeft: isStart ? `3px solid ${sc.color}` : 'none',
                        borderRadius: isStart ? '4px 0 0 4px' : 0, padding: '4px 6px', height: '100%',
                        display: 'flex', alignItems: 'center',
                      }}>
                        {isStart && <span style={{ fontSize: 9, color: sc.color, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{booking.guest_name}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
          {Object.entries(STATUS_CONF).filter(([k]) => k !== 'cancelled').map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: v.bg, border: `2px solid ${v.color}` }} />
              <span style={{ fontSize: 10, color: 'var(--textMuted)' }}>{v.label}</span>
            </div>
          ))}
        </div>
      </>}

      {/* DETAIL PANEL */}
      {selected && (
        <div style={s.overlay} onClick={() => { setSelected(null); setEditing(false) }}>
          <div style={{ ...s.modal, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Buchung {selected.booking_id}</h3>
              <button onClick={() => { setSelected(null); setEditing(false) }} style={s.closeBtn}>✕</button>
            </div>

            {/* Status Badge */}
            {(() => { const sc = STATUS_CONF[selected.status] || STATUS_CONF.reserved; return (
              <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 8, background: sc.bg, color: sc.color, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{sc.label}</div>
            ) })()}

            {!editing ? <>
              {/* Detail rows */}
              {[
                ['Gast', selected.guest_name],
                ['Zimmer', selected.room],
                ['Check-in', selected.check_in],
                ['Check-out', selected.check_out],
                ['Nächte', nights(selected.check_in, selected.check_out)],
                ['Betrag', `${parseFloat(selected.amount_due || 0).toFixed(2)}€`],
                ['Quelle', selected.source || 'Direkt'],
                ['Buchungs-ID', selected.booking_id || '-'],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{l}</span>
                  <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: l === 'Betrag' ? 600 : 400 }}>{v}</span>
                </div>
              ))}

              {/* Frühstück Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>Frühstück</span>
                <span style={{ fontSize: 12, color: selected.breakfast_included ? '#10b981' : 'var(--textDim)', fontWeight: 500 }}>
                  {selected.breakfast_included ? `✓ Inklusive (${selected.breakfast_price || 18}€/Pers.)` : 'Nicht gebucht'}
                </span>
              </div>

              {/* Meldeschein Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>Meldeschein</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: selected.meldeschein_completed ? '#10b981' : selected.meldeschein_active ? '#f59e0b' : 'var(--textDim)' }}>
                  {selected.meldeschein_completed
                    ? (selected.meldeschein_vorab ? '✓ Vorab erhalten' : '✓ Ausgefüllt')
                    : selected.meldeschein_active ? 'Gast füllt aus...' : 'Ausstehend'}
                </span>
              </div>

              {/* Pre Check-in Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>Pre Check-in</span>
                <span style={{ fontSize: 12, color: selected.pre_checkin_completed ? '#10b981' : 'var(--textDim)' }}>
                  {selected.pre_checkin_completed ? '✓ Abgeschlossen' : '— Nicht gestartet'}
                </span>
              </div>

              {/* Frühstück */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>Frühstück</span>
                <span style={{ fontSize: 12, color: selected.breakfast_included ? '#10b981' : 'var(--textDim)', fontWeight: 500 }}>
                  {selected.breakfast_included ? `✓ Inkl. (${selected.breakfast_persons || 1} Pers. · ${((selected.breakfast_persons || 1) * (selected.breakfast_price || 18)).toFixed(0)}€/Nacht)` : '— Nicht gebucht'}
                </span>
              </div>

              {/* Zimmerbelastungen */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Zimmerbelastungen</div>
                {charges.length === 0 ? (
                  <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--textDim)', textAlign: 'center' }}>Keine Belastungen</div>
                ) : <>
                  {charges.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: c.type === 'Room Service' ? 'rgba(245,158,11,0.08)' : c.type === 'Minibar' ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)', color: c.type === 'Room Service' ? '#f59e0b' : c.type === 'Minibar' ? '#8b5cf6' : '#3b82f6' }}>{c.type}</span>
                          <span style={{ fontSize: 11, color: 'var(--textSec)' }}>{c.details}</span>
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--textDim)', marginTop: 2 }}>{c.date ? new Date(c.date).toLocaleDateString('de-DE') + ' · ' + new Date(c.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                      </div>
                      {c.amount > 0 && <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{parseFloat(c.amount).toFixed(2)}€</span>}
                      {c.signature && <button onClick={() => setSignatureView(c.signature)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.08)', color: '#10b981', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Unterschrift</button>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 600 }}>
                    <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>Gesamt Belastungen</span>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{charges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0).toFixed(2)}€</span>
                  </div>
                </>}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(selected.status === 'reserved' || selected.status === 'confirmed') && (
                  <button onClick={() => doCheckIn(selected)} style={{ ...s.actionBtn, background: '#10b981', color: '#fff', border: 'none' }}>
                    Gast einchecken
                  </button>
                )}
                {selected.status === 'checked_in' && (
                  <button onClick={() => doCheckOut(selected)} style={{ ...s.actionBtn, background: '#f59e0b', color: '#000', border: 'none' }}>
                    Auschecken & Rechnung prüfen
                  </button>
                )}
                <button onClick={() => startEdit(selected)} style={s.actionBtn}>
                  Buchung bearbeiten
                </button>
                {selected.status !== 'cancelled' && selected.status !== 'checked_out' && (
                  <button onClick={() => doCancel(selected)} style={{ ...s.actionBtn, color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                    Stornieren
                  </button>
                )}
              </div>
            </> : <>
              {/* EDIT MODE */}
              <div style={{ marginBottom: 8 }}>
                <label style={s.label}>Gastname</label>
                <input style={s.input} value={editData.guest_name || ''} onChange={e => setEditData(p => ({ ...p, guest_name: e.target.value }))} />

                <label style={s.label}>Zimmer</label>
                <select style={s.input} value={editData.room || ''} onChange={e => setEditData(p => ({ ...p, room: e.target.value }))}>
                  {rooms.map(r => <option key={r.room_number} value={r.room_number}>{r.room_number} — {r.type}</option>)}
                </select>

                <label style={s.label}>Check-in</label>
                <input style={s.input} type="date" value={editData.check_in || ''} onChange={e => setEditData(p => ({ ...p, check_in: e.target.value }))} />

                <label style={s.label}>Check-out</label>
                <input style={s.input} type="date" value={editData.check_out || ''} onChange={e => setEditData(p => ({ ...p, check_out: e.target.value }))} />

                <label style={s.label}>Betrag (€)</label>
                <input style={s.input} type="number" value={editData.amount_due || ''} onChange={e => setEditData(p => ({ ...p, amount_due: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button onClick={saveEdit} style={{ flex: 1, padding: 12, background: '#10b981', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Speichern</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* Signature Viewer */}
      {signatureView && (
        <div style={s.overlay} onClick={() => setSignatureView(null)}>
          <div style={{ ...s.modal, maxWidth: 440, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 16px' }}>Unterschrift</h3>
            <div style={{ border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: 'var(--bg)' }}>
              <img src={signatureView} alt="Unterschrift" style={{ width: '100%', height: 180, objectFit: 'contain' }} />
            </div>
            <button onClick={() => setSignatureView(null)} style={{ width: '100%', padding: 12, background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Schließen</button>
          </div>
        </div>
      )}

      {/* New Booking Modal */}
      {showNewBooking && (
        <div style={s.overlay} onClick={() => setShowNewBooking(false)}>
          <div style={{ ...s.modal, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Neue Buchung</h3>
              <button onClick={() => setShowNewBooking(false)} style={s.closeBtn}>✕</button>
            </div>

            <label style={s.label}>Gast auswählen</label>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input style={{ ...s.input, marginBottom: 0 }} placeholder="Name eingeben..." value={guestSearch}
                onChange={e => { setGuestSearch(e.target.value); setGuestDropdown(true); setNewBooking(p => ({ ...p, guest_name: '', guest_id: '' })) }}
                onFocus={() => setGuestDropdown(true)} />
              {newBooking.guest_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', marginTop: 4, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6 }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>{newBooking.guest_name}</span>
                  <button onClick={() => { setNewBooking(p => ({ ...p, guest_name: '', guest_id: '' })); setGuestSearch('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--textDim)', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              )}
              {guestDropdown && guestSearch && !newBooking.guest_name && (() => {
                const q = guestSearch.toLowerCase()
                const matches = guests.filter(g => `${g.first_name} ${g.last_name}`.toLowerCase().includes(q) || g.email?.toLowerCase().includes(q) || g.phone?.includes(q)).slice(0, 6)
                return matches.length > 0 ? (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 2, background: 'var(--modalBg, #111)', border: '1px solid var(--borderLight)', borderRadius: 8, overflow: 'hidden', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    {matches.map(g => (
                      <div key={g.id} onClick={() => {
                        setNewBooking(p => ({ ...p, guest_name: `${g.first_name} ${g.last_name}`, guest_id: g.id }))
                        setGuestSearch(`${g.first_name} ${g.last_name}`)
                        setGuestDropdown(false)
                      }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bgCard)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{g.first_name} {g.last_name}
                            {g.vip && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', marginLeft: 6 }}>VIP</span>}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--textDim)' }}>{g.email || g.phone || ''}</div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>{g.total_stays || 0}x Aufenthalte</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 2, background: 'var(--modalBg, #111)', border: '1px solid var(--borderLight)', borderRadius: 8, padding: '12px 14px', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    <div style={{ fontSize: 11, color: 'var(--textDim)', textAlign: 'center' }}>Kein Gast gefunden — bitte zuerst im Gäste-Modul anlegen</div>
                  </div>
                )
              })()}
            </div>

            <label style={s.label}>Zimmer</label>
            <select style={s.input} value={newBooking.room} onChange={e => setNewBooking(p => ({ ...p, room: e.target.value }))}>
              <option value="">Zimmer wählen...</option>
              {rooms.map(r => <option key={r.room_number} value={r.room_number}>{r.room_number} — {r.type}</option>)}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={s.label}>Check-in</label><input style={s.input} type="date" value={newBooking.check_in} onChange={e => setNewBooking(p => ({ ...p, check_in: e.target.value }))} /></div>
              <div><label style={s.label}>Check-out</label><input style={s.input} type="date" value={newBooking.check_out} onChange={e => setNewBooking(p => ({ ...p, check_out: e.target.value }))} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={s.label}>Betrag (€)</label><input style={s.input} type="number" placeholder="0" value={newBooking.amount_due} onChange={e => setNewBooking(p => ({ ...p, amount_due: e.target.value }))} /></div>
              <div><label style={s.label}>Quelle</label><select style={s.input} value={newBooking.source} onChange={e => setNewBooking(p => ({ ...p, source: e.target.value }))}>
                <option value="Direkt">Direkt (Walk-in)</option><option value="Telefon">Telefon</option><option value="Booking.com">Booking.com</option><option value="Expedia">Expedia</option><option value="E-Mail">E-Mail</option>
              </select></div>
            </div>

            {/* Breakfast toggle */}
            <div style={{ padding: '12px 14px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setNewBooking(p => ({ ...p, breakfast_included: !p.breakfast_included }))} style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative',
                  background: newBooking.breakfast_included ? '#10b981' : '#333', transition: '0.2s',
                }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 3, left: newBooking.breakfast_included ? 21 : 3, transition: '0.2s' }} />
                </button>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>Frühstück inklusive</div>
                  <div style={{ fontSize: 10, color: 'var(--textDim)' }}>18€ pro Person / Nacht</div>
                </div>
              </div>

              {newBooking.breakfast_included && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--borderLight)' }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Personenanzahl</label>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {[1, 2, 3, 4].map(n => (
                      <button key={n} onClick={() => setNewBooking(p => ({ ...p, breakfast_persons: n }))} style={{
                        flex: 1, padding: '8px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, textAlign: 'center',
                        background: newBooking.breakfast_persons === n ? 'rgba(16,185,129,0.1)' : 'transparent',
                        color: newBooking.breakfast_persons === n ? '#10b981' : 'var(--textMuted)',
                        border: `2px solid ${newBooking.breakfast_persons === n ? '#10b981' : 'var(--borderLight)'}`,
                      }}>{n}</button>
                    ))}
                  </div>
                  {newBooking.check_in && newBooking.check_out && (() => {
                    const nightCount = Math.max(1, Math.ceil((new Date(newBooking.check_out) - new Date(newBooking.check_in)) / 86400000))
                    const total = 18 * newBooking.breakfast_persons * nightCount
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(16,185,129,0.04)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.1)' }}>
                        <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{newBooking.breakfast_persons} Pers. × {nightCount} Nächte × 18€</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>{total.toFixed(2)} €</span>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            <label style={s.label}>Status</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[['reserved', 'Reserviert'], ['confirmed', 'Bestätigt'], ['checked_in', 'Sofort einchecken']].map(([k, l]) => (
                <button key={k} onClick={() => setNewBooking(p => ({ ...p, status: k }))} style={{
                  flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                  background: newBooking.status === k ? (k === 'checked_in' ? 'rgba(16,185,129,0.1)' : 'var(--text)') : 'var(--bgCard)',
                  color: newBooking.status === k ? (k === 'checked_in' ? '#10b981' : 'var(--bg)') : 'var(--textMuted)',
                  border: `1px solid ${newBooking.status === k ? (k === 'checked_in' ? '#10b981' : 'var(--text)') : 'var(--borderLight)'}`,
                }}>{l}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNewBooking(false)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={createBooking} disabled={!newBooking.guest_name || !newBooking.room || !newBooking.check_in || !newBooking.check_out} style={{ flex: 1, padding: 12, background: newBooking.guest_name && newBooking.room ? '#10b981' : 'var(--bgCard)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: newBooking.guest_name && newBooking.room ? '#fff' : 'var(--textDim)', cursor: newBooking.guest_name && newBooking.room ? 'pointer' : 'default', fontFamily: 'inherit' }}>Buchung anlegen</button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Invoice Preview */}
      {checkoutPreview && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 540, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Rechnungsvorschau</h3>
                <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{checkoutPreview.guest_name} · Zimmer {checkoutPreview.room}</span>
              </div>
              <button onClick={() => setCheckoutPreview(null)} style={s.closeBtn}>✕</button>
            </div>

            <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 11, color: '#f59e0b' }}>
              Bitte prüfen Sie alle Positionen. Sie können Beträge ändern, Positionen löschen oder neue hinzufügen.
            </div>

            {/* Items */}
            {checkoutItems.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, marginRight: 6, background: item.id === 'room' ? 'rgba(16,185,129,0.08)' : item.type === 'Room Service' ? 'rgba(245,158,11,0.08)' : item.type === 'Minibar' ? 'rgba(139,92,246,0.08)' : 'rgba(107,114,128,0.08)', color: item.id === 'room' ? '#10b981' : item.type === 'Room Service' ? '#f59e0b' : item.type === 'Minibar' ? '#8b5cf6' : '#6b7280' }}>{item.type}</span>
                  <input value={item.details} onChange={e => updateCheckoutItem(item.id, 'details', e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--textSec)', fontFamily: 'inherit', width: '100%', marginTop: 4, display: 'block' }} />
                </div>
                <input type="number" value={item.amount} onChange={e => updateCheckoutItem(item.id, 'amount', e.target.value)} style={{ width: 80, padding: '6px 8px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 13, color: 'var(--text)', fontWeight: 500, textAlign: 'right', outline: 'none', fontFamily: 'inherit' }} />
                <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>€</span>
                <button onClick={() => removeCheckoutItem(item.id)} style={{ width: 24, height: 24, borderRadius: 4, background: 'rgba(239,68,68,0.08)', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}

            {/* Add new item */}
            <div style={{ display: 'flex', gap: 6, padding: '10px 0', alignItems: 'center' }}>
              <input value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)} placeholder="Neue Position..." style={{ flex: 1, padding: '8px 10px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
              <input type="number" value={newItemAmount} onChange={e => setNewItemAmount(e.target.value)} placeholder="0" style={{ width: 70, padding: '8px 10px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 12, color: 'var(--text)', textAlign: 'right', outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>€</span>
              <button onClick={addCheckoutItem} disabled={!newItemLabel} style={{ padding: '8px 12px', background: newItemLabel ? 'rgba(16,185,129,0.1)' : 'transparent', border: `1px solid ${newItemLabel ? 'rgba(16,185,129,0.2)' : 'var(--borderLight)'}`, borderRadius: 6, fontSize: 11, color: newItemLabel ? '#10b981' : 'var(--textDim)', cursor: newItemLabel ? 'pointer' : 'default', fontFamily: 'inherit' }}>+</button>
            </div>

            {/* Totals */}
            {(() => {
              const grand = checkoutItems.reduce((s, i) => s + i.amount, 0)
              return <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid var(--border)', marginTop: 4, fontWeight: 600 }}>
                  <span style={{ fontSize: 14, color: 'var(--text)' }}>Gesamtbetrag</span>
                  <span style={{ fontSize: 18, color: '#10b981' }}>{grand.toFixed(2)}€</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--textDim)' }}>
                  <span>Netto (7% MwSt)</span><span>{(grand / 1.07).toFixed(2)}€</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--textDim)', marginBottom: 16 }}>
                  <span>MwSt 7%</span><span>{(grand - grand / 1.07).toFixed(2)}€</span>
                </div>
              </>
            })()}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCheckoutPreview(null)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={finalizeCheckout} style={{ flex: 2, padding: 12, background: '#f59e0b', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#000', cursor: 'pointer', fontFamily: 'inherit' }}>Rechnung erstellen & Gast auschecken</button>
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
    </div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 1400 },
  h1: { fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '0 0 16px', letterSpacing: -0.5 },
  card: { background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' },
  filterBtn: { padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  navBtn: { padding: '6px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textMuted)' },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440 },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionBtn: { width: '100%', padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 13, color: 'var(--textSec)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, textAlign: 'center' },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '10px 14px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 14, fontFamily: 'inherit' },
}
