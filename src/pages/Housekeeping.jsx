import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'

const STATUSES = [
  { id: 'dirty', label: 'Schmutzig', color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
  { id: 'cleaning', label: 'In Reinigung', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
  { id: 'clean', label: 'Sauber', color: '#10b981', bg: 'rgba(16,185,129,0.06)' },
  { id: 'blocked', label: 'Gesperrt', color: '#6b7280', bg: 'rgba(107,114,128,0.06)' },
]

const TYPE_LABELS = { standard_single: 'Einzelzimmer', standard_double: 'Doppelzimmer', junior_suite: 'Junior Suite', suite: 'Suite', penthouse: 'Penthouse' }

const HK_CATEGORIES = ['pillow', 'towels', 'blanket', 'cleaning', 'extra_bed', 'toiletries', 'iron', 'other']
const CAT_LABELS = { pillow: 'Kissen', towels: 'Handtücher', blanket: 'Decken', cleaning: 'Reinigung', extra_bed: 'Zustellbett', toiletries: 'Pflegeprodukte', iron: 'Bügeleisen', other: 'Sonstiges' }

export default function Housekeeping() {
  const [items, setItems] = useState([])
  const [rooms, setRooms] = useState([])
  const [bookings, setBookings] = useState([])
  const [products, setProducts] = useState([])
  const [requests, setRequests] = useState([])
  const [requestHistory, setRequestHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [mainTab, setMainTab] = useState('zimmer')
  const [floor, setFloor] = useState(1)
  const [filter, setFilter] = useState('alle')
  const [minibarRoom, setMinibarRoom] = useState(null)
  const [minibarCart, setMinibarCart] = useState({})
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [lateCheckouts, setLateCheckouts] = useState([])
  const [signatureReq, setSignatureReq] = useState(null)

  const todayStr = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const [h, r, b, p, req, hist, lc] = await Promise.all([
      supabase.from('housekeeping').select('*').order('room_number', { ascending: true }),
      supabase.from('rooms').select('*').order('room_number', { ascending: true }),
      supabase.from('bookings').select('*'),
      supabase.from('minibar_products').select('*').eq('active', true).order('category'),
      supabase.from('service_requests').select('*').in('category', HK_CATEGORIES).in('status', ['pending', 'accepted']).order('timestamp', { ascending: false }),
      supabase.from('service_requests').select('*').in('category', HK_CATEGORIES).in('status', ['resolved', 'delivered']).gte('timestamp', threeDaysAgo.toISOString()).order('timestamp', { ascending: false }),
      supabase.from('service_requests').select('*').eq('category', 'late_checkout').eq('status', 'accepted').gte('timestamp', new Date().toISOString().split('T')[0]),
    ])
    setItems(h.data || [])
    setRooms(r.data || [])
    setBookings(b.data || [])
    setProducts(p.data || [])
    setRequests(req.data || [])
    setRequestHistory(hist.data || [])
    setLateCheckouts(lc.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const u1 = subscribeToTable('housekeeping', () => load())
    const u2 = subscribeToTable('bookings', () => load())
    return () => { u1(); u2() }
  }, [load])

  const getGuest = (rn) => {
    const b = bookings.find(b => String(b.room) === String(rn) && b.check_in <= todayStr && b.check_out > todayStr && (b.status === 'checked_in' || b.status === 'confirmed'))
    return b ? b.guest_name : null
  }

  const getBookingNotes = (rn) => {
    const b = bookings.find(b => String(b.room) === String(rn) && b.check_in <= todayStr && b.check_out > todayStr && (b.status === 'checked_in' || b.status === 'confirmed'))
    return b?.notes || null
  }

  const isCheckoutToday = (rn) => {
    return bookings.some(b => String(b.room) === String(rn) && b.check_out === todayStr)
  }

  const isCheckedOut = (rn) => {
    return bookings.some(b => String(b.room) === String(rn) && b.check_out === todayStr && b.status === 'checked_out')
  }

  const getRoomType = (rn) => {
    const room = rooms.find(r => String(r.room_number) === String(rn))
    return room ? (TYPE_LABELS[room.type] || room.type) : ''
  }

  const changeStatus = (item, newStatus) => {
    const label = STATUSES.find(s => s.id === newStatus)?.label || newStatus
    setConfirm({
      title: `Zimmer ${item.room_number}`,
      message: `Als "${label}" markieren?`,
      warning: newStatus === 'blocked' ? 'Das Zimmer wird aus dem Verkauf genommen.' : null,
      confirmLabel: label,
      confirmColor: STATUSES.find(s => s.id === newStatus)?.color || '#fff',
      onConfirm: async () => {
        await supabase.from('housekeeping').update({ status: newStatus }).eq('id', item.id)
        setConfirm(null)
        load()
      },
    })
  }

  // Minibar
  const openMinibar = (item) => { setMinibarRoom(item); setMinibarCart({}) }
  const updateCart = (pid, delta) => {
    setMinibarCart(prev => {
      const next = Math.max(0, (prev[pid] || 0) + delta)
      if (next === 0) { const { [pid]: _, ...rest } = prev; return rest }
      return { ...prev, [pid]: next }
    })
  }
  const cartTotal = Object.entries(minibarCart).reduce((s, [pid, qty]) => {
    const p = products.find(pr => pr.id === pid)
    return s + (p ? p.price * qty : 0)
  }, 0)

  const submitMinibar = async () => {
    if (Object.keys(minibarCart).length === 0) return
    setSaving(true)
    for (const [pid, qty] of Object.entries(minibarCart)) {
      const p = products.find(pr => pr.id === pid)
      if (p) await supabase.from('minibar_consumption').insert({ room: minibarRoom.room_number, product_id: pid, product_name: p.name, quantity: qty, price: p.price, total: p.price * qty })
    }
    await supabase.from('housekeeping').update({ minibar_checked: true, minibar_total: cartTotal }).eq('id', minibarRoom.id)
    setSaving(false)
    setConfirm({
      title: 'Minibar erfasst ✓', message: `${cartTotal.toFixed(2)}€ wurden auf Zimmer ${minibarRoom.room_number} gebucht.`,
      confirmLabel: 'OK', confirmColor: '#10b981',
      onConfirm: () => { setConfirm(null); setMinibarRoom(null); load() },
    })
  }

  const confirmMinibarEmpty = () => {
    setConfirm({
      title: 'Minibar geprüft', message: `Minibar Zimmer ${minibarRoom.room_number} — nichts verbraucht. Als geprüft markieren?`,
      confirmLabel: 'Bestätigen', confirmColor: '#10b981',
      onConfirm: async () => {
        await supabase.from('housekeeping').update({ minibar_checked: true, minibar_total: 0 }).eq('id', minibarRoom.id)
        setConfirm(null); setMinibarRoom(null); load()
      },
    })
  }

  // Floor filtering
  const floors = [...new Set(rooms.map(r => r.floor))].sort()
  if (floors.length === 0) floors.push(1, 2, 3)

  const floorItems = items.filter(item => {
    const room = rooms.find(r => String(r.room_number) === String(item.room_number))
    return room ? room.floor === floor : String(item.room_number).startsWith(String(floor))
  })
  const filteredUnsorted = filter === 'alle' ? floorItems : floorItems.filter(i => i.status === filter)
  // Sort: late checkout rooms at the end (they become free later)
  const filtered = filteredUnsorted.sort((a, b) => {
    const aLate = lateCheckouts.some(lc => String(lc.room) === String(a.room_number)) ? 1 : 0
    const bLate = lateCheckouts.some(lc => String(lc.room) === String(b.room_number)) ? 1 : 0
    return aLate - bLate
  })
  const counts = STATUSES.reduce((a, st) => { a[st.id] = floorItems.filter(i => i.status === st.id).length; return a }, {})

  // Service Request handlers
  const acceptRequest = async (req) => {
    await supabase.from('service_requests').update({ status: 'accepted' }).eq('id', req.id)
    load()
  }

  const startDeliverRequest = (req) => { setSignatureReq(req) }

  const completeRequest = async (sigData) => {
    await supabase.from('service_requests').update({ status: 'delivered', resolved_at: new Date().toISOString(), image_url: sigData }).eq('id', signatureReq.id)
    setSignatureReq(null); load()
  }

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)', fontSize: 14 }}>Laden...</div></div>

  return (
    <div style={s.content}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={s.h1}>Housekeeping</h1>
        <p style={{ fontSize: 12, color: 'var(--textMuted)', marginTop: -12 }}>{items.length} Zimmer · {items.filter(i => i.status === 'dirty').length} schmutzig · {requests.length} offene Anfragen</p>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['zimmer', `Zimmer (${items.length})`], ['anfragen', `Anfragen (${requests.length})`], ['verlauf', `Verlauf 3 Tage (${requestHistory.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setMainTab(k)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            background: mainTab === k ? 'var(--text)' : 'var(--bgCard)', color: mainTab === k ? 'var(--bg)' : 'var(--textMuted)',
            border: `1px solid ${mainTab === k ? 'var(--text)' : 'var(--borderLight)'}`,
          }}>{l}</button>
        ))}
      </div>

      {/* ANFRAGEN TAB */}
      {mainTab === 'anfragen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map(req => {
            const mins = req.timestamp ? Math.round((Date.now() - new Date(req.timestamp).getTime()) / 60000) : 0
            return (
              <div key={req.id} style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderLeft: `4px solid ${req.status === 'accepted' ? '#f59e0b' : '#3b82f6'}`, borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.08)', color: '#3b82f6', fontWeight: 500 }}>{CAT_LABELS[req.category] || req.category}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Zi. {req.room}</span>
                    <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{req.guest_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--textDim)' }}>vor {mins} Min.</span>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: req.status === 'accepted' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)', color: req.status === 'accepted' ? '#f59e0b' : '#3b82f6' }}>{req.status === 'accepted' ? 'Angenommen' : 'Wartend'}</span>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--textSec)', margin: '4px 0 12px' }}>{req.request_details}</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {req.status === 'pending' && <button onClick={() => acceptRequest(req)} style={{ padding: '8px 16px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Annehmen</button>}
                  {req.status === 'accepted' && <button onClick={() => startDeliverRequest(req)} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Erledigt — Unterschrift</button>}
                </div>
              </div>
            )
          })}
          {requests.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Keine offenen Anfragen</div>}
        </div>
      )}

      {/* VERLAUF TAB */}
      {mainTab === 'verlauf' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requestHistory.map(req => {
            const created = new Date(req.timestamp)
            const resolved = req.resolved_at ? new Date(req.resolved_at) : null
            const duration = resolved ? Math.round((resolved - created) / 60000) : null
            return (
              <div key={req.id} style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, padding: '12px 16px', opacity: 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(107,114,128,0.08)', color: '#6b7280' }}>{CAT_LABELS[req.category] || req.category}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Zi. {req.room}</span>
                    <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{req.guest_name}</span>
                  </div>
                  {duration && <span style={{ fontSize: 10, color: 'var(--textDim)' }}>{duration} Min. Dauer</span>}
                </div>
                <p style={{ fontSize: 12, color: 'var(--textMuted)', margin: '4px 0 0' }}>{req.request_details}</p>
                <div style={{ fontSize: 10, color: 'var(--textDim)', marginTop: 4 }}>{created.toLocaleDateString('de-DE')} · {created.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            )
          })}
          {requestHistory.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Kein Verlauf in den letzten 3 Tagen</div>}
        </div>
      )}

      {/* ZIMMER TAB */}
      {mainTab === 'zimmer' && <>

      {/* Floor Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {floors.map(f => {
          const fCount = items.filter(it => { const rm = rooms.find(r => String(r.room_number) === String(it.room_number)); return rm ? rm.floor === f : false }).length
          const fDirty = items.filter(it => { const rm = rooms.find(r => String(r.room_number) === String(it.room_number)); return (rm ? rm.floor === f : false) && it.status === 'dirty' }).length
          return (
            <button key={f} onClick={() => setFloor(f)} style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: floor === f ? 600 : 400,
              background: floor === f ? 'var(--text)' : 'var(--bgCard)', color: floor === f ? 'var(--bg)' : 'var(--textMuted)',
              border: `1px solid ${floor === f ? 'var(--text)' : 'var(--borderLight)'}`, position: 'relative',
            }}>
              Etage {f} <span style={{ fontSize: 10, opacity: 0.7 }}>({fCount})</span>
              {fDirty > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{fDirty}</span>}
            </button>
          )
        })}
      </div>

      {/* Status Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('alle')} style={{ ...s.filterBtn, background: filter === 'alle' ? 'var(--text)' : 'var(--bgCard)', color: filter === 'alle' ? 'var(--bg)' : 'var(--textMuted)', border: `1px solid ${filter === 'alle' ? 'var(--text)' : 'var(--borderLight)'}` }}>
          Alle {floorItems.length}
        </button>
        {STATUSES.map(st => (
          <button key={st.id} onClick={() => setFilter(st.id)} style={{ ...s.filterBtn, background: filter === st.id ? `${st.color}15` : 'var(--bgCard)', color: filter === st.id ? st.color : 'var(--textMuted)', border: `1px solid ${filter === st.id ? st.color : 'var(--borderLight)'}` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
            {st.label} {counts[st.id] || 0}
          </button>
        ))}
      </div>

      {/* Room Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {filtered.map(item => {
          const st = STATUSES.find(s => s.id === item.status) || STATUSES[0]
          const guest = getGuest(item.room_number)
          const roomType = getRoomType(item.room_number)
          const checkout = isCheckoutToday(item.room_number)
          const checkedOut = isCheckedOut(item.room_number)
          const bookingNotes = getBookingNotes(item.room_number)
          const roomData = rooms.find(r => String(r.room_number) === String(item.room_number))
          const isBlocked = roomData?.blocked_reason
          const lateC = lateCheckouts.find(lc => String(lc.room) === String(item.room_number))
          return (
            <div key={item.id} style={{
              background: 'var(--bgCard)', border: isBlocked ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden',
              boxShadow: checkout ? '0 0 0 2px rgba(245,158,11,0.4)' : checkedOut ? '0 0 0 2px rgba(239,68,68,0.4)' : 'none',
              opacity: isBlocked ? 0.5 : 1,
            }}>
              {/* Color bar */}
              <div style={{ height: 4, background: st.color }} />

              {/* Content */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{item.room_number}</div>
                    <div style={{ fontSize: 10, color: 'var(--textDim)' }}>{roomType}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: st.bg, color: st.color, fontWeight: 500 }}>{st.label}</span>
                    {isBlocked && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 500 }}>Gesperrt</span>}
                    {lateC && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 500 }} title={lateC.request_details}>🕐 Late C/O</span>}
                    {checkout && !checkedOut && !lateC && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 500 }}>Abreise heute</span>}
                    {checkedOut && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 500 }}>Ausgecheckt — vorbereiten!</span>}
                  </div>
                </div>

                {/* Guest */}
                {guest ? (
                  <div style={{ fontSize: 12, color: 'var(--textSec)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    {guest}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--textDim)', marginBottom: 4 }}>Kein Gast</div>
                )}
                {bookingNotes && <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 8, padding: '3px 6px', background: 'rgba(245,158,11,0.06)', borderRadius: 4 }}>{bookingNotes}</div>}
                {!bookingNotes && <div style={{ marginBottom: 6 }} />}

                {/* Status buttons row */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {STATUSES.map(ns => (
                    <button key={ns.id} onClick={() => changeStatus(item, ns.id)} style={{
                      flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, textAlign: 'center',
                      border: item.status === ns.id ? `2px solid ${ns.color}` : `1px solid ${ns.color}25`,
                      background: item.status === ns.id ? ns.bg : 'transparent',
                      color: item.status === ns.id ? ns.color : `${ns.color}80`,
                      opacity: item.status === ns.id ? 1 : 0.7,
                    }}>{ns.label}</button>
                  ))}
                </div>

                {/* Minibar — separate section */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                  <button onClick={() => openMinibar(item)} style={{
                    width: '100%', padding: '7px 0', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, textAlign: 'center',
                    border: '1px solid rgba(139,92,246,0.25)', background: item.minibar_checked ? 'rgba(16,185,129,0.06)' : 'rgba(139,92,246,0.04)',
                    color: item.minibar_checked ? '#10b981' : '#8b5cf6',
                  }}>
                    {item.minibar_checked ? '✓ Minibar geprüft' : 'Minibar prüfen'}
                    {item.minibar_total > 0 && <span style={{ marginLeft: 6, fontWeight: 600 }}>{parseFloat(item.minibar_total).toFixed(2)}€</span>}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--textDim)', fontSize: 13 }}>Keine Zimmer mit diesem Filter auf Etage {floor}</div>}
      </>}

      {/* Signature Pad */}
      {signatureReq && <SignaturePad order={signatureReq} onComplete={completeRequest} onCancel={() => setSignatureReq(null)} />}

      {/* Minibar Panel */}
      {minibarRoom && (
        <div style={s.overlay} onClick={() => setMinibarRoom(null)}>
          <div style={{ ...s.modal, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Minibar — Zimmer {minibarRoom.room_number}</h3>
                {getGuest(minibarRoom.room_number) && <span style={{ fontSize: 11, color: '#10b981' }}>{getGuest(minibarRoom.room_number)}</span>}
              </div>
              <button onClick={() => setMinibarRoom(null)} style={s.closeBtn}>✕</button>
            </div>

            {products.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Minibar-Produkte angelegt. Bitte in Supabase Tabelle "minibar_products" Produkte einfügen.</div>
            ) : <>
              {[...new Set(products.map(p => p.category))].map(cat => (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>{cat}</div>
                  {products.filter(p => p.category === cat).map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--textSec)', flex: 1 }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--textMuted)', minWidth: 45, textAlign: 'right' }}>{p.price?.toFixed(2)}€</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => updateCart(p.id, -1)} style={s.qtyBtn}>−</button>
                        <span style={{ fontSize: 13, color: 'var(--text)', minWidth: 20, textAlign: 'center', fontWeight: 500 }}>{minibarCart[p.id] || 0}</span>
                        <button onClick={() => updateCart(p.id, 1)} style={{ ...s.qtyBtn, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Cart summary */}
              {Object.keys(minibarCart).length > 0 && (
                <div style={{ marginTop: 8, padding: '12px 0', borderTop: '2px solid var(--border)' }}>
                  {Object.entries(minibarCart).map(([pid, qty]) => {
                    const p = products.find(pr => pr.id === pid)
                    return p ? <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--textSec)', padding: '2px 0' }}>
                      <span>{qty}x {p.name}</span><span>{(p.price * qty).toFixed(2)}€</span>
                    </div> : null
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 6, fontWeight: 600 }}>
                    <span style={{ fontSize: 14, color: 'var(--text)' }}>Gesamt</span>
                    <span style={{ fontSize: 16, color: '#10b981' }}>{cartTotal.toFixed(2)}€</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setMinibarRoom(null)} style={s.cancelBtn}>Abbrechen</button>
                {Object.keys(minibarCart).length > 0 ? (
                  <button onClick={submitMinibar} disabled={saving} style={{ flex: 1, padding: 12, background: '#10b981', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {saving ? 'Wird gebucht...' : `${cartTotal.toFixed(2)}€ auf Rechnung`}
                  </button>
                ) : (
                  <button onClick={confirmMinibarEmpty} style={{ flex: 1, padding: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, fontSize: 12, color: '#10b981', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✓ Nichts verbraucht
                  </button>
                )}
              </div>
            </>}
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
    </div>
  )
}

function SignaturePad({ order, onComplete, onCancel }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const getPos = (e) => { const rect = canvasRef.current.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY; return { x: cx - rect.left, y: cy - rect.top } }
  const startDraw = (e) => { e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); setDrawing(true) }
  const draw = (e) => { if (!drawing) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const pos = getPos(e); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#fff'; ctx.lineTo(pos.x, pos.y); ctx.stroke(); setHasDrawn(true) }
  const endDraw = () => setDrawing(false)
  const clear = () => { canvasRef.current.getContext('2d').clearRect(0, 0, 400, 180); setHasDrawn(false) }
  return (
    <div style={s.overlay}><div style={{ ...s.modal, maxWidth: 460, textAlign: 'center' }}>
      <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Lieferbestätigung — Unterschrift</h3>
      <p style={{ fontSize: 12, color: 'var(--textMuted)', margin: '0 0 4px' }}>Zi. {order.room} · {order.guest_name}</p>
      <p style={{ fontSize: 11, color: 'var(--textDim)', margin: '0 0 16px' }}>{order.request_details}</p>
      <div style={{ border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
        <canvas ref={canvasRef} width={400} height={180} style={{ width: '100%', height: 180, cursor: 'crosshair', touchAction: 'none', background: 'var(--bg)' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
        {!hasDrawn && <div style={{ marginTop: -100, textAlign: 'center', color: 'var(--textDim)', fontSize: 13, pointerEvents: 'none', paddingBottom: 80 }}>Hier unterschreiben</div>}
      </div>
      <button onClick={clear} style={{ fontSize: 10, color: 'var(--textDim)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12, fontFamily: 'inherit' }}>Löschen</button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={s.cancelBtn}>Abbrechen</button>
        <button onClick={() => hasDrawn && onComplete(canvasRef.current.toDataURL('image/png'))} disabled={!hasDrawn} style={{ flex: 1, padding: 12, background: hasDrawn ? '#10b981' : 'var(--bgCard)', border: hasDrawn ? 'none' : '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, fontWeight: 600, color: hasDrawn ? '#fff' : 'var(--textDim)', cursor: hasDrawn ? 'pointer' : 'default', fontFamily: 'inherit' }}>Bestätigen</button>
      </div>
    </div></div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  h1: { fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '0 0 16px', letterSpacing: -0.5 },
  filterBtn: { padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440 },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  qtyBtn: { width: 28, height: 28, borderRadius: 6, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textSec)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
}
