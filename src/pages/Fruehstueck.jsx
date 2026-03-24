import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'

const BREAKFAST_PRICE = 18 // Default price per person

export default function Fruehstueck() {
  const [bookings, setBookings] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('heute')
  const [spontaneousModal, setSpontaneousModal] = useState(null)
  const [spontaneousPersons, setSpontaneousPersons] = useState(1)
  const [selectedBooking, setSelectedBooking] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    const [b, l] = await Promise.all([
      supabase.from('bookings').select('*').in('status', ['checked_in', 'confirmed', 'reserved']).order('room', { ascending: true }),
      supabase.from('breakfast_log').select('*').eq('date', today).order('checked_at', { ascending: true }),
    ])
    setBookings(b.data || [])
    setLogs(l.data || [])
    setLoading(false)
  }, [today])

  useEffect(() => {
    load()
    const u1 = subscribeToTable('breakfast_log', () => load())
    const u2 = subscribeToTable('bookings', () => load())
    return () => { u1(); u2() }
  }, [load])

  const checkedIn = bookings.filter(b => b.status === 'checked_in')
  const withBreakfast = checkedIn.filter(b => b.breakfast_included)
  const withoutBreakfast = checkedIn.filter(b => !b.breakfast_included)

  const isChecked = (bookingId) => logs.some(l => l.booking_id === bookingId)
  const getLog = (bookingId) => logs.find(l => l.booking_id === bookingId)

  const checkedCount = withBreakfast.filter(b => isChecked(b.booking_id)).length
  const totalWithBreakfast = withBreakfast.length
  const spontaneousCount = logs.filter(l => l.spontaneous).length

  // Check in a room for breakfast
  const checkBreakfast = async (booking) => {
    if (isChecked(booking.booking_id)) return
    await supabase.from('breakfast_log').insert({
      booking_id: booking.booking_id,
      room_number: booking.room,
      guest_name: booking.guest_name,
      date: today,
      spontaneous: false,
      charge_amount: 0,
      persons: 1,
    })
    load()
  }

  // Undo check
  const uncheckBreakfast = async (booking) => {
    const log = getLog(booking.booking_id)
    if (!log) return
    await supabase.from('breakfast_log').delete().eq('id', log.id)
    load()
  }

  // Add spontaneous breakfast
  const addSpontaneous = async () => {
    if (!spontaneousModal) return
    const amount = BREAKFAST_PRICE * spontaneousPersons
    // Add to breakfast log
    await supabase.from('breakfast_log').insert({
      booking_id: spontaneousModal.booking_id,
      room_number: spontaneousModal.room,
      guest_name: spontaneousModal.guest_name,
      date: today,
      spontaneous: true,
      charge_amount: amount,
      persons: spontaneousPersons,
    })
    // Add charge to service_requests for the room bill
    await supabase.from('service_requests').insert({
      room: spontaneousModal.room,
      guest_name: spontaneousModal.guest_name,
      category: 'breakfast',
      request_details: `Frühstück (${spontaneousPersons} Pers.) — Spontan hinzugebucht`,
      status: 'resolved',
      order_total: amount,
      resolved_at: new Date().toISOString(),
    })
    setSpontaneousModal(null)
    setSpontaneousPersons(1)
    load()
  }

  // Toggle breakfast_included on booking
  const toggleBreakfastOnBooking = async (booking) => {
    await supabase.from('bookings').update({ breakfast_included: !booking.breakfast_included }).eq('id', booking.id)
    load()
  }

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={s.content}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={s.h1}>Frühstück</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted)', marginTop: -12 }}>
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={s.kpi}>
          <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Mit Frühstück</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{totalWithBreakfast}</div>
        </div>
        <div style={s.kpi}>
          <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Erschienen</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#10b981' }}>{checkedCount}</div>
        </div>
        <div style={s.kpi}>
          <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Offen</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#f59e0b' }}>{totalWithBreakfast - checkedCount}</div>
        </div>
        <div style={s.kpi}>
          <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Spontan</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#3b82f6' }}>{spontaneousCount}</div>
        </div>
      </div>

      {/* Progress bar */}
      {totalWithBreakfast > 0 && (
        <div style={{ background: 'var(--bgCard)', borderRadius: 8, height: 6, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(checkedCount / totalWithBreakfast) * 100}%`, background: '#10b981', borderRadius: 8, transition: 'width 0.3s' }} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['heute', `Inkl. Frühstück (${totalWithBreakfast})`], ['spontan', `Ohne Frühstück (${withoutBreakfast.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
            background: tab === k ? 'var(--text)' : 'var(--bgCard)',
            color: tab === k ? 'var(--bg)' : 'var(--textMuted)',
            border: `1px solid ${tab === k ? 'var(--text)' : 'var(--borderLight)'}`,
          }}>{l}</button>
        ))}
      </div>

      {/* Main List */}
      {tab === 'heute' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {withBreakfast.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Keine Buchungen mit Frühstück heute</div>
          ) : withBreakfast.map(b => {
            const checked = isChecked(b.booking_id)
            const log = getLog(b.booking_id)
            return (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10,
                opacity: checked ? 0.6 : 1, transition: '0.2s',
              }}>
                {/* Checkbox */}
                <button onClick={() => checked ? uncheckBreakfast(b) : checkBreakfast(b)} style={{
                  width: 32, height: 32, borderRadius: 8, border: `2px solid ${checked ? '#10b981' : 'var(--borderLight)'}`,
                  background: checked ? 'rgba(16,185,129,0.1)' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {checked && <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                </button>

                {/* Room + Guest */}
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSelectedBooking(b)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Zi. {b.room}</span>
                    <span style={{ fontSize: 13, color: 'var(--textSec)' }}>{b.guest_name}</span>
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--textDim)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                  {checked && log && (
                    <span style={{ fontSize: 10, color: '#10b981' }}>
                      ✓ {new Date(log.checked_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </span>
                  )}
                </div>

                {/* Badge */}
                <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.06)', color: '#10b981', fontWeight: 500 }}>Inkl.</span>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'spontan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {withoutBreakfast.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Alle eingecheckten Gäste haben Frühstück gebucht</div>
          ) : withoutBreakfast.map(b => {
            const checked = isChecked(b.booking_id)
            const log = getLog(b.booking_id)
            return (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10,
                opacity: checked ? 0.6 : 1,
              }}>
                {/* Status indicator */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  border: `2px solid ${checked ? '#3b82f6' : 'var(--borderLight)'}`,
                  background: checked ? 'rgba(59,130,246,0.1)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checked && <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                </div>

                {/* Room + Guest */}
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSelectedBooking(b)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Zi. {b.room}</span>
                    <span style={{ fontSize: 13, color: 'var(--textSec)' }}>{b.guest_name}</span>
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--textDim)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                  {checked && log ? (
                    <span style={{ fontSize: 10, color: '#3b82f6' }}>
                      Spontan · {log.persons} Pers. · {log.charge_amount}€ auf Zimmerrechnung
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--textDim)' }}>Kein Frühstück gebucht</span>
                  )}
                </div>

                {/* Add button */}
                {!checked ? (
                  <button onClick={() => { setSpontaneousModal(b); setSpontaneousPersons(1) }} style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6',
                  }}>+ Zubuchen</button>
                ) : (
                  <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.06)', color: '#3b82f6', fontWeight: 500 }}>Zugebucht</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Spontaneous Booking Modal */}
      {spontaneousModal && (
        <div style={s.overlay} onClick={() => setSpontaneousModal(null)}>
          <div style={{ ...s.modal, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Frühstück zubuchen</h3>
              <button onClick={() => setSpontaneousModal(null)} style={s.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--bgCard)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>Zi. {spontaneousModal.room} — {spontaneousModal.guest_name}</div>
              <div style={{ fontSize: 11, color: 'var(--textDim)', marginTop: 4 }}>Wird auf die Zimmerrechnung gebucht</div>
            </div>

            <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Anzahl Personen</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setSpontaneousPersons(n)} style={{
                  flex: 1, padding: '12px', borderRadius: 8, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, textAlign: 'center',
                  background: spontaneousPersons === n ? 'rgba(59,130,246,0.1)' : 'var(--bgCard)',
                  color: spontaneousPersons === n ? '#3b82f6' : 'var(--textMuted)',
                  border: `2px solid ${spontaneousPersons === n ? '#3b82f6' : 'var(--borderLight)'}`,
                }}>{n}</button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bgCard)', borderRadius: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--textMuted)' }}>Betrag</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{(BREAKFAST_PRICE * spontaneousPersons).toFixed(2)} €</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSpontaneousModal(null)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={addSpontaneous} style={{ flex: 1, padding: 12, background: '#3b82f6', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Auf Zimmer buchen</button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div style={s.overlay} onClick={() => setSelectedBooking(null)}>
          <div style={{ ...s.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Buchungsdetails</h3>
              <button onClick={() => setSelectedBooking(null)} style={s.closeBtn}>✕</button>
            </div>

            {[
              ['Gast', selectedBooking.guest_name],
              ['Zimmer', selectedBooking.room],
              ['Buchungs-ID', selectedBooking.booking_id || '—'],
              ['Check-in', selectedBooking.check_in],
              ['Check-out', selectedBooking.check_out],
              ['Nächte', selectedBooking.check_in && selectedBooking.check_out ? Math.max(1, Math.ceil((new Date(selectedBooking.check_out) - new Date(selectedBooking.check_in)) / 86400000)) : '—'],
              ['Betrag', `${parseFloat(selectedBooking.amount_due || 0).toFixed(2)}€`],
              ['Quelle', selectedBooking.source || 'Direkt'],
              ['Status', selectedBooking.status === 'checked_in' ? 'Eingecheckt' : selectedBooking.status === 'confirmed' ? 'Bestätigt' : 'Reserviert'],
            ].map(([l, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{l}</span>
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: l === 'Betrag' ? 600 : 400 }}>{v}</span>
              </div>
            ))}

            {/* Frühstück Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>Frühstück</span>
              <span style={{ fontSize: 12, color: selectedBooking.breakfast_included ? '#10b981' : 'var(--textDim)', fontWeight: 500 }}>
                {selectedBooking.breakfast_included ? `✓ Inkl. (${selectedBooking.breakfast_persons || 1} Pers.)` : '— Nicht gebucht'}
              </span>
            </div>

            {/* Breakfast check status for today */}
            {(() => {
              const log = getLog(selectedBooking.booking_id)
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', marginBottom: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>Heute erschienen</span>
                  <span style={{ fontSize: 12, color: log ? '#10b981' : '#f59e0b', fontWeight: 500 }}>
                    {log ? `✓ ${new Date(log.checked_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr${log.spontaneous ? ' (Spontan)' : ''}` : '— Noch nicht'}
                  </span>
                </div>
              )
            })()}

            {/* Notes */}
            {selectedBooking.notes && (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 500, marginBottom: 4 }}>Notiz</div>
                <div style={{ fontSize: 12, color: 'var(--textSec)', lineHeight: 1.5 }}>{selectedBooking.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 800 },
  h1: { fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '0 0 16px', letterSpacing: -0.5 },
  kpi: { background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, padding: 16, textAlign: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%' },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
