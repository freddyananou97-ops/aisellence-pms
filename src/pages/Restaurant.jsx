import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, fetchRestaurantTables, fetchRestaurantReservations, subscribeToTable } from '../lib/supabase'
import { createCheckoutSession } from '../lib/stripe'
import { HOTEL, HOTEL_ADDRESS } from '../lib/hotel'
import QRCode from '../components/QRCode'
import ConfirmDialog from '../components/ConfirmDialog'

import { MENU as PRODUCTS } from '../lib/menu'

export default function Restaurant() {
  const [tables, setTables] = useState([])
  const [reservations, setReservations] = useState([])
  const [allReservations, setAllReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [zone, setZone] = useState('innen')
  const [mainView, setMainView] = useState('plan')
  const [resDate, setResDate] = useState(new Date().toISOString().split('T')[0])
  const [resView, setResView] = useState('tag')
  const [showNewRes, setShowNewRes] = useState(false)
  const [newRes, setNewRes] = useState({ guest_name: '', room: '', date: new Date().toISOString().split('T')[0], time: '19:00', persons: 2, special_requests: '' })
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('info')
  const [orders, setOrders] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [showReserve, setShowReserve] = useState(null)
  const [showPayment, setShowPayment] = useState(null)
  const [editingTable, setEditingTable] = useState(null) // id of table being edited
  const [confirm, setConfirm] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [canvasDate, setCanvasDate] = useState(new Date().toISOString().split('T')[0])
  const [pendingReservations, setPendingReservations] = useState([])
  const [confirmPending, setConfirmPending] = useState(null)
  const [selectedTables, setSelectedTables] = useState([])
  const [reassignRes, setReassignRes] = useState(null)
  const [reassignTables, setReassignTables] = useState([])
  const canvasRef = useRef(null)

  const load = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const [t, r] = await Promise.all([fetchRestaurantTables(), fetchRestaurantReservations(canvasDate)])
    setTables(t); setReservations(r)
    // Fetch all reservations for calendar views
    const { data: allRes } = await supabase.from('restaurant_reservations').select('*').gte('date', today).order('date', { ascending: true }).order('time', { ascending: true })
    setAllReservations(allRes || [])
    // Fetch pending large group requests
    const { data: pending } = await supabase.from('restaurant_reservations').select('*').eq('status', 'pending').order('date', { ascending: true })
    setPendingReservations(pending || [])
    setLoading(false)
    // Load existing orders
    const { data: ord } = await supabase.from('restaurant_orders').select('*').eq('status', 'open')
    if (ord) {
      const byTable = {}
      ord.forEach(o => { if (!byTable[o.table_name]) byTable[o.table_name] = []; byTable[o.table_name].push(o) })
      setOrders(byTable)
    }
  }, [canvasDate])

  // Re-fetch data when canvasDate changes
  useEffect(() => { load() }, [load])

  // Realtime subscriptions — stable, independent of canvasDate
  useEffect(() => {
    const u1 = subscribeToTable('restaurant_tables', () => load())
    const u2 = subscribeToTable('restaurant_reservations', () => load())
    return () => { u1(); u2() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const zones = [...new Set(tables.map(t => t.location || 'innen'))].sort()
  if (zones.length === 0) zones.push('innen')
  const zoneTables = tables.filter(t => (t.location || 'innen') === zone)

  const getTableStatus = (table) => {
    if (table.status === 'occupied') return 'occupied'
    const res = reservations.find(r => (r.table_id === table.id || r.table_name === table.name || (r.combined_tables && r.combined_tables.includes(table.name))) && r.status === 'confirmed')
    if (res) return 'reserved'
    const pending = reservations.find(r => (r.table_id === table.id || r.table_name === table.name || (r.combined_tables && r.combined_tables.includes(table.name))) && r.status === 'pending')
    if (pending) return 'pending'
    return 'free'
  }

  const STATUS_COLORS = { free: '#333', reserved: '#3b82f6', occupied: '#10b981', pending: '#f59e0b' }
  const dragStartRef = useRef(null)
  const didDrag = useRef(false)
  const pinchStartRef = useRef(null)

  // Drag only when editing
  const handlePointerDown = (e, table) => {
    if (editingTable !== table.id) return
    e.preventDefault(); e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    dragStartRef.current = { x: clientX, y: clientY }
    didDrag.current = false

    // Pinch detection (2 fingers)
    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchStartRef.current = { dist: Math.sqrt(dx * dx + dy * dy), startW: table.w || 80 }
      setDragging(null)
      return
    }

    setDragging({ id: table.id, offsetX: clientX - rect.left - (table.x_pos || 100), offsetY: clientY - rect.top - (table.y_pos || 100) })
  }

  const handlePointerMove = (e) => {
    if (!canvasRef.current) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    // Pinch resize
    if (e.touches && e.touches.length === 2 && pinchStartRef.current && editingTable) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const scale = dist / pinchStartRef.current.dist
      const newSize = Math.max(60, Math.min(200, Math.round(pinchStartRef.current.startW * scale)))
      setTables(prev => prev.map(t => t.id === editingTable ? { ...t, w: newSize, h: newSize } : t))
      return
    }

    if (!dragging) return
    didDrag.current = true
    const rect = canvasRef.current.getBoundingClientRect()
    setTables(prev => prev.map(t => t.id === dragging.id ? { ...t, x_pos: Math.max(0, Math.min(rect.width - (t.w || 80), clientX - rect.left - dragging.offsetX)), y_pos: Math.max(0, Math.min(rect.height - (t.h || 80), clientY - rect.top - dragging.offsetY)) } : t))
  }

  const handlePointerUp = () => {
    setDragging(null)
    pinchStartRef.current = null
  }

  const handleTableClick = (table) => {
    if (editingTable) return // don't open panel while editing
    setSelected(table); setTab('info')
  }

  const startEditing = (table) => {
    setEditingTable(table.id)
    setSelected(null) // close panel
  }

  const saveEditing = async () => {
    if (!editingTable) return
    const table = tables.find(t => t.id === editingTable)
    if (table) {
      await supabase.from('restaurant_tables').update({ x_pos: table.x_pos, y_pos: table.y_pos, w: table.w || 80, h: table.h || 80 }).eq('id', table.id)
    }
    setEditingTable(null)
    load()
  }

  const addTable = async (data) => {
    await supabase.from('restaurant_tables').insert({ name: data.name, seats: data.seats, shape: data.shape, location: zone, x_pos: 200, y_pos: 200, status: 'free', active: true })
    setShowAdd(false); load()
  }

  const toggleStatus = async (table, newStatus) => {
    await supabase.from('restaurant_tables').update({ status: newStatus }).eq('id', table.id)
    load()
  }

  const deleteTable = (table) => {
    setConfirm({ title: 'Tisch löschen', message: `Tisch "${table.name}" wirklich löschen?`, confirmLabel: 'Löschen', confirmColor: '#ef4444',
      onConfirm: async () => { await supabase.from('restaurant_tables').update({ active: false }).eq('id', table.id); setConfirm(null); setSelected(null); load() } })
  }

  // Orders
  const tableOrders = selected ? (orders[selected.name] || []) : []
  const tableTotal = tableOrders.reduce((s, o) => s + o.product_price * (o.quantity || 1), 0)

  const addProduct = async (name, price) => {
    if (!selected) return
    const existing = tableOrders.find(o => o.product_name === name && o.status === 'open')
    if (existing) {
      await supabase.from('restaurant_orders').update({ quantity: (existing.quantity || 1) + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('restaurant_orders').insert({ table_name: selected.name, product_name: name, product_price: price, quantity: 1, status: 'open' })
    }
    if (selected.status !== 'occupied') await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', selected.id)
    load()
  }

  const removeProduct = async (order) => {
    if ((order.quantity || 1) > 1) {
      await supabase.from('restaurant_orders').update({ quantity: order.quantity - 1 }).eq('id', order.id)
    } else {
      await supabase.from('restaurant_orders').delete().eq('id', order.id)
    }
    load()
  }

  const sendToKitchen = async () => {
    if (tableOrders.length === 0) return
    const ids = tableOrders.filter(o => o.status === 'open').map(o => o.id)
    if (ids.length === 0) return
    await supabase.from('restaurant_orders').update({ status: 'sent_to_kitchen' }).in('id', ids)
    // Also create service_request so Kitchen module picks it up
    await supabase.from('service_requests').insert({
      category: 'room_service', room: `Tisch ${selected.name}`, guest_name: 'Restaurant',
      request_details: tableOrders.map(o => `${o.quantity || 1}x ${o.product_name}`).join(', '),
      status: 'pending',
      order_total: tableTotal
    })
    setConfirm({ title: 'An Küche gesendet ✓', message: `${ids.length} Position(en) wurden an die Küche übermittelt.`, confirmLabel: 'OK', confirmColor: '#10b981',
      onConfirm: () => { setConfirm(null); load() } })
  }

  const handleCheckout = async (method, detail) => {
    const allOrders = orders[selected.name] || []
    const total = allOrders.reduce((s, o) => s + o.product_price * (o.quantity || 1), 0)
    // Update all orders
    for (const o of allOrders) {
      await supabase.from('restaurant_orders').update({ status: 'paid', payment_method: method, ...(detail?.room ? { room: detail.room, booking_id: detail.room } : {}) }).eq('id', o.id)
    }
    // Free table
    await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', selected.id)
    setShowPayment({ method, total, table: selected.name, items: allOrders })
    setOrders(prev => { const n = { ...prev }; delete n[selected.name]; return n })
    load()
  }

  const printReceipt = (receipt) => {
    const netto = (receipt.total / 1.19).toFixed(2)
    const mwst = (receipt.total - receipt.total / 1.19).toFixed(2)
    const items = receipt.items.map(o => `<tr><td>${o.quantity || 1}x ${o.product_name}</td><td style="text-align:right">${(o.product_price * (o.quantity || 1)).toFixed(2)}€</td></tr>`).join('')
    const w = window.open('', '_blank', 'width=320,height=600')
    w.document.write(`<html><head><title>Bon</title><style>*{margin:0;font-family:monospace;font-size:12px}body{padding:16px;width:280px}h2{font-size:14px;text-align:center;margin-bottom:4px}p{text-align:center;font-size:10px;color:#666}hr{border:none;border-top:1px dashed #ccc;margin:8px 0}table{width:100%}td{padding:2px 0}.t{font-weight:bold;font-size:14px;border-top:1px solid #000;padding-top:6px;margin-top:4px}</style></head><body><h2>${HOTEL.name}</h2><p>${HOTEL_ADDRESS}</p><p>Tel: ${HOTEL.phone}</p><hr><p style="color:#000">${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')} · Tisch ${receipt.table}</p><hr><table>${items}</table><hr><table><tr class="t"><td>Gesamt</td><td style="text-align:right">${receipt.total.toFixed(2)}€</td></tr><tr><td style="font-size:10px;color:#666">Netto</td><td style="text-align:right;font-size:10px;color:#666">${netto}€</td></tr><tr><td style="font-size:10px;color:#666">MwSt 19%</td><td style="text-align:right;font-size:10px;color:#666">${mwst}€</td></tr></table><hr><p style="color:#000">Zahlungsart: ${receipt.method}</p><hr><p>USt-IdNr: ${HOTEL.taxId}</p><p style="margin-top:8px">Vielen Dank für Ihren Besuch!</p><script>setTimeout(()=>window.print(),300)</script></body></html>`)
  }

  return (
    <div style={s.content}>
      <div style={s.header}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Restaurant</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowNewRes(true)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>+ Reservierung</button>
          <button style={s.addBtn} onClick={() => setShowAdd(true)}>+ Neuer Tisch</button>
        </div>
      </div>

      {/* Main View Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['plan', 'Tischplan'], ['reservierungen', `Reservierungen (${reservations.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setMainView(k)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            background: mainView === k ? 'var(--text)' : 'var(--bgCard)',
            color: mainView === k ? 'var(--bg)' : 'var(--textMuted)',
            border: `1px solid ${mainView === k ? 'var(--text)' : 'var(--borderLight)'}`,
          }}>{l}</button>
        ))}
      </div>

      {mainView === 'plan' && <>

      {/* Zone Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {zones.map(z => (
          <button key={z} onClick={() => setZone(z)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: zone === z ? 'var(--text)' : 'var(--bgCard)', color: zone === z ? 'var(--bg)' : 'var(--textMuted)', border: `1px solid ${zone === z ? 'var(--text)' : 'var(--borderLight)'}` }}>
            {z.charAt(0).toUpperCase() + z.slice(1)}
          </button>
        ))}
        <button style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--textDim)', border: '1px dashed var(--borderLight)', background: 'transparent' }}
          onClick={() => { const n = prompt('Neuer Bereich:'); if (n) setZone(n.toLowerCase()) }}>+</button>
      </div>

      {/* Pending Requests Banner */}
      {pendingReservations.length > 0 && (
        <div style={{ padding: '10px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 500 }}>{pendingReservations.length} offene Gruppenanfrage{pendingReservations.length > 1 ? 'n' : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            {pendingReservations.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#f59e0b', minWidth: 40 }}>{r.persons}P</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{r.guest_name} {r.room && <span style={{ fontSize: 10, color: 'var(--textDim)' }}>Zi. {r.room}</span>}</div>
                  <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>{r.date} um {r.time} {r.special_requests && `· ${r.special_requests}`}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => { setConfirmPending(r); setSelectedTables([]) }} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#10b981', border: 'none', color: '#fff' }}>Tische zuweisen</button>
                  <button onClick={() => setConfirm({ title: 'Gast kontaktieren', message: `${r.guest_name}${r.room ? ` · Zimmer ${r.room}` : ''}${r.phone ? ` · Tel: ${r.phone}` : ''}\n\n${r.persons} Personen am ${r.date} um ${r.time}${r.special_requests ? `\nWünsche: ${r.special_requests}` : ''}`, confirmLabel: 'Absagen', confirmColor: '#ef4444', onConfirm: async () => { await supabase.from('restaurant_reservations').update({ status: 'cancelled' }).eq('id', r.id); setConfirm(null); load() } })} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>Kontakt / Absage</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canvas Date Picker */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {[['#333','Frei'],['#3b82f6','Reserviert'],['#10b981','Besetzt'],['#f59e0b','Anfrage']].map(([c,l]) => <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} /><span style={{ fontSize: 10, color: 'var(--textMuted)' }}>{l}</span></div>)}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => { const d = new Date(canvasDate); d.setDate(d.getDate() - 1); setCanvasDate(d.toISOString().split('T')[0]) }} style={s.navBtn}>←</button>
          <CanvasDatePicker value={canvasDate} onChange={setCanvasDate} allReservations={allReservations} />
          <button onClick={() => setCanvasDate(new Date().toISOString().split('T')[0])} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: canvasDate === new Date().toISOString().split('T')[0] ? 'var(--text)' : 'var(--bgCard)', color: canvasDate === new Date().toISOString().split('T')[0] ? 'var(--bg)' : 'var(--textMuted)', border: `1px solid ${canvasDate === new Date().toISOString().split('T')[0] ? 'var(--text)' : 'var(--borderLight)'}` }}>Heute</button>
          <button onClick={() => { const d = new Date(canvasDate); d.setDate(d.getDate() + 1); setCanvasDate(d.toISOString().split('T')[0]) }} style={s.navBtn}>→</button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={canvasRef} style={{ position: 'relative', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, height: 'calc(100vh - 240px)', minHeight: 400, overflow: 'hidden', touchAction: editingTable ? 'none' : 'auto' }}
        onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
        onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}>
        {zoneTables.map(table => {
          const status = getTableStatus(table)
          const color = STATUS_COLORS[status]
          const tOrd = orders[table.name] || []
          const tTot = tOrd.reduce((s, o) => s + o.product_price * (o.quantity || 1), 0)
          const w = table.w || 80; const h = table.h || 80
          const isEditing = editingTable === table.id
          return (
            <div key={table.id}
              onMouseDown={e => isEditing ? handlePointerDown(e, table) : null}
              onTouchStart={e => isEditing ? handlePointerDown(e, table) : null}
              onClick={() => !isEditing && handleTableClick(table)}
              style={{ position: 'absolute', left: table.x_pos || 100, top: table.y_pos || 100, width: w, height: h, borderRadius: table.shape === 'round' ? '50%' : 10,
                background: `${color}20`, border: isEditing ? '2px dashed #f59e0b' : `2px solid ${color}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: isEditing ? 'grab' : 'pointer',
                boxShadow: isEditing ? '0 0 12px rgba(245,158,11,0.3)' : selected?.id === table.id ? `0 0 0 2px ${color}` : 'none',
                userSelect: 'none', transition: isEditing ? 'none' : 'box-shadow 0.15s',
                animation: isEditing ? 'pulse 1.5s ease-in-out infinite' : 'none' }}>
              <div style={{ fontSize: w > 90 ? 18 : 16, fontWeight: 600, color: 'var(--text)' }}>{table.name}</div>
              <div style={{ fontSize: 9, color: 'var(--textMuted)' }}>{table.seats}P</div>
              {status === 'reserved' && !isEditing && (() => {
                const res = reservations.find(r => (r.table_id === table.id || r.table_name === table.name || (r.combined_tables && r.combined_tables.includes(table.name))) && r.status === 'confirmed')
                return res ? <>
                  <div style={{ fontSize: 8, color: '#3b82f6', fontWeight: 600, marginTop: 1 }}>{res.time}</div>
                  <div style={{ fontSize: 7, color: '#3b82f6', maxWidth: w - 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{res.guest_name}</div>
                  {res.combined_tables && res.combined_tables.length > 1 && <div style={{ fontSize: 6, color: '#3b82f6', opacity: 0.7 }}>Kombi</div>}
                </> : null
              })()}
              {status === 'pending' && !isEditing && (() => {
                const res = reservations.find(r => (r.table_id === table.id || r.table_name === table.name) && r.status === 'pending')
                return res ? <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginTop: 1 }}>Anfrage</div> : null
              })()}
              {tTot > 0 && !isEditing && status !== 'reserved' && status !== 'pending' && <div style={{ fontSize: 8, color: '#10b981', fontWeight: 500, marginTop: 1 }}>{tTot.toFixed(0)}€</div>}
              {isEditing && <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 500, marginTop: 1 }}>{w}px</div>}
            </div>
          )
        })}
        {zoneTables.length === 0 && !loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--textDim)', fontSize: 13 }}>Keine Tische — klicke "+ Neuer Tisch"</div>}

        {/* Editing mode banner */}
        {editingTable && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(0,0,0,0.85)', borderRadius: 12, padding: '10px 20px', zIndex: 10 }}>
            <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 500 }}>Bearbeitungsmodus — Tisch verschieben oder mit 2 Fingern skalieren</div>
            <button onClick={saveEditing} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Fertig</button>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selected && !showPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} onClick={() => setSelected(null)}>
          <div style={{ position: 'fixed', right: 0, top: 0, width: 420, height: '100vh', background: 'var(--bgSec)', borderLeft: '1px solid var(--border)', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Tisch {selected.name}</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'var(--bgCard)', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 14, cursor: 'pointer', color: 'var(--textMuted)' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {[['info','Info'],['order','Bestellung']].map(([k,l]) => (
                <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                  background: tab === k ? 'var(--bgCard)' : 'transparent', color: tab === k ? 'var(--text)' : 'var(--textMuted)', borderBottom: tab === k ? '2px solid var(--text)' : '2px solid transparent' }}>{l}</button>
              ))}
            </div>

            {/* Info Tab */}
            {tab === 'info' && <div style={{ padding: '16px 20px' }}>
              {[['Kapazität', `${selected.seats} Personen`],['Form', selected.shape === 'round' ? 'Rund' : 'Eckig'],['Bereich', selected.location],['Status', selected.status === 'occupied' ? 'Besetzt' : selected.status === 'reserved' ? 'Reserviert' : 'Frei']].map(([l,v],i) =>
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}><span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{l}</span><span style={{ fontSize: 12, color: 'var(--textSec)' }}>{v}</span></div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {selected.status !== 'occupied' && <button style={s.actBtn} onClick={() => { toggleStatus(selected, 'occupied'); setSelected({ ...selected, status: 'occupied' }) }}>Als besetzt markieren</button>}
                {selected.status === 'occupied' && <button style={s.actBtn} onClick={() => { toggleStatus(selected, 'free'); setSelected({ ...selected, status: 'free' }) }}>Als frei markieren</button>}
                <button style={{ ...s.actBtn, background: '#3b82f6', color: '#fff', border: 'none' }} onClick={() => setShowReserve(selected)}>Reservierung</button>
              </div>

              {/* Edit Table */}
              <div style={{ marginTop: 20, padding: '14px 0', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => startEditing(selected)} style={{ width: '100%', padding: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 12, color: '#f59e0b', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Tisch bearbeiten</button>
              </div>

              <button style={{ width: '100%', marginTop: 12, padding: 10, background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 11, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => deleteTable(selected)}>Tisch löschen</button>
            </div>}

            {/* Order Tab */}
            {tab === 'order' && <div style={{ padding: '16px 20px' }}>
              {selected.status !== 'occupied' ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--textDim)', fontSize: 13 }}>
                  Tisch muss "Besetzt" sein.<br/>
                  <button onClick={() => { toggleStatus(selected, 'occupied'); setSelected({ ...selected, status: 'occupied' }) }} style={{ marginTop: 10, padding: '8px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Als besetzt markieren</button>
                </div>
              ) : <>
                {/* Current Order */}
                {tableOrders.length > 0 && <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Bestellung</div>
                  {tableOrders.map((o, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border,#111)', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--textSec)', flex: 1 }}>{o.quantity || 1}x {o.product_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{(o.product_price * (o.quantity || 1)).toFixed(2)}€</span>
                      <button onClick={() => removeProduct(o)} style={{ width: 22, height: 22, borderRadius: 4, background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 600 }}>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>Gesamt</span>
                    <span style={{ fontSize: 14, color: 'var(--text)' }}>{tableTotal.toFixed(2)}€</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={sendToKitchen} style={{ flex: 1, padding: 10, background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>An Küche senden</button>
                    <button onClick={() => setShowPayment({ pending: true })} style={{ flex: 1, padding: 10, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Abrechnen & freigeben</button>
                  </div>
                </div>}
                {/* Product Catalog */}
                <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Produkt hinzufügen</div>
                {Object.entries(PRODUCTS).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '5px 0', borderBottom: '1px solid var(--border,#111)' }}>{cat}</div>
                    {items.map(([name, price], i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--bg,#0a0a0a)', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--textSec)', flex: 1 }}>{name}</span>
                        <span style={{ fontSize: 11, color: 'var(--textDim)' }}>{price.toFixed(2)}€</span>
                        <button onClick={() => addProduct(name, price)} style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    ))}
                  </div>
                ))}
              </>}
            </div>}
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      {showPayment && showPayment.pending && (
        <PaymentDialog table={selected} orders={tableOrders} total={tableTotal}
          onPay={(method, detail) => { setShowPayment(null); handleCheckout(method, detail) }}
          onCancel={() => setShowPayment(null)} />
      )}

      {/* Receipt Success */}
      {showPayment && !showPayment.pending && (
        <div style={s.overlay} onClick={() => { setShowPayment(null); setSelected(null) }}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 16, color: 'var(--text)', fontWeight: 500 }}>Bezahlt — {showPayment.total.toFixed(2)}€</div>
              <div style={{ fontSize: 12, color: 'var(--textMuted)', marginTop: 4 }}>Tisch {showPayment.table} · {showPayment.method}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.cancelBtn} onClick={() => { setShowPayment(null); setSelected(null) }}>Schließen</button>
              <button style={s.saveBtn} onClick={() => printReceipt(showPayment)}>Bon drucken</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && <AddTableModal onSave={addTable} onCancel={() => setShowAdd(false)} />}
      {showReserve && <AddReservationModal table={showReserve} onSave={async (data) => {
        await supabase.from('restaurant_reservations').insert({ table_id: showReserve.id, table_name: showReserve.name, guest_name: data.guest, date: new Date().toISOString().split('T')[0], time: data.time, party_size: data.party, notes: data.notes || null })
        setShowReserve(null); load()
      }} onCancel={() => setShowReserve(null)} />}
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      </>}

      {/* ====== RESERVIERUNGEN VIEW ====== */}
      {mainView === 'reservierungen' && <>
        {/* View Tabs + Date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['tag', 'Tag'], ['woche', 'Woche'], ['monat', 'Monat']].map(([k, l]) => (
              <button key={k} onClick={() => setResView(k)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                background: resView === k ? 'var(--text)' : 'var(--bgCard)',
                color: resView === k ? 'var(--bg)' : 'var(--textMuted)',
                border: `1px solid ${resView === k ? 'var(--text)' : 'var(--borderLight)'}`,
              }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => { const d = new Date(resDate); d.setDate(d.getDate() - (resView === 'monat' ? 30 : resView === 'woche' ? 7 : 1)); setResDate(d.toISOString().split('T')[0]) }} style={s.navBtn}>←</button>
            <input type="date" value={resDate} onChange={e => setResDate(e.target.value)} style={{ padding: '6px 10px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--text)', fontFamily: 'inherit' }} />
            <button onClick={() => setResDate(new Date().toISOString().split('T')[0])} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textMuted)' }}>Heute</button>
            <button onClick={() => { const d = new Date(resDate); d.setDate(d.getDate() + (resView === 'monat' ? 30 : resView === 'woche' ? 7 : 1)); setResDate(d.toISOString().split('T')[0]) }} style={s.navBtn}>→</button>
          </div>
        </div>

        {/* Day View */}
        {resView === 'tag' && (() => {
          const dayRes = allReservations.filter(r => r.date === resDate)
          const SLOTS = ['12:00','12:30','13:00','13:30','14:00','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30']
          return <>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 10 }}>{new Date(resDate + 'T00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} — {dayRes.length} Reservierungen</div>
            {dayRes.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--textDim)', fontSize: 13, background: 'var(--bgCard)', borderRadius: 10 }}>Keine Reservierungen für diesen Tag</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dayRes.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, borderLeft: `4px solid ${r.status === 'cancelled' ? '#ef4444' : r.status === 'seated' ? '#10b981' : '#3b82f6'}` }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#3b82f6', minWidth: 50 }}>{r.time}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{r.guest_name} {r.room && <span style={{ fontSize: 10, color: 'var(--textDim)' }}>Zi. {r.room}</span>}</div>
                      <div style={{ fontSize: 11, color: 'var(--textMuted)' }}>{r.persons} Pers. {r.table_name && `· Tisch ${r.table_name}`} {r.special_requests && `· ${r.special_requests}`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {r.status !== 'seated' && r.status !== 'cancelled' && (
                        <button onClick={async () => { await supabase.from('restaurant_reservations').update({ status: 'seated' }).eq('id', r.id); load() }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>Platziert</button>
                      )}
                      {r.status !== 'cancelled' && (
                        <button onClick={() => { setReassignRes(r); setReassignTables(r.combined_tables && r.combined_tables.length > 0 ? [...r.combined_tables] : r.table_name ? [r.table_name] : []) }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>Tisch ändern</button>
                      )}
                      {r.status !== 'cancelled' && (
                        <button onClick={async () => { await supabase.from('restaurant_reservations').update({ status: 'cancelled' }).eq('id', r.id); load() }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>Storno</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        })()}

        {/* Week View */}
        {resView === 'woche' && (() => {
          const startDate = new Date(resDate)
          startDate.setDate(startDate.getDate() - startDate.getDay() + 1)
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startDate); d.setDate(d.getDate() + i)
            return d.toISOString().split('T')[0]
          })
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {days.map(day => {
                const dayRes = allReservations.filter(r => r.date === day)
                const isToday = day === new Date().toISOString().split('T')[0]
                return (
                  <div key={day} onClick={() => { setResDate(day); setResView('tag') }} style={{
                    background: 'var(--bgCard)', border: `1px solid ${isToday ? '#3b82f6' : 'var(--borderLight)'}`, borderRadius: 10, padding: 12, cursor: 'pointer', minHeight: 120,
                  }}>
                    <div style={{ fontSize: 10, color: isToday ? '#3b82f6' : 'var(--textMuted)', fontWeight: 500 }}>{new Date(day + 'T00:00').toLocaleDateString('de-DE', { weekday: 'short' })}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: isToday ? '#3b82f6' : 'var(--text)' }}>{new Date(day + 'T00:00').getDate()}</div>
                    {dayRes.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {dayRes.slice(0, 4).map(r => (
                          <div key={r.id} style={{ fontSize: 9, color: r.status === 'cancelled' ? '#ef4444' : '#3b82f6', background: r.status === 'cancelled' ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.06)', padding: '2px 5px', borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.time} {r.guest_name?.split(' ')[0]}
                          </div>
                        ))}
                        {dayRes.length > 4 && <div style={{ fontSize: 9, color: 'var(--textDim)' }}>+{dayRes.length - 4} weitere</div>}
                      </div>
                    )}
                    {dayRes.length === 0 && <div style={{ fontSize: 9, color: 'var(--textDim)', marginTop: 8 }}>—</div>}
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* Month View */}
        {resView === 'monat' && (() => {
          const d = new Date(resDate)
          const year = d.getFullYear(); const month = d.getMonth()
          const firstDay = new Date(year, month, 1).getDay() || 7
          const daysInMonth = new Date(year, month + 1, 0).getDate()
          const cells = []
          for (let i = 1; i < firstDay; i++) cells.push(null)
          for (let i = 1; i <= daysInMonth; i++) cells.push(i)
          return <>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 10 }}>{d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => <div key={d} style={{ fontSize: 10, color: 'var(--textDim)', textAlign: 'center', padding: 4 }}>{d}</div>)}
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const count = allReservations.filter(r => r.date === dateStr).length
                const isToday = dateStr === new Date().toISOString().split('T')[0]
                return (
                  <div key={i} onClick={() => { setResDate(dateStr); setResView('tag') }} style={{
                    padding: '8px 4px', textAlign: 'center', cursor: 'pointer', borderRadius: 8,
                    background: isToday ? 'rgba(59,130,246,0.1)' : count > 0 ? 'var(--bgCard)' : 'transparent',
                    border: isToday ? '1px solid #3b82f6' : '1px solid transparent',
                  }}>
                    <div style={{ fontSize: 13, color: isToday ? '#3b82f6' : 'var(--text)', fontWeight: isToday ? 600 : 400 }}>{day}</div>
                    {count > 0 && <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 500 }}>{count} Res.</div>}
                  </div>
                )
              })}
            </div>
          </>
        })()}
      </>}

      {/* ====== REASSIGN TABLE MODAL ====== */}
      {reassignRes && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setReassignRes(null)}>
          <div style={{ background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Tisch ändern</h3>
              <button onClick={() => setReassignRes(null)} style={{ background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ padding: '10px 14px', background: 'var(--bgCard)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{reassignRes.guest_name} — {reassignRes.persons} Pers.</div>
              <div style={{ fontSize: 11, color: 'var(--textMuted)', marginTop: 2 }}>{reassignRes.date} um {reassignRes.time} · Aktuell: {reassignRes.combined_tables ? reassignRes.combined_tables.join(', ') : reassignRes.table_name || 'Kein Tisch'}</div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Neuen Tisch wählen (mehrfach möglich)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {tables.filter(t => t.active !== false).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(t => {
                const isSelected = reassignTables.includes(t.name)
                return (
                  <button key={t.id} onClick={() => setReassignTables(prev => isSelected ? prev.filter(n => n !== t.name) : [...prev, t.name])} style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    background: isSelected ? 'rgba(59,130,246,0.1)' : 'var(--bgCard)',
                    color: isSelected ? '#3b82f6' : 'var(--textMuted)',
                    border: `2px solid ${isSelected ? '#3b82f6' : 'var(--borderLight)'}`,
                    fontWeight: isSelected ? 600 : 400,
                  }}>
                    {t.name} <span style={{ fontSize: 9, opacity: 0.7 }}>({t.seats}P)</span>
                  </button>
                )
              })}
            </div>

            {reassignTables.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)', borderRadius: 8, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{reassignTables.length} Tisch{reassignTables.length > 1 ? 'e' : ''}: {reassignTables.join(', ')}</span>
                <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>{tables.filter(t => reassignTables.includes(t.name)).reduce((s, t) => s + t.seats, 0)} Plätze</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setReassignRes(null)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button disabled={reassignTables.length === 0} onClick={async () => {
                await supabase.from('restaurant_reservations').update({
                  table_name: reassignTables[0],
                  combined_tables: reassignTables.length > 1 ? reassignTables : null,
                }).eq('id', reassignRes.id)
                setReassignRes(null); setReassignTables([]); load()
              }} style={{ flex: 1, padding: 12, background: reassignTables.length > 0 ? '#3b82f6' : 'var(--bgCard)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: reassignTables.length > 0 ? '#fff' : 'var(--textDim)', cursor: reassignTables.length > 0 ? 'pointer' : 'default', fontFamily: 'inherit' }}>Tisch zuweisen</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== CONFIRM PENDING - TABLE SELECTION MODAL ====== */}
      {confirmPending && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setConfirmPending(null)}>
          <div style={{ background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Gruppenreservierung bestätigen</h3>
              <button onClick={() => setConfirmPending(null)} style={{ background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Reservation info */}
            <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{confirmPending.guest_name} — {confirmPending.persons} Personen</div>
              <div style={{ fontSize: 11, color: 'var(--textMuted)', marginTop: 4 }}>{confirmPending.date} um {confirmPending.time} {confirmPending.room && `· Zi. ${confirmPending.room}`}</div>
              {confirmPending.special_requests && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>Wünsche: {confirmPending.special_requests}</div>}
              {confirmPending.phone && <div style={{ fontSize: 11, color: 'var(--textDim)', marginTop: 4 }}>WhatsApp: {confirmPending.phone}</div>}
            </div>

            {/* Table Selection */}
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tische zuweisen (mehrfach auswählen)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {tables.filter(t => t.active !== false).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(t => {
                const isSelected = selectedTables.includes(t.name)
                return (
                  <button key={t.id} onClick={() => setSelectedTables(prev => isSelected ? prev.filter(n => n !== t.name) : [...prev, t.name])} style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    background: isSelected ? 'rgba(16,185,129,0.1)' : 'var(--bgCard)',
                    color: isSelected ? '#10b981' : 'var(--textMuted)',
                    border: `2px solid ${isSelected ? '#10b981' : 'var(--borderLight)'}`,
                    fontWeight: isSelected ? 600 : 400,
                  }}>
                    {t.name} <span style={{ fontSize: 9, opacity: 0.7 }}>({t.seats}P)</span>
                  </button>
                )
              })}
            </div>

            {/* Selected summary */}
            {selectedTables.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: 8, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{selectedTables.length} Tisch{selectedTables.length > 1 ? 'e' : ''}: {selectedTables.join(', ')}</span>
                <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>{tables.filter(t => selectedTables.includes(t.name)).reduce((s, t) => s + t.seats, 0)} Plätze</span>
              </div>
            )}

            {/* Warning if not enough seats */}
            {selectedTables.length > 0 && tables.filter(t => selectedTables.includes(t.name)).reduce((s, t) => s + t.seats, 0) < confirmPending.persons && (
              <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 8, marginBottom: 14, fontSize: 11, color: '#ef4444' }}>
                Nicht genug Plätze — {confirmPending.persons} Personen benötigt, nur {tables.filter(t => selectedTables.includes(t.name)).reduce((s, t) => s + t.seats, 0)} verfügbar
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmPending(null)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button disabled={selectedTables.length === 0} onClick={async () => {
                const mainTable = selectedTables[0]
                await supabase.from('restaurant_reservations').update({
                  status: 'confirmed', confirmed_at: new Date().toISOString(),
                  table_name: mainTable,
                  combined_tables: selectedTables.length > 1 ? selectedTables : null,
                }).eq('id', confirmPending.id)
                // Notify guest via Make.com webhook if phone exists
                if (confirmPending.phone) {
                  try {
                    await fetch('https://hook.eu2.make.com/x5eftnx9civodo7alkguytwyiecid31f', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'confirm_reservation',
                        phone: confirmPending.phone,
                        guest_name: confirmPending.guest_name,
                        date: confirmPending.date,
                        time: confirmPending.time,
                        persons: confirmPending.persons,
                        tables: selectedTables.join(', '),
                        language: confirmPending.language || 'german',
                      })
                    })
                  } catch (e) { console.log('Webhook notification failed:', e) }
                }
                setConfirmPending(null); setSelectedTables([]); load()
              }} style={{ flex: 1, padding: 12, background: selectedTables.length > 0 ? '#10b981' : 'var(--bgCard)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: selectedTables.length > 0 ? '#fff' : 'var(--textDim)', cursor: selectedTables.length > 0 ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                Bestätigen{confirmPending.phone ? ' & Gast benachrichtigen' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== NEW RESERVATION MODAL ====== */}
      {showNewRes && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowNewRes(false)}>
          <div style={{ background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Neue Reservierung</h3>
              <button onClick={() => setShowNewRes(false)} style={{ background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <label style={s.formLabel}>Gastname</label>
            <input style={s.formInput} placeholder="Name des Gastes" value={newRes.guest_name} onChange={e => setNewRes(p => ({ ...p, guest_name: e.target.value }))} />

            <label style={s.formLabel}>Zimmernummer (optional)</label>
            <input style={s.formInput} placeholder="z.B. 101" value={newRes.room} onChange={e => setNewRes(p => ({ ...p, room: e.target.value }))} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={s.formLabel}>Datum</label><input style={s.formInput} type="date" value={newRes.date} onChange={e => setNewRes(p => ({ ...p, date: e.target.value }))} /></div>
              <div><label style={s.formLabel}>Uhrzeit</label><select style={s.formInput} value={newRes.time} onChange={e => setNewRes(p => ({ ...p, time: e.target.value }))}>
                {['12:00','12:30','13:00','13:30','14:00','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30'].map(t => <option key={t} value={t}>{t}</option>)}
              </select></div>
            </div>

            <label style={s.formLabel}>Personen</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[1,2,3,4,5,6,7,8].map(n => (
                <button key={n} onClick={() => setNewRes(p => ({ ...p, persons: n }))} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, textAlign: 'center',
                  background: newRes.persons === n ? 'rgba(59,130,246,0.1)' : 'var(--bgCard)',
                  color: newRes.persons === n ? '#3b82f6' : 'var(--textMuted)',
                  border: `2px solid ${newRes.persons === n ? '#3b82f6' : 'var(--borderLight)'}`,
                }}>{n}</button>
              ))}
            </div>

            <label style={s.formLabel}>Sonderwünsche (optional)</label>
            <input style={s.formInput} placeholder="z.B. Fensterplatz, Geburtstag..." value={newRes.special_requests} onChange={e => setNewRes(p => ({ ...p, special_requests: e.target.value }))} />

            {/* Auto-assigned table preview */}
            {(() => {
              const available = tables.filter(t => t.active !== false && t.seats >= newRes.persons && !reservations.some(r => r.table_name === t.name && r.time === newRes.time && r.date === newRes.date && r.status !== 'cancelled'))
              const assigned = available.sort((a, b) => a.seats - b.seats)[0]
              return assigned ? (
                <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)', borderRadius: 8, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>Automatisch zugewiesen</span>
                  <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>Tisch {assigned.name} ({assigned.seats}P)</span>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: 8, marginBottom: 14, fontSize: 11, color: '#f59e0b' }}>Kein passender Tisch verfügbar für diese Zeit</div>
              )
            })()}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNewRes(false)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button disabled={!newRes.guest_name} onClick={async () => {
                const available = tables.filter(t => t.active !== false && t.seats >= newRes.persons && !reservations.some(r => r.table_name === t.name && r.time === newRes.time && r.date === newRes.date && r.status !== 'cancelled'))
                const assigned = available.sort((a, b) => a.seats - b.seats)[0]
                await supabase.from('restaurant_reservations').insert({
                  guest_name: newRes.guest_name, room: newRes.room || null, date: newRes.date, time: newRes.time,
                  persons: newRes.persons, special_requests: newRes.special_requests || null,
                  table_name: assigned?.name || null, status: 'confirmed', source: 'rezeption', booked_by: 'Rezeption',
                })
                setShowNewRes(false); setNewRes({ guest_name: '', room: '', date: new Date().toISOString().split('T')[0], time: '19:00', persons: 2, special_requests: '' }); load()
              }} style={{ flex: 1, padding: 12, background: newRes.guest_name ? '#3b82f6' : 'var(--bgCard)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: newRes.guest_name ? '#fff' : 'var(--textDim)', cursor: newRes.guest_name ? 'pointer' : 'default', fontFamily: 'inherit' }}>Reservierung anlegen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentDialog({ table, orders, total, onPay, onCancel }) {
  const [method, setMethod] = useState(null)
  const [roomNumber, setRoomNumber] = useState('')
  const [cardStep, setCardStep] = useState(0)
  const [stripeUrl, setStripeUrl] = useState(null)

  const startCard = async () => {
    setMethod('card'); setCardStep(1)
    try {
      const lineItems = orders.map(o => ({
        name: o.product_name,
        amount_cents: Math.round(o.product_price * (o.quantity || 1) * 100),
        quantity: 1,
      }))
      const origin = window.location.origin
      const { url } = await createCheckoutSession({
        lineItems,
        metadata: { type: 'restaurant', table: table.name },
        successUrl: `${origin}/?restaurant_paid=true`,
        cancelUrl: `${origin}/?restaurant_cancelled=true`,
      })
      setStripeUrl(url)
      setCardStep(2)
    } catch (e) {
      console.error('Stripe error:', e)
      // Fallback to simulated success
      setCardStep(2)
    }
  }

  return (
    <div style={s.overlay}><div style={{ ...s.modal, textAlign: 'center', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>

      {!method && <>
        <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Tisch {table.name} abrechnen</h3>
        <p style={{ fontSize: 24, fontWeight: 600, color: '#10b981', margin: '8px 0 20px' }}>{total.toFixed(2)}€</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={startCard} style={{ padding: '16px 12px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 6px' }}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>Karte</div>
            <div style={{ fontSize: 9, color: 'var(--textDim)', marginTop: 2 }}>Stripe Terminal</div>
          </button>
          <button onClick={() => setMethod('cash')} style={{ padding: '16px 12px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 6px' }}><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 8v2"/><circle cx="12" cy="12" r="9"/></svg>
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>Bar</div>
            <div style={{ fontSize: 9, color: 'var(--textDim)', marginTop: 2 }}>Barzahlung</div>
          </button>
          <button onClick={() => setMethod('room')} style={{ padding: '16px 12px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 6px' }}><path d="M3 21h18M9 8h1m-1 4h1m4-4h1m-1 4h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/></svg>
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>Zimmer</div>
            <div style={{ fontSize: 9, color: 'var(--textDim)', marginTop: 2 }}>Hotelgast</div>
          </button>
          <button onClick={() => setMethod('split')} style={{ padding: '16px 12px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 6px' }}><path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M12 3v18"/></svg>
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>Teilen</div>
            <div style={{ fontSize: 9, color: 'var(--textDim)', marginTop: 2 }}>Rechnung splitten</div>
          </button>
        </div>
        <button onClick={onCancel} style={{ width: '100%', padding: 10, background: 'transparent', border: '1px solid var(--modalBorder)', borderRadius: 8, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 12 }}>Abbrechen</button>
      </>}

      {method === 'card' && <>
        {cardStep === 1 && <>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(99,91,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'pulse 1.5s ease-in-out infinite' }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#635bff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 8px' }}>Zahlungslink wird erstellt...</h3>
          <p style={{ fontSize: 22, fontWeight: 600, color: '#635bff', margin: '12px 0' }}>{total.toFixed(2)}€</p>
        </>}
        {cardStep === 2 && <>
          {stripeUrl ? <>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Kartenzahlung</h3>
            <p style={{ fontSize: 22, fontWeight: 600, color: '#635bff', margin: '8px 0 16px' }}>{total.toFixed(2)}€</p>
            <QRCode value={stripeUrl} size={160} />
            <div style={{ marginTop: 12 }}>
              <a href={stripeUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '10px 24px', background: '#635bff', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Zum Bezahlen öffnen</a>
            </div>
            <button style={{ ...s.saveBtn, width: '100%', marginTop: 12 }} onClick={() => onPay('Stripe Kartenzahlung')}>Zahlung erhalten — Weiter</button>
          </> : <>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: '#10b981', margin: '0 0 8px' }}>Kartenzahlung</h3>
            <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: '4px 0 12px' }}>{total.toFixed(2)}€</p>
            <button style={{ ...s.saveBtn, width: '100%', marginTop: 8 }} onClick={() => onPay('Kartenzahlung')}>Weiter</button>
          </>}
        </>}
      </>}

      {method === 'cash' && <>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 8v2"/><circle cx="12" cy="12" r="9"/></svg>
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 8px' }}>Barzahlung</h3>
        {orders.map((o, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
            <span style={{ color: 'var(--textSec)' }}>{o.quantity || 1}x {o.product_name}</span>
            <span style={{ color: 'var(--textMuted)' }}>{(o.product_price * (o.quantity || 1)).toFixed(2)}€</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--modalBorder)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>Gesamt</span>
          <span style={{ fontSize: 18, color: '#10b981', fontWeight: 600 }}>{total.toFixed(2)}€</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => setMethod(null)} style={s.cancelBtn}>Zurück</button>
          <button onClick={() => onPay('Barzahlung')} style={{ ...s.saveBtn, background: '#10b981', color: '#fff' }}>Bar kassiert</button>
        </div>
      </>}

      {method === 'room' && <>
        <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Auf Zimmer buchen</h3>
        <p style={{ fontSize: 22, fontWeight: 600, color: '#8b5cf6', margin: '8px 0 16px' }}>{total.toFixed(2)}€</p>
        <input style={{ width: '100%', padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--modalBorder)', borderRadius: 10, fontSize: 18, color: 'var(--text)', textAlign: 'center', outline: 'none', boxSizing: 'border-box', letterSpacing: 4, marginBottom: 8, fontFamily: 'inherit' }}
          placeholder="Zimmernummer" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} />
        <p style={{ fontSize: 10, color: 'var(--textDim)', marginBottom: 12 }}>Erscheint auf der Zimmerrechnung beim Check-out</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMethod(null)} style={s.cancelBtn}>Zurück</button>
          <button onClick={() => onPay(`Zimmer ${roomNumber}`, { room: roomNumber })} style={{ ...s.saveBtn, background: '#8b5cf6', color: '#fff', opacity: !roomNumber ? 0.4 : 1 }} disabled={!roomNumber}>Buchen</button>
        </div>
      </>}

      {method === 'split' && <>
        <div style={{ fontSize: 13, color: 'var(--textMuted)', padding: 16 }}>Split-Funktion kommt in der nächsten Version</div>
        <button onClick={() => setMethod(null)} style={s.cancelBtn}>Zurück</button>
      </>}

    </div></div>
  )
}

function AddTableModal({ onSave, onCancel }) {
  const [name, setName] = useState(''); const [seats, setSeats] = useState(4); const [shape, setShape] = useState('round')
  return (
    <div style={s.overlay} onClick={onCancel}><div style={s.modal} onClick={e => e.stopPropagation()}>
      <h3 style={{ fontSize: 16, color: 'var(--text)', margin: '0 0 16px', fontWeight: 500 }}>Neuer Tisch</h3>
      <label style={s.label}>Name / Nummer</label><input style={s.input} placeholder="z.B. 1 oder Fensterplatz" value={name} onChange={e => setName(e.target.value)} />
      <label style={s.label}>Kapazität</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[2, 4, 6, 8].map(n => <button key={n} onClick={() => setSeats(n)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--borderLight)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', background: seats === n ? 'var(--text)' : 'var(--bgCard)', color: seats === n ? 'var(--bg)' : 'var(--textMuted)' }}>{n}P</button>)}
      </div>
      <label style={s.label}>Form</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['round','Rund'],['square','Eckig']].map(([v,l]) => <button key={v} onClick={() => setShape(v)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--borderLight)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', background: shape === v ? 'var(--text)' : 'var(--bgCard)', color: shape === v ? 'var(--bg)' : 'var(--textMuted)' }}>{l}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={s.cancelBtn} onClick={onCancel}>Abbrechen</button>
        <button style={{ ...s.saveBtn, opacity: !name ? 0.4 : 1 }} disabled={!name} onClick={() => onSave({ name, seats, shape })}>Tisch anlegen</button>
      </div>
    </div></div>
  )
}

function AddReservationModal({ table, onSave, onCancel }) {
  const [guest, setGuest] = useState(''); const [time, setTime] = useState('19:00'); const [party, setParty] = useState(2); const [notes, setNotes] = useState('')
  return (
    <div style={s.overlay} onClick={onCancel}><div style={s.modal} onClick={e => e.stopPropagation()}>
      <h3 style={{ fontSize: 16, color: 'var(--text)', margin: '0 0 16px', fontWeight: 500 }}>Reservierung — Tisch {table.name}</h3>
      <label style={s.label}>Gastname</label><input style={s.input} placeholder="Name" value={guest} onChange={e => setGuest(e.target.value)} />
      <label style={s.label}>Uhrzeit</label><input style={s.input} type="time" value={time} onChange={e => setTime(e.target.value)} />
      <label style={s.label}>Personen</label><input style={s.input} type="number" min="1" max="20" value={party} onChange={e => setParty(parseInt(e.target.value))} />
      <label style={s.label}>Notizen</label><input style={s.input} placeholder="z.B. Geburtstag" value={notes} onChange={e => setNotes(e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={s.cancelBtn} onClick={onCancel}>Abbrechen</button>
        <button style={{ ...s.saveBtn, opacity: !guest ? 0.4 : 1 }} disabled={!guest} onClick={() => onSave({ guest, time, party, notes })}>Reservieren</button>
      </div>
    </div></div>
  )
}

function CanvasDatePicker({ value, onChange, allReservations }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(value); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  useEffect(() => {
    const d = new Date(value)
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [value])

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay() || 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 1; i < firstDay; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)

  const today = new Date().toISOString().split('T')[0]
  const selectedDate = new Date(value + 'T00:00')
  const displayLabel = selectedDate.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        padding: '5px 12px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8,
        fontSize: 11, color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500, minWidth: 100,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>{displayLabel}</span>
        <span style={{ fontSize: 8, color: 'var(--textDim)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 60,
          background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 14,
          padding: 14, width: 280, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}>
          {/* Month nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'var(--textMuted)', fontSize: 14, cursor: 'pointer', padding: '2px 8px' }}>←</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              {viewMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'var(--textMuted)', fontSize: 14, cursor: 'pointer', padding: '2px 8px' }}>→</button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
              <div key={d} style={{ fontSize: 9, color: 'var(--textDim)', textAlign: 'center', padding: 2, fontWeight: 500 }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const resCount = allReservations.filter(r => r.date === dateStr && r.status !== 'cancelled').length
              const isToday = dateStr === today
              const isSelected = dateStr === value
              const isPast = dateStr < today

              return (
                <button key={i} onClick={() => { onChange(dateStr); setOpen(false) }} style={{
                  padding: '4px 2px', textAlign: 'center', cursor: 'pointer', borderRadius: 8, border: 'none',
                  background: isSelected ? '#3b82f6' : isToday ? 'rgba(59,130,246,0.12)' : 'transparent',
                  opacity: isPast ? 0.4 : 1, fontFamily: 'inherit', minHeight: 36,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: isSelected || isToday ? 600 : 400,
                    color: isSelected ? '#fff' : isToday ? '#3b82f6' : 'var(--text)',
                  }}>{day}</div>
                  {resCount > 0 && (
                    <div style={{
                      fontSize: 8, fontWeight: 600, marginTop: 1, lineHeight: 1,
                      color: isSelected ? 'rgba(255,255,255,0.85)' : '#3b82f6',
                    }}>{resCount}</div>
                  )}
                  {resCount === 0 && <div style={{ fontSize: 8, marginTop: 1, lineHeight: 1, color: 'transparent' }}>·</div>}
                </button>
              )
            })}
          </div>

          {/* Quick jump to today */}
          {value !== today && (
            <button onClick={() => { onChange(today); setOpen(false) }} style={{
              width: '100%', marginTop: 8, padding: '6px 0', background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, fontSize: 10, color: '#3b82f6',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            }}>Heute</button>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  addBtn: { padding: '8px 16px', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  actBtn: { flex: 1, padding: 10, background: 'var(--bg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 11, color: 'var(--textSec)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg)', border: '1px solid var(--modalBorder)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440 },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '10px 14px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 16, fontFamily: 'inherit' },
  cancelBtn: { flex: 1, padding: 10, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  saveBtn: { flex: 1, padding: 10, background: 'var(--text)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  formLabel: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  formInput: { width: '100%', padding: '10px 12px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit' },
  navBtn: { padding: '6px 10px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textMuted)' },
}
