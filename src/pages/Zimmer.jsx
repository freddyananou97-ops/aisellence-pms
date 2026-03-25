import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'
import { loadInvoiceData, openInvoicePDF } from '../lib/invoice'

const TYPE_LABELS = { standard_single: 'Einzelzimmer', standard_double: 'Doppelzimmer', junior_suite: 'Junior Suite', suite: 'Suite', penthouse: 'Penthouse' }

export default function Zimmer() {
  const [rooms, setRooms] = useState([])
  const [bookings, setBookings] = useState([])
  const [housekeeping, setHousekeeping] = useState([])
  const [charges, setCharges] = useState({})
  const [loading, setLoading] = useState(true)
  const [floor, setFloor] = useState(1)
  const [selected, setSelected] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [checkoutPreview, setCheckoutPreview] = useState(null)
  const [checkoutItems, setCheckoutItems] = useState([])
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')

  const todayStr = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    const [r, b, h] = await Promise.all([
      supabase.from('rooms').select('*').order('room_number', { ascending: true }),
      supabase.from('bookings').select('*').in('status', ['checked_in', 'confirmed', 'reserved']),
      supabase.from('housekeeping').select('*'),
    ])
    setRooms(r.data || [])
    setBookings(b.data || [])
    setHousekeeping(h.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const u1 = subscribeToTable('bookings', () => load())
    const u2 = subscribeToTable('housekeeping', () => load())
    return () => { u1(); u2() }
  }, [load])

  const getBooking = (rn) => bookings.find(b => String(b.room) === String(rn) && b.check_in <= todayStr && b.check_out > todayStr && (b.status === 'checked_in' || b.status === 'confirmed'))
  const getHK = (rn) => housekeeping.find(h => String(h.room_number) === String(rn))
  const nights = (ci, co) => Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000))
  const isCheckoutToday = (rn) => bookings.some(b => String(b.room) === String(rn) && b.check_out === todayStr)

  const HK_COLORS = { dirty: '#ef4444', cleaning: '#f59e0b', clean: '#10b981', blocked: '#6b7280' }
  const HK_LABELS = { dirty: 'Schmutzig', cleaning: 'Reinigung', clean: 'Sauber', blocked: 'Gesperrt' }

  const loadCharges = async (room) => {
    const [sr, mb] = await Promise.all([
      supabase.from('service_requests').select('*').eq('room', String(room)).eq('status', 'delivered').order('timestamp', { ascending: false }),
      supabase.from('minibar_consumption').select('*').eq('room', String(room)).order('created_at', { ascending: false }),
    ])
    const srC = (sr.data || []).map(r => ({ type: r.category === 'room_service' ? 'Room Service' : 'Service', details: r.request_details, amount: r.order_total || 0, date: r.timestamp }))
    const mbC = (mb.data || []).map(r => ({ type: 'Minibar', details: `${r.quantity}x ${r.product_name}`, amount: r.total || 0, date: r.created_at }))
    setCharges(prev => ({ ...prev, [room]: [...srC, ...mbC].sort((a, b) => new Date(b.date) - new Date(a.date)) }))
  }

  const openRoom = (room) => {
    const booking = getBooking(room.room_number)
    setSelected(room)
    setNoteText(booking?.notes || '')
    loadCharges(room.room_number)
  }

  const saveNote = async () => {
    const booking = getBooking(selected.room_number)
    if (!booking) return
    setSavingNote(true)
    await supabase.from('bookings').update({ notes: noteText }).eq('id', booking.id)
    setSavingNote(false)
    load()
  }

  // Checkout flow
  const doCheckOut = async (booking) => {
    const ch = await loadInvoiceData(booking)
    const n = Math.max(1, Math.round((new Date(booking.check_out) - new Date(booking.check_in)) / 86400000))
    setCheckoutItems([
      { id: 'room', type: 'Übernachtung', details: `${n} Nächte · Zimmer ${booking.room}`, amount: parseFloat(booking.amount_due) || 0 },
      ...ch.map((c, i) => ({ id: `ch-${i}`, type: c.type, details: c.details, amount: c.amount })),
    ])
    setCheckoutPreview(booking)
    setSelected(null)
    setNewItemLabel(''); setNewItemAmount('')
  }

  const updateCheckoutItem = (id, field, value) => {
    setCheckoutItems(prev => prev.map(item => item.id === id ? { ...item, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : item))
  }

  const removeCheckoutItem = (id) => setCheckoutItems(prev => prev.filter(item => item.id !== id))

  const addCheckoutItem = () => {
    if (!newItemLabel) return
    setCheckoutItems(prev => [...prev, { id: `new-${Date.now()}`, type: 'Sonstige', details: newItemLabel, amount: parseFloat(newItemAmount) || 0 }])
    setNewItemLabel(''); setNewItemAmount('')
  }

  const finalizeCheckout = async () => {
    await supabase.from('bookings').update({ status: 'checked_out' }).eq('id', checkoutPreview.id)
    const invoiceCharges = checkoutItems.filter(i => i.id !== 'room').map(i => ({ type: i.type, details: i.details, amount: i.amount, date: new Date().toISOString() }))
    openInvoicePDF({ ...checkoutPreview, amount_due: checkoutItems.find(i => i.id === 'room')?.amount || 0 }, invoiceCharges)
    setCheckoutPreview(null); setCheckoutItems([]); load()
  }

  const floors = [...new Set(rooms.map(r => r.floor))].sort()
  if (floors.length === 0) floors.push(1, 2, 3)
  const floorRooms = rooms.filter(r => r.floor === floor)

  const floorOccupied = floorRooms.filter(r => !!getBooking(r.room_number)).length
  const floorBlocked = floorRooms.filter(r => r.blocked_reason).length
  const floorFree = floorRooms.length - floorOccupied - floorBlocked

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={s.content}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={s.h1}>Zimmerübersicht</h1>
        <p style={{ fontSize: 12, color: 'var(--textMuted)', marginTop: -12 }}>{rooms.length} Zimmer · {bookings.filter(b => b.status === 'checked_in' && b.check_in <= todayStr && b.check_out > todayStr).length} belegt</p>
      </div>

      {/* Floor Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {floors.map(f => (
          <button key={f} onClick={() => setFloor(f)} style={{
            padding: '10px 20px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: floor === f ? 600 : 400,
            background: floor === f ? 'var(--text)' : 'var(--bgCard)', color: floor === f ? 'var(--bg)' : 'var(--textMuted)',
            border: `1px solid ${floor === f ? 'var(--text)' : 'var(--borderLight)'}`,
          }}>
            Etage {f}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--textMuted)' }}>
          <span><span style={{ color: '#10b981', fontWeight: 600 }}>{floorOccupied}</span> belegt</span>
          {floorBlocked > 0 && <span><span style={{ color: '#ef4444', fontWeight: 600 }}>{floorBlocked}</span> gesperrt</span>}
          <span><span style={{ fontWeight: 600 }}>{floorFree}</span> frei</span>
        </div>
      </div>

      {/* Room Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {floorRooms.map(room => {
          const booking = getBooking(room.room_number)
          const hk = getHK(room.room_number)
          const hkColor = hk ? HK_COLORS[hk.status] || '#333' : '#333'
          const checkout = isCheckoutToday(room.room_number)
          const isBlocked = !!room.blocked_reason
          return (
            <div key={room.id} onClick={() => openRoom(room)} style={{
              background: 'var(--bgCard)', border: isBlocked ? '2px solid #ef4444' : '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
              boxShadow: checkout ? '0 0 0 2px rgba(245,158,11,0.4)' : 'none', opacity: isBlocked ? 0.75 : 1,
            }}>
              {/* Top bar */}
              <div style={{ height: 4, background: isBlocked ? '#ef4444' : booking ? '#10b981' : '#333' }} />
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{room.room_number}</div>
                    <div style={{ fontSize: 10, color: 'var(--textDim)' }}>{TYPE_LABELS[room.type] || room.type}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: isBlocked ? 'rgba(239,68,68,0.08)' : booking ? 'rgba(16,185,129,0.08)' : 'rgba(107,114,128,0.08)', color: isBlocked ? '#ef4444' : booking ? '#10b981' : '#6b7280', fontWeight: 500 }}>{isBlocked ? 'Gesperrt' : booking ? 'Belegt' : 'Frei'}</span>
                    {hk && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: `${hkColor}10`, color: hkColor }}>{HK_LABELS[hk.status]}</span>}
                    {checkout && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>Abreise heute</span>}
                  </div>
                </div>

                {booking ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <span style={{ fontSize: 12, color: 'var(--textSec)', fontWeight: 500 }}>{booking.guest_name}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--textDim)' }}>{booking.check_in} → {booking.check_out} · {nights(booking.check_in, booking.check_out)}N</div>
                    {booking.notes && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, padding: '3px 6px', background: 'rgba(245,158,11,0.06)', borderRadius: 4 }}>{booking.notes}</div>}
                  </div>
                ) : isBlocked ? (
                  <div>
                    <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>{room.blocked_reason}</div>
                    <div style={{ fontSize: 10, color: 'var(--textDim)', marginTop: 2 }}>{room.blocked_until ? `Bis ${new Date(room.blocked_until + 'T00:00').toLocaleDateString('de-DE')}` : 'Vorläufig gesperrt'}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--textDim)' }}>Kein Gast</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={s.overlay} onClick={() => setSelected(null)}>
          <div style={{ ...s.modal, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Zimmer {selected.room_number}</h3>
                <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{TYPE_LABELS[selected.type] || selected.type} · Etage {selected.floor}</span>
              </div>
              <button onClick={() => setSelected(null)} style={s.closeBtn}>✕</button>
            </div>

            {(() => {
              const booking = getBooking(selected.room_number)
              const hk = getHK(selected.room_number)
              const roomCharges = charges[selected.room_number] || []
              const chargesTotal = roomCharges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)

              return <>
                {/* HK Status */}
                {hk && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>Reinigung</span>
                    <span style={{ fontSize: 12, color: HK_COLORS[hk.status], fontWeight: 500 }}>{HK_LABELS[hk.status]}</span>
                  </div>
                )}

                {booking ? <>
                  {/* Guest Info */}
                  <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <span style={{ fontSize: 14, color: '#10b981', fontWeight: 500 }}>{booking.guest_name}</span>
                    </div>
                    {[
                      ['Check-in', booking.check_in],
                      ['Check-out', booking.check_out],
                      ['Nächte', nights(booking.check_in, booking.check_out)],
                      ['Betrag Zimmer', `${parseFloat(booking.amount_due || 0).toFixed(2)}€`],
                      ['Quelle', booking.source || 'Direkt'],
                      ['Meldeschein', booking.meldeschein_completed ? (booking.meldeschein_vorab ? '✓ Vorab erhalten' : '✓ Ausgefüllt') : 'Ausstehend'],
                    ].map(([l, v], i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                        <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{l}</span>
                        <span style={{ fontSize: 11, color: l === 'Meldeschein' ? (booking.meldeschein_completed ? '#10b981' : '#f59e0b') : 'var(--textSec)' }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Notes */}
                  <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Notiz für Housekeeping & Rezeption</div>
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Notiz hinzufügen..."
                      style={{ width: '100%', padding: '10px 12px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', minHeight: 60 }} />
                    <button onClick={saveNote} disabled={savingNote} style={{ marginTop: 6, padding: '6px 14px', background: noteText !== (booking.notes || '') ? '#10b981' : 'var(--bgCard)', border: noteText !== (booking.notes || '') ? 'none' : '1px solid var(--borderLight)', borderRadius: 6, fontSize: 11, color: noteText !== (booking.notes || '') ? '#fff' : 'var(--textDim)', cursor: noteText !== (booking.notes || '') ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                      {savingNote ? 'Speichert...' : noteText !== (booking.notes || '') ? 'Notiz speichern' : 'Gespeichert'}
                    </button>
                  </div>

                  {/* Charges */}
                  <div style={{ padding: '12px 0' }}>
                    <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Zimmerbelastungen</div>
                    {roomCharges.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--textDim)', textAlign: 'center', padding: '8px 0' }}>Keine Belastungen</div>
                    ) : <>
                      {roomCharges.map((c, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <div>
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, marginRight: 6, background: c.type === 'Room Service' ? 'rgba(245,158,11,0.08)' : 'rgba(139,92,246,0.08)', color: c.type === 'Room Service' ? '#f59e0b' : '#8b5cf6' }}>{c.type}</span>
                            <span style={{ fontSize: 11, color: 'var(--textSec)' }}>{c.details}</span>
                          </div>
                          {c.amount > 0 && <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{parseFloat(c.amount).toFixed(2)}€</span>}
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 600, borderTop: '2px solid var(--border)', marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>Gesamt</span>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>{chargesTotal.toFixed(2)}€</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>+ Zimmerbetrag</span>
                        <span style={{ fontSize: 11, color: 'var(--textSec)' }}>{parseFloat(booking.amount_due || 0).toFixed(2)}€</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: 600 }}>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>Gesamtrechnung</span>
                        <span style={{ fontSize: 15, color: '#10b981' }}>{(chargesTotal + parseFloat(booking.amount_due || 0)).toFixed(2)}€</span>
                      </div>
                    </>}
                  </div>

                  {/* Checkout Button */}
                  {booking.status === 'checked_in' && (
                    <button onClick={() => doCheckOut(booking)} style={{ width: '100%', marginTop: 12, padding: 12, background: '#f59e0b', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#000', cursor: 'pointer', fontFamily: 'inherit' }}>Auschecken & Rechnung prüfen</button>
                  )}
                </> : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Kein Gast eingecheckt</div>
                )}
              </>
            })()}
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

            {checkoutItems.map(item => (
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

            <div style={{ display: 'flex', gap: 6, padding: '10px 0', alignItems: 'center' }}>
              <input value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)} placeholder="Neue Position..." style={{ flex: 1, padding: '8px 10px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
              <input type="number" value={newItemAmount} onChange={e => setNewItemAmount(e.target.value)} placeholder="0" style={{ width: 70, padding: '8px 10px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 12, color: 'var(--text)', textAlign: 'right', outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>€</span>
              <button onClick={addCheckoutItem} disabled={!newItemLabel} style={{ padding: '8px 12px', background: newItemLabel ? 'rgba(16,185,129,0.1)' : 'transparent', border: `1px solid ${newItemLabel ? 'rgba(16,185,129,0.2)' : 'var(--borderLight)'}`, borderRadius: 6, fontSize: 11, color: newItemLabel ? '#10b981' : 'var(--textDim)', cursor: newItemLabel ? 'pointer' : 'default', fontFamily: 'inherit' }}>+</button>
            </div>

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
    </div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  h1: { fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '0 0 16px', letterSpacing: -0.5 },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440 },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
