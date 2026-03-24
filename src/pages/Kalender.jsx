import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'

export default function Kalender() {
  const [bookings, setBookings] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)

  const load = useCallback(async () => {
    const [b, r] = await Promise.all([
      supabase.from('bookings').select('*').neq('status', 'cancelled'),
      supabase.from('rooms').select('*').order('room_number', { ascending: true }),
    ])
    setBookings(b.data || [])
    setRooms(r.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const unsub = subscribeToTable('bookings', () => load())
    return unsub
  }, [load])

  // Generate 14 days starting from Monday of current week + offset
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  // Demo rooms
  const displayRooms = rooms.length > 0 ? rooms : Array.from({ length: 15 }, (_, i) => ({
    id: `r-${i}`, room_number: String(101 + i),
    room_type: i < 5 ? 'Standard EZ' : i < 11 ? 'Comfort DZ' : i < 14 ? 'Superior DZ' : 'Suite',
  }))

  // Demo bookings
  const displayBookings = bookings.length > 0 ? bookings : [
    { room: '101', guest_name: 'Müller', check_in: fmt(days[0]), check_out: fmt(days[3]), status: 'checked_in' },
    { room: '103', guest_name: 'Schmidt', check_in: fmt(days[1]), check_out: fmt(days[5]), status: 'reserved' },
    { room: '105', guest_name: 'Weber', check_in: fmt(days[2]), check_out: fmt(days[4]), status: 'confirmed' },
    { room: '107', guest_name: 'Fischer', check_in: fmt(days[4]), check_out: fmt(days[8]), status: 'reserved' },
    { room: '109', guest_name: 'Braun', check_in: fmt(days[0]), check_out: fmt(days[7]), status: 'checked_in' },
    { room: '111', guest_name: 'Keller', check_in: fmt(days[6]), check_out: fmt(days[10]), status: 'reserved' },
    { room: '113', guest_name: 'VIP Wagner', check_in: fmt(days[3]), check_out: fmt(days[6]), status: 'confirmed' },
    { room: '115', guest_name: 'Audi AG', check_in: fmt(days[1]), check_out: fmt(days[13]), status: 'checked_in' },
  ]

  const todayStr = fmt(today)
  const COLORS = { checked_in: '#10b981', reserved: '#3b82f6', confirmed: '#8b5cf6' }

  return (
    <div style={s.content}>
      <div style={s.header}>
        <h1 style={s.h1}>Reservierungskalender</h1>
        <div style={s.navBtns}>
          <button style={s.navBtn} onClick={() => setWeekOffset(w => w - 1)}>← Zurück</button>
          <button style={s.navBtn} onClick={() => setWeekOffset(0)}>Heute</button>
          <button style={s.navBtn} onClick={() => setWeekOffset(w => w + 1)}>Vor →</button>
        </div>
      </div>

      {loading ? (
        <div className="pulse" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</div>
      ) : (
        <div style={s.calWrap}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 900 }}>
              {/* Header Row */}
              <div style={s.calHeader}>
                <div style={s.roomCol}>Zimmer</div>
                {days.map((d, i) => {
                  const isToday = fmt(d) === todayStr
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <div key={i} style={{ ...s.dayCol, background: isToday ? 'rgba(59,130,246,0.08)' : isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <div style={{ fontSize: 9, color: isToday ? '#3b82f6' : 'var(--text-dim)' }}>
                        {d.toLocaleDateString('de-DE', { weekday: 'short' })}
                      </div>
                      <div style={{ fontSize: 12, color: isToday ? '#fff' : 'var(--text-muted)', fontWeight: isToday ? 600 : 400 }}>
                        {d.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Room Rows */}
              {displayRooms.map(room => {
                const roomBookings = displayBookings.filter(b => b.room === room.room_number)
                return (
                  <div key={room.id} style={s.calRow}>
                    <div style={s.roomCol}>
                      <div style={{ fontSize: 12, color: '#ccc', fontWeight: 500 }}>{room.room_number}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{room.room_type}</div>
                    </div>
                    <div style={s.dayGrid}>
                      {days.map((d, i) => {
                        const dStr = fmt(d)
                        const booking = roomBookings.find(b => b.check_in <= dStr && b.check_out > dStr)
                        const isStart = booking && booking.check_in === dStr
                        const isEnd = booking && fmt(new Date(new Date(booking.check_out).getTime() - 86400000)) === dStr
                        const isToday = dStr === todayStr
                        return (
                          <div key={i} style={{
                            ...s.dayCell,
                            background: isToday ? 'rgba(59,130,246,0.04)' : 'transparent',
                            borderRight: '1px solid var(--border)',
                          }}>
                            {booking && (
                              <div style={{
                                background: COLORS[booking.status] || '#3b82f6',
                                height: 24,
                                borderRadius: isStart && isEnd ? 4 : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : 0,
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: isStart ? 6 : 0,
                                overflow: 'hidden',
                              }}>
                                {isStart && (
                                  <span style={{ fontSize: 9, color: '#fff', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                    {booking.guest_name}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={s.legend}>
            <LegendItem color="#10b981" label="Eingecheckt" />
            <LegendItem color="#3b82f6" label="Reserviert" />
            <LegendItem color="#8b5cf6" label="Bestätigt" />
          </div>
        </div>
      )}
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

function fmt(d) { return d.toISOString().split('T')[0] }

const s = {
  content: { padding: '28px 32px', maxWidth: 1400 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  h1: { fontSize: 22, fontWeight: 500, color: '#fff', margin: 0 },
  navBtns: { display: 'flex', gap: 6 },
  navBtn: { padding: '7px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' },
  calWrap: { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, overflow: 'hidden' },
  calHeader: { display: 'flex', borderBottom: '1px solid var(--border-light)' },
  roomCol: { width: 100, padding: '10px 12px', flexShrink: 0, borderRight: '1px solid var(--border-light)' },
  dayCol: { flex: 1, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid var(--border)' },
  calRow: { display: 'flex', borderBottom: '1px solid var(--border)' },
  dayGrid: { display: 'flex', flex: 1 },
  dayCell: { flex: 1, padding: '4px 0', minHeight: 32, display: 'flex', alignItems: 'center' },
  legend: { display: 'flex', gap: 16, padding: '12px 16px', borderTop: '1px solid var(--border-light)' },
}
