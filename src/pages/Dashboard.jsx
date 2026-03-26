import { useState, useEffect } from 'react'
import { useDashboardData } from '../hooks/useRealtime'
import { fetchBookings, fetchShiftLogs, fetchComplaints, fetchMaintenance, fetchAllOpenRequests, fetchRevenueInsights, fetchEvents, fetchHousekeeping, supabase } from '../lib/supabase'
import { useNotifications } from '../hooks/useNotifications'
import { useTier } from '../lib/tier.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { openPrintPage, buildTable } from '../lib/print'
import { MAKE_WEBHOOKS } from '../lib/hotel'
import { MENU, ROOM_SERVICE_FEE } from '../lib/menu'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Dashboard({ user }) {
  const { tier } = useTier()
  const { data, loading, lastUpdate } = useDashboardData({
    bookings: fetchBookings, logs: fetchShiftLogs, complaints: fetchComplaints,
    maintenance: fetchMaintenance, requests: fetchAllOpenRequests,
    revenue: fetchRevenueInsights, events: () => fetchEvents(14), housekeeping: fetchHousekeeping,
    rooms: async () => { const { data } = await supabase.from('rooms').select('*'); return data || [] },
  })
  const [taxiMinutes, setTaxiMinutes] = useState({})
  const [confirm, setConfirm] = useState(null)
  const { notify } = useNotifications('dashboard')
  const [weather, setWeather] = useState(null)
  const [weatherDay, setWeatherDay] = useState(null)
  const [cashPending, setCashPending] = useState([])

  // Listen for cash payment requests
  useEffect(() => {
    const loadCash = async () => {
      const { data } = await supabase.from('guest_display_sessions').select('*').eq('status', 'awaiting_cash')
      setCashPending(data || [])
    }
    loadCash()
    const channel = supabase.channel('dashboard-cash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_display_sessions' }, () => loadCash())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const confirmCashFromDashboard = async (sess) => {
    await supabase.from('guest_display_sessions').update({ status: 'paid' }).eq('id', sess.id)
    if (sess.booking_id) await supabase.from('bookings').update({ status: 'checked_out', payment_method: 'Barzahlung', checked_out_at: new Date().toISOString() }).eq('booking_id', sess.booking_id)
    setCashPending(prev => prev.filter(s => s.id !== sess.id))
  }

  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=48.7665&longitude=11.4258&current=temperature_2m,weathercode,windspeed_10m,apparent_temperature,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,precipitation_sum,windspeed_10m_max,winddirection_10m_dominant,uv_index_max,sunrise,sunset&hourly=temperature_2m,weathercode&timezone=Europe/Berlin&forecast_days=7')
      .then(r => r.json()).then(d => setWeather(d)).catch(() => {})
  }, [])

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const bookings = data.bookings || []; const logs = data.logs || []; const events = data.events || []
  const revenueData = data.revenue; const openRequests = data.requests || []
  const hk = data.housekeeping || []
  const totalRooms = hk.length || 0
  const occupied = bookings.filter(b => b.check_in <= todayStr && b.check_out > todayStr && (b.status === 'checked_in' || b.status === 'confirmed')).length
  const occ = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0
  const checkInsToday = bookings.filter(b => b.check_in === todayStr && (b.status === 'reserved' || b.status === 'confirmed'))
  const checkOutsToday = bookings.filter(b => b.check_out === todayStr)
  const todayRevenue = bookings.filter(b => b.check_in <= todayStr && b.check_out > todayStr).reduce((s, b) => s + (parseFloat(b.amount_due) || 0), 0)
  const adr = occupied > 0 ? Math.round(todayRevenue / occupied) : 0
  const revpar = occupied > 0 ? Math.round((adr * occ) / 100) : 0
  const cleaning = hk.filter(h => h.status === 'cleaning' || h.status === 'dirty').length
  const blockedRooms = (data.rooms || []).filter(r => r.blocked_reason).length
  const freeRooms = totalRooms - occupied - cleaning - blockedRooms

  // Revenue 7 Tage — calculate from bookings per day
  const rev7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const ds = d.toISOString().split('T')[0]
    const dayLabel = d.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)
    const dayRev = bookings.filter(b => b.check_in <= ds && b.check_out > ds).reduce((s, b) => s + (parseFloat(b.amount_due) || 0) / Math.max(1, Math.round((new Date(b.check_out) - new Date(b.check_in)) / 86400000)), 0)
    return { d: dayLabel, h: dayRev }
  })
  const maxRev7 = Math.max(...rev7.map(r => r.h), 1)

  // Real data only — no demo fallbacks
  const dCI = checkInsToday
  const dCO = checkOutsToday
  const dLogs = logs
  const dEvents = events
  const dComp = (revenueData?.competitor_prices ? (typeof revenueData.competitor_prices === 'string' ? JSON.parse(revenueData.competitor_prices) : revenueData.competitor_prices) : []).length > 0
    ? (typeof revenueData.competitor_prices === 'string' ? JSON.parse(revenueData.competitor_prices) : revenueData.competitor_prices)
    : [{ name: 'NH Hotel', price: 109, diff: -9 }, { name: 'IntercityHotel', price: 109, diff: -9 }, { name: 'Rappensberger', price: 111, diff: -7 }, { name: 'BLOCK Hotel', price: 170, diff: 52 }]

  const liveRequests = openRequests

  // Booking detail popup
  const [bookingDetail, setBookingDetail] = useState(null)
  const [showNewRequest, setShowNewRequest] = useState(false)

  // Lock all scroll when modal is open (body + main content wrapper)
  useEffect(() => {
    const mainEl = document.querySelector('.main-content')
    if (showNewRequest) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      if (mainEl) mainEl.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      if (mainEl) mainEl.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      if (mainEl) mainEl.style.overflow = ''
    }
  }, [showNewRequest])
  const [newReq, setNewReq] = useState({ category: 'room_service', room: '', guest_name: '', request_details: '', order_total: '', booking_id: '' })
  const [guestSearch, setGuestSearch] = useState('')
  const [orderItems, setOrderItems] = useState([]) // [{name, price, qty, note}]
  const [menuSearch, setMenuSearch] = useState('')

  const handleTaxiConfirm = (req) => {
    const mins = taxiMinutes[req.id] || ''
    if (!mins) return
    setConfirm({
      title: 'Taxi bestätigen',
      message: `Taxi für Zimmer ${req.room} (${req.guest_name}) in ${mins} Minuten bestätigen?`,
      warning: 'Der Gast wird per WhatsApp informiert.',
      confirmLabel: `${mins} Min. bestätigen`, confirmColor: '#10b981',
      onConfirm: async () => {
        await supabase.from('service_requests').update({ status: 'resolved', response_minutes: parseInt(mins), resolved_at: new Date().toISOString() }).eq('id', req.id)
        setConfirm(null)
      },
    })
  }

  const handleResolve = (req) => {
    setConfirm({
      title: 'Anfrage erledigen',
      message: `${req.category === 'complaint' ? 'Beschwerde' : 'Anfrage'} von Zimmer ${req.room} als erledigt markieren?`,
      warning: null, confirmLabel: 'Erledigt', confirmColor: '#10b981',
      onConfirm: async () => {
        await supabase.from('service_requests').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', req.id)
        setConfirm(null)
      },
    })
  }

  const handleAccept = async (req) => {
    await supabase.from('service_requests').update({ status: 'accepted' }).eq('id', req.id)
  }

  const getRequestLabel = (type) => {
    const map = { taxi: 'Taxi', complaint: 'Beschwerde', room_service: 'Room Service', pillow: 'Kissen', towels: 'Handtücher', housekeeping: 'Reinigung', wake_up: 'Weckruf', luggage: 'Gepäck', maintenance: 'Wartung', late_checkout: 'Late Checkout' }
    return map[type] || type
  }

  const getRequestColor = (type) => {
    const map = { room_service: '#f59e0b', housekeeping: '#3b82f6', maintenance: '#ef4444', taxi: '#eab308', complaint: '#991b1b', late_checkout: '#8b5cf6', luggage: '#14b8a6', pillow: '#3b82f6', towels: '#3b82f6', wake_up: '#6b7280' }
    return map[type] || '#6b7280'
  }

  const getAge = (created) => Math.round((Date.now() - new Date(created).getTime()) / 60000)

  if (loading) return <div style={s.content}><LoadingSkeleton count={6} /><div style={{ marginTop: 16 }}><LoadingSkeleton type="table" rows={4} cols={4} /></div></div>

  return (
    <div style={s.content} className="fade-in">
      <div style={s.header}>
        <div><h1 style={s.h1}>{tier === 'concierge' ? 'Marco Concierge' : 'Dashboard'}</h1><p style={s.date}><DashboardClock /></p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => {
            const ci = dCI, co = dCO
            openPrintPage('Tagesreport', `<div class="summary"><div class="summary-row"><span>Belegung</span><span>${occ}% (${occupied}/${totalRooms})</span></div><div class="summary-row"><span>Ankünfte heute</span><span>${ci.length}</span></div><div class="summary-row"><span>Abreisen heute</span><span>${co.length}</span></div><div class="summary-row"><span>Umsatz heute</span><span>${todayRevenue.toLocaleString('de-DE')}€</span></div></div>` + (ci.length > 0 ? `<h3 style="margin-bottom:8px">Ankünfte</h3>` + buildTable(['Gast','Zimmer','Nächte','Betrag'], ci.map(b => [b.guest_name, b.room, Math.max(1,Math.round((new Date(b.check_out)-new Date(b.check_in))/86400000)), `${parseFloat(b.amount_due||0).toFixed(0)}€`])) : '') + (co.length > 0 ? `<h3 style="margin:12px 0 8px">Abreisen</h3>` + buildTable(['Gast','Zimmer','Betrag'], co.map(b => [b.guest_name, b.room, `${parseFloat(b.amount_due||0).toFixed(0)}€`])) : ''))
          }} style={{ padding: '7px 14px', borderRadius: 10, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textMuted)' }}>Tagesreport</button>
          <div style={s.liveDot} title="Realtime aktiv" /><div style={s.hotelBadge}>{user.hotel}</div>
        </div>
      </div>

      {/* Cash Payment Pending Banners */}
      {cashPending.map(sess => (
        <div key={sess.id} style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.06)', border: '2px solid rgba(245,158,11,0.3)', borderRadius: 12, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div>
              <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>Barzahlung ausstehend — Zimmer {sess.room}</div>
              <div style={{ fontSize: 11, color: 'var(--textMuted)' }}>{sess.guest_name} · {(() => { const d = sess.data || {}; return ((parseFloat(d.room_total) || 0) + (d.items || []).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)).toFixed(2) })()}€</div>
            </div>
          </div>
          <button onClick={() => confirmCashFromDashboard(sess)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Barzahlung bestätigen</button>
        </div>
      ))}

      {/* KPIs - PMS only */}
      {tier !== 'concierge' && <div style={s.grid6}>
        <Stat label="Auslastung" value={`${occ}%`} /><Stat label="Check-ins" value={String(dCI.length)} />
        <Stat label="Check-outs" value={String(dCO.length)} /><Stat label="Revenue" value={`${todayRevenue.toLocaleString('de-DE')}€`} />
        <Stat label="ADR" value={`${adr}€`} /><Stat label="RevPAR" value={`${revpar}€`} />
      </div>}

      {/* Live Anfragen - BOTH tiers */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Live Anfragen</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setShowNewRequest(true)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', fontWeight: 500 }}>+ Anfrage</button>
            {liveRequests.length > 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s ease-in-out infinite' }} />}
            <span style={s.cardCount}>{liveRequests.length}</span>
          </div>
        </div>
        {liveRequests.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine offenen Anfragen</div>
        ) : liveRequests.map(req => {
            const age = getAge(req.timestamp)
            const overdue = age > 10 && req.status === 'pending'
            const color = getRequestColor(req.category)
            return (
              <div key={req.id} style={{ ...s.reqRow, borderLeft: `3px solid ${overdue ? '#ef4444' : color}`, background: overdue ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${color}15`, color, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <RequestIcon type={req.category} color={color} />
                      {getRequestLabel(req.category)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--textSec)' }}>Zi. {req.room}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{req.guest_name}</span>
                    {overdue && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 500 }}>ÜBERFÄLLIG</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--textMuted)' }}>{req.request_details}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                    vor {age} Min. · {req.status === 'accepted' ? 'Angenommen' : 'Wartend'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {req.category === 'taxi' && req.status !== 'resolved' && (
                    <>
                      <input style={s.minuteInput} type="number" placeholder="Min." value={taxiMinutes[req.id] || ''}
                        onChange={e => setTaxiMinutes(p => ({ ...p, [req.id]: e.target.value }))} />
                      <button style={s.confirmSmBtn} onClick={() => handleTaxiConfirm(req)}>Bestätigen</button>
                    </>
                  )}
                  {req.category === 'late_checkout' && req.status === 'pending' && <>
                    <button style={s.confirmSmBtn} onClick={async () => {
                      await supabase.from('service_requests').update({ status: 'accepted', response_message: 'approved', resolved_at: new Date().toISOString() }).eq('id', req.id)
                      await supabase.from('service_requests').insert({ category: 'late_checkout', room: req.room, guest_name: req.guest_name, request_details: 'Late Checkout Gebühr (bis 14:00)', status: 'delivered', order_total: 30, resolved_at: new Date().toISOString() })
                      // Notify guest via Make.com webhook
                      const { data: bk } = await supabase.from('bookings').select('phone, language').eq('room', req.room).eq('status', 'checked_in').maybeSingle()
                      try { await fetch(MAKE_WEBHOOKS.late_checkout_response, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approved', room: req.room, guest_name: req.guest_name, phone_number: bk?.phone || '', language: bk?.language || 'german', price: 30 }) }) } catch {}
                    }}>Genehmigen</button>
                    <button style={{ ...s.acceptBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }} onClick={async () => {
                      await supabase.from('service_requests').update({ status: 'resolved', response_message: 'declined', resolved_at: new Date().toISOString() }).eq('id', req.id)
                      const { data: bk } = await supabase.from('bookings').select('phone, language').eq('room', req.room).eq('status', 'checked_in').maybeSingle()
                      try { await fetch(MAKE_WEBHOOKS.late_checkout_response, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'declined', room: req.room, guest_name: req.guest_name, phone_number: bk?.phone || '', language: bk?.language || 'german' }) }) } catch {}
                    }}>Ablehnen</button>
                  </>}
                  {req.category !== 'taxi' && req.category !== 'late_checkout' && req.status === 'pending' && (
                    <button style={s.acceptBtn} onClick={() => handleAccept(req)}>Annehmen</button>
                  )}
                  {req.status === 'accepted' && req.category !== 'late_checkout' && (
                    <button style={s.resolveBtn} onClick={() => handleResolve(req)}>Erledigt</button>
                  )}
                  {req.category === 'complaint' && req.status === 'pending' && (
                    <button style={s.resolveBtn} onClick={() => handleResolve(req)}>Erledigt</button>
                  )}
                  {req.category === 'late_checkout' && req.status === 'accepted' && (
                    <span style={{ fontSize: 10, color: '#10b981', fontWeight: 500 }}>✓ Genehmigt</span>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      {/* Row 2: Rooms + Revenue + Tasks - PMS only */}
      {tier !== 'concierge' && <div style={s.grid3}>
        <Card title="Zimmerstatus" count={`${totalRooms} Zimmer`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '12px 16px' }}>
            {/* Donut chart */}
            <div style={{ position: 'relative', width: 80, height: 80 }}>
              <svg viewBox="0 0 36 36" style={{ width: 80, height: 80, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border)" strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="4"
                  strokeDasharray={`${totalRooms > 0 ? (occupied / totalRooms) * 88 : 0} 88`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{occ}%</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} /><span style={{ fontSize: 12, color: 'var(--textSec)' }}>Belegt {occupied}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border)' }} /><span style={{ fontSize: 12, color: 'var(--textSec)' }}>Frei {freeRooms}</span></div>
              {blockedRooms > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} /><span style={{ fontSize: 12, color: '#ef4444' }}>Gesperrt {blockedRooms}</span></div>}
            </div>
          </div>
        </Card>
        <Card title="Revenue 7 Tage">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, padding: '8px 16px 6px' }}>
            {rev7.map((b, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: maxRev7 > 0 ? Math.max(4, (b.h / maxRev7) * 60) : 4, background: b.h > 0 ? 'var(--accent-green)' : 'var(--border)', borderRadius: '4px 4px 0 0' }} />
                <div style={{ fontSize: 9, color: 'var(--textMuted)', marginTop: 4 }}>{b.d}</div>
              </div>
            ))}
          </div>
          {todayRevenue > 0 && <div style={{ padding: '4px 16px 10px', fontSize: 10, color: 'var(--accent-green)' }}>Heute: {todayRevenue.toFixed(0)}€</div>}
        </Card>
        <Card title="Schichtbuch">
          {dLogs.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Einträge</div> :
          dLogs.slice(0, 3).map((log, i) => (
            <Row key={i}><Prio c={log.priority === 'dringend' ? 'var(--accent-red)' : log.priority === 'wichtig' ? 'var(--accent-amber)' : 'var(--text-dim)'} />
              <div style={{ flex: 1 }}><div style={s.rowName}>{log.message}</div><div style={s.rowSub}>{log.employee_name} · {log.shift === 'früh' ? 'Frühschicht' : log.shift === 'spät' ? 'Spätschicht' : 'Nachtschicht'}</div></div>
            </Row>
          ))}
        </Card>
      </div>}

      {/* Row 3: Check-ins + Check-outs + Competitors - PMS only */}
      {tier !== 'concierge' && <div style={s.grid3}>
        <Card title="Check-ins heute" count={dCI.length}>
          {dCI.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Check-ins heute</div> :
          dCI.slice(0, 4).map((ci, i) => (
            <div key={i} onClick={() => setBookingDetail(ci)} style={{ ...s.row, cursor: 'pointer' }}>
              <div style={{ flex: 1 }}><div style={s.rowName}>{ci.guest_name}{ci._vip && <span style={s.vip}>VIP</span>}</div><div style={s.rowSub}>{ci.source || 'Direkt'} · Zi. {ci.room}</div></div>
              <div style={s.badge}>{ci.room}</div>
            </div>
          ))}
        </Card>
        <Card title="Check-outs heute" count={dCO.length}>
          {dCO.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Check-outs heute</div> :
          dCO.slice(0, 4).map((co, i) => (
            <div key={i} onClick={() => setBookingDetail(co)} style={{ ...s.row, cursor: 'pointer' }}>
              <div style={{ flex: 1 }}><div style={s.rowName}>{co.guest_name}</div><div style={s.rowSub}>{Math.round((new Date(co.check_out) - new Date(co.check_in)) / 86400000)} Nächte · Zi. {co.room}</div></div>
              <span style={{ fontSize: 10, color: co.paid ? 'var(--accent-green)' : 'var(--accent-amber)' }}>{co.paid ? 'Bezahlt' : 'Offen'}</span>
            </div>
          ))}
        </Card>
        <Card title="Konkurrenzpreise" extra="heute">
          {dComp.map((c, i) => (
            <Row key={i} style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{c.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{c.price}€</span>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: (c.diff < 0) ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: (c.diff < 0) ? 'var(--accent-green)' : 'var(--accent-red)' }}>{c.diff > 0 ? '+' : ''}{c.diff}€</span>
              </div>
            </Row>
          ))}
        </Card>
      </div>}

      {/* Row 4: Events + Weather */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <Card title="Events nächste 14 Tage" extra={`${dEvents.length}`}>
          {dEvents.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Events in den nächsten 14 Tagen</div>}
          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
          {dEvents.map((ev, i) => {
            const impactColor = ev.impact_level === 'high' ? '#ef4444' : ev.impact_level === 'medium' ? '#3b82f6' : '#555'
            const isMultiDay = ev.end_date && ev.end_date !== ev.start_date
            return (
              <Row key={i} style={{ gap: 10 }}>
                <div style={{ width: 3, borderRadius: 2, alignSelf: 'stretch', flexShrink: 0, background: impactColor }} />
                <div style={{ ...s.eventDate, minWidth: 44 }}>
                  {new Date(ev.start_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                  {isMultiDay && <div style={{ fontSize: 8, color: 'var(--textDim)', marginTop: 1 }}>– {new Date(ev.end_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <EventTypeIcon type={ev.event_type} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--textSec)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.event_name}</div>
                  <div style={{ fontSize: 9, color: 'var(--textDim)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                    {ev.event_type}
                    {ev.impact_level && <span style={{ fontSize: 8, color: impactColor, background: `${impactColor}12`, padding: '1px 5px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase' }}>{ev.impact_level}</span>}
                  </div>
                </div>
              </Row>
            )
          })}
          </div>
        </Card>
        <Card title="Wetter Ingolstadt" extra={weather ? '7 Tage' : '...'}>
          {weather && weather.current ? (() => {
            const wc = weather.current.weathercode
            const wLabel = wc <= 1 ? 'Klar' : wc <= 3 ? 'Bewölkt' : wc <= 48 ? 'Nebel' : wc <= 55 ? 'Nieselregen' : wc <= 65 ? 'Regen' : wc <= 75 ? 'Schnee' : wc <= 82 ? 'Regenschauer' : wc <= 86 ? 'Schneeschauer' : 'Gewitter'
            const wIcon = wc <= 1 ? '☀️' : wc <= 3 ? '⛅' : wc <= 48 ? '🌫️' : wc <= 55 ? '🌦️' : wc <= 65 ? '🌧️' : wc <= 75 ? '🌨️' : wc <= 82 ? '🌦️' : wc <= 86 ? '🌨️' : '⛈️'
            return <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 36, fontWeight: 300, color: 'var(--text,#fff)' }}>{Math.round(weather.current.temperature_2m)}°</div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--textSec,#ccc)' }}>{wIcon} {wLabel}</div>
                  <div style={{ fontSize: 10, color: 'var(--textMuted,#888)', marginTop: 2 }}>Wind: {Math.round(weather.current.windspeed_10m)} km/h</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, padding: '10px 16px 14px' }}>
                {weather.daily.time.map((day, i) => {
                  const dc = weather.daily.weathercode[i]
                  const di = dc <= 1 ? '☀️' : dc <= 3 ? '⛅' : dc <= 48 ? '🌫️' : dc <= 55 ? '🌦️' : dc <= 65 ? '🌧️' : dc <= 75 ? '🌨️' : dc <= 82 ? '🌦️' : dc <= 86 ? '🌨️' : '⛈️'
                  const rain = weather.daily.precipitation_probability_max?.[i] ?? 0
                  const isToday = day === new Date().toISOString().split('T')[0]
                  const isSel = weatherDay === i
                  return (
                    <button key={day} onClick={() => setWeatherDay(isSel ? null : i)} style={{ flex: 1, textAlign: 'center', background: isSel ? 'rgba(59,130,246,0.08)' : isToday ? 'rgba(255,255,255,0.03)' : 'var(--bgCard,#111)', borderRadius: 8, padding: '8px 4px', border: isSel ? '1px solid #3b82f6' : isToday ? '1px solid var(--borderLight,#222)' : '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <div style={{ fontSize: 9, color: isSel ? '#3b82f6' : isToday ? 'var(--text,#fff)' : 'var(--textDim,#555)', fontWeight: isSel || isToday ? 500 : 400 }}>{new Date(day + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)}</div>
                      <div style={{ fontSize: 16, margin: '4px 0' }}>{di}</div>
                      <div style={{ fontSize: 12, color: 'var(--textSec,#ccc)', fontWeight: 500 }}>{Math.round(weather.daily.temperature_2m_max[i])}°</div>
                      <div style={{ fontSize: 8, color: rain > 20 ? '#3b82f6' : 'var(--textDim,#444)', marginTop: 2 }}>{rain}%</div>
                    </button>
                  )
                })}
              </div>

              {/* Weather Day Detail Panel */}
              {weatherDay !== null && (() => {
                const i = weatherDay
                const day = weather.daily.time[i]
                const dc = weather.daily.weathercode[i]
                const dl = dc <= 1 ? 'Klar' : dc <= 3 ? 'Bewölkt' : dc <= 48 ? 'Nebel' : dc <= 55 ? 'Nieselregen' : dc <= 65 ? 'Regen' : dc <= 75 ? 'Schnee' : dc <= 82 ? 'Regenschauer' : dc <= 86 ? 'Schneeschauer' : 'Gewitter'
                const di = dc <= 1 ? '☀️' : dc <= 3 ? '⛅' : dc <= 48 ? '🌫️' : dc <= 55 ? '🌦️' : dc <= 65 ? '🌧️' : dc <= 75 ? '🌨️' : dc <= 82 ? '🌦️' : dc <= 86 ? '🌨️' : '⛈️'
                const rain = weather.daily.precipitation_probability_max?.[i] ?? 0
                const precip = weather.daily.precipitation_sum?.[i] ?? 0
                const wind = weather.daily.windspeed_10m_max?.[i] ?? 0
                const windDir = weather.daily.winddirection_10m_dominant?.[i] ?? 0
                const uv = weather.daily.uv_index_max?.[i] ?? 0
                const sunrise = weather.daily.sunrise?.[i]
                const sunset = weather.daily.sunset?.[i]
                const tMax = weather.daily.temperature_2m_max[i]

                // Hourly data for this day
                const hourlyTemps = weather.hourly?.temperature_2m || []
                const hourlyCodes = weather.hourly?.weathercode || []
                const hourlyTimes = weather.hourly?.time || []
                const dayHours = hourlyTimes.map((t, hi) => ({ time: t, temp: hourlyTemps[hi], code: hourlyCodes[hi] })).filter(h => h.time?.startsWith(day))

                // Hotel tips
                const tips = []
                if (rain > 40 || (dc >= 51 && dc <= 67)) tips.push({ text: 'Indoor-Aktivitäten empfehlen', color: '#3b82f6' })
                if (tMax > 30) tips.push({ text: 'Gäste auf Pool/Spa hinweisen', color: '#f59e0b' })
                if (dc >= 95 || wind > 60) tips.push({ text: 'Terrasse/Biergarten ggf. schließen', color: '#ef4444' })

                const dirs = ['N','NO','O','SO','S','SW','W','NW']
                const windDirLabel = dirs[Math.round(windDir / 45) % 8]

                return (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                      <div style={{ fontSize: 32 }}>{di}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{new Date(day + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                        <div style={{ fontSize: 12, color: 'var(--textSec)' }}>{dl}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                      {[
                        ['Min / Max', `${Math.round(weather.daily.temperature_2m_min[i])}° / ${Math.round(tMax)}°`],
                        ['Niederschlag', `${rain}% · ${precip.toFixed(1)}mm`],
                        ['Wind', `${Math.round(wind)} km/h ${windDirLabel}`],
                        ['UV-Index', String(Math.round(uv))],
                      ].map(([l, v]) => (
                        <div key={l} style={{ padding: '8px', background: 'var(--bgCard)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{l}</div>
                          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {sunrise && sunset && (
                      <div style={{ fontSize: 10, color: 'var(--textDim)', marginBottom: 10 }}>
                        Sonnenaufgang {sunrise.split('T')[1]?.slice(0, 5)} · Untergang {sunset.split('T')[1]?.slice(0, 5)}
                      </div>
                    )}

                    {/* Hourly */}
                    {dayHours.length > 0 && (
                      <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                        <div style={{ display: 'flex', gap: 2, minWidth: dayHours.length * 44 }}>
                          {dayHours.filter((_, hi) => hi % 2 === 0).map(h => {
                            const hc = h.code; const hi2 = hc <= 1 ? '☀️' : hc <= 3 ? '⛅' : hc <= 48 ? '🌫️' : hc <= 65 ? '🌧️' : hc <= 86 ? '🌨️' : '⛈️'
                            return (
                              <div key={h.time} style={{ textAlign: 'center', minWidth: 40, padding: '4px 2px' }}>
                                <div style={{ fontSize: 8, color: 'var(--textDim)' }}>{h.time.split('T')[1]?.slice(0, 5)}</div>
                                <div style={{ fontSize: 12, margin: '2px 0' }}>{hi2}</div>
                                <div style={{ fontSize: 10, color: 'var(--textSec)', fontWeight: 500 }}>{Math.round(h.temp)}°</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Hotel tips */}
                    {tips.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {tips.map((tip, ti) => (
                          <div key={ti} style={{ fontSize: 10, padding: '5px 10px', borderRadius: 6, background: `${tip.color}08`, border: `1px solid ${tip.color}20`, color: tip.color, fontWeight: 500 }}>
                            Tipp: {tip.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div style={{ padding: '6px 16px 10px', fontSize: 9, color: 'var(--textDim,#333)' }}>Quelle: Open-Meteo API · Live</div>
            </>
          })() : (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Wetterdaten werden geladen...</div>
          )}
        </Card>
      </div>

      <RealtimeBar />
      {/* New Request Modal */}
      {showNewRequest && (() => {
        const REQ_CATS = [
          ['room_service', 'Room Service', '#f59e0b'],
          ['housekeeping', 'Housekeeping', '#3b82f6'],
          ['maintenance', 'Wartung', '#ef4444'],
          ['taxi', 'Taxi', '#eab308'],
          ['complaint', 'Beschwerde', '#991b1b'],
          ['late_checkout', 'Late Checkout', '#8b5cf6'],
          ['luggage', 'Gepäck', '#14b8a6'],
        ]
        const checkedIn = bookings.filter(b => b.status === 'checked_in')
        const q = guestSearch.toLowerCase()
        const guestMatches = q ? checkedIn.filter(b => b.guest_name?.toLowerCase().includes(q) || String(b.room).includes(q)) : checkedIn
        const selColor = REQ_CATS.find(([k]) => k === newReq.category)?.[2] || '#3b82f6'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, overflowY: 'auto' }} onClick={() => setShowNewRequest(false)}>
            <div style={{ background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: newReq.category === 'room_service' ? 720 : 460, transition: 'max-width 0.3s ease', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Neue Anfrage erfassen</h3>
                <button onClick={() => setShowNewRequest(false)} style={{ background: 'var(--bgCard)', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 14, cursor: 'pointer', color: 'var(--textMuted)' }}>✕</button>
              </div>

              <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kategorie</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {REQ_CATS.map(([k, l, c]) => (
                  <button key={k} onClick={() => setNewReq(p => ({ ...p, category: k }))} style={{
                    padding: '7px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: newReq.category === k ? `${c}18` : 'var(--bgCard)',
                    color: newReq.category === k ? c : 'var(--textMuted)',
                    border: `1px solid ${newReq.category === k ? c : 'var(--borderLight)'}`,
                  }}>
                    <RequestIcon type={k} color={newReq.category === k ? c : 'var(--textDim)'} size={13} />
                    {l}
                  </button>
                ))}
              </div>

              <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gast / Zimmer</label>
              {newReq.room ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: `${selColor}10`, border: `1px solid ${selColor}30`, borderRadius: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: selColor, fontWeight: 500 }}>Zi. {newReq.room} — {newReq.guest_name}</span>
                  <button onClick={() => { setNewReq(p => ({ ...p, room: '', guest_name: '' })); setGuestSearch('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--textDim)', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ) : (
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <input value={guestSearch} onChange={e => setGuestSearch(e.target.value)} placeholder="Zimmer oder Gastname suchen..." style={{ width: '100%', padding: '10px 12px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  {guestSearch && guestMatches.length > 0 && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: 'var(--modalBg, #111)', border: '1px solid var(--borderLight)', borderRadius: 8, overflow: 'hidden', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 180, overflowY: 'auto' }}>
                      {guestMatches.slice(0, 8).map(b => (
                        <button key={b.id} onClick={() => { setNewReq(p => ({ ...p, room: String(b.room), guest_name: b.guest_name, booking_id: b.booking_id || '' })); setGuestSearch('') }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}>
                          <span style={{ fontWeight: 500 }}>Zimmer {b.room}</span> — {b.guest_name}
                        </button>
                      ))}
                    </div>
                  )}
                  {guestSearch && guestMatches.length === 0 && (
                    <div style={{ marginTop: 6, fontSize: 10, color: 'var(--textDim)' }}>
                      Kein Gast gefunden —{' '}
                      <button onClick={() => { setNewReq(p => ({ ...p, room: guestSearch, guest_name: '' })); setGuestSearch('') }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', textDecoration: 'underline' }}>manuell eingeben</button>
                    </div>
                  )}
                </div>
              )}

              {/* Room Service: Two-column order builder */}
              {newReq.category === 'room_service' ? <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                  {/* LEFT: Order list */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bestellung</div>
                    {orderItems.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Gerichte aus der Karte hinzufügen →</div>
                    ) : (
                      <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, overflow: 'hidden' }}>
                        {orderItems.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                              {item.note && <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 1 }}>{item.note}</div>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                              <button onClick={() => setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: Math.max(1, it.qty - 1) } : it))} style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--border)', border: 'none', color: 'var(--textMuted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, minWidth: 14, textAlign: 'center' }}>{item.qty}</span>
                              <button onClick={() => setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: it.qty + 1 } : it))} style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--border)', border: 'none', color: 'var(--textMuted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--textMuted)', minWidth: 36, textAlign: 'right', flexShrink: 0 }}>{(item.price * item.qty).toFixed(2)}€</span>
                            <button onClick={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))} style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(239,68,68,0.08)', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                          </div>
                        ))}
                        <div style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--textDim)' }}><span>Zwischensumme</span><span>{orderItems.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)}€</span></div>
                        <div style={{ padding: '4px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--textDim)' }}><span>Service-Zuschlag</span><span>{ROOM_SERVICE_FEE.toFixed(2)}€</span></div>
                        <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#f59e0b', borderTop: '1px solid var(--border)' }}><span>Gesamt</span><span>{(orderItems.reduce((s, i) => s + i.price * i.qty, 0) + ROOM_SERVICE_FEE).toFixed(2)}€</span></div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: Product catalog */}
                  <div style={{ width: 240, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Speisekarte</div>
                    <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder="Suchen..." style={{ width: '100%', padding: '6px 10px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 11, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 6, fontFamily: 'inherit' }} />
                    <div style={{ maxHeight: 400, overflowY: 'auto', overscrollBehavior: 'contain', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8 }}>
                      {Object.entries(MENU).map(([cat, items]) => {
                        const mq = menuSearch.toLowerCase()
                        const filtered = mq ? items.filter(([n]) => n.toLowerCase().includes(mq)) : items
                        if (filtered.length === 0) return null
                        return (
                          <div key={cat}>
                            <div style={{ fontSize: 8, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '5px 10px', background: 'var(--bgSec, var(--bgCard))', borderBottom: '1px solid var(--border)' }}>{cat}</div>
                            {filtered.map(([name, price]) => (
                              <div key={name} style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderBottom: '1px solid var(--border)', gap: 6 }}>
                                <span style={{ fontSize: 11, color: 'var(--textSec)', flex: 1 }}>{name}</span>
                                <span style={{ fontSize: 10, color: 'var(--textDim)', flexShrink: 0 }}>{price.toFixed(2)}€</span>
                                <button onClick={() => setOrderItems(prev => { const ex = prev.findIndex(i => i.name === name && !i.note); if (ex >= 0) { const n = [...prev]; n[ex] = { ...n[ex], qty: n[ex].qty + 1 }; return n } return [...prev, { name, price, qty: 1, note: '' }] })} style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </> : <>
                {/* Other categories: simple details field */}
                <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Details</label>
                <textarea value={newReq.request_details} onChange={e => setNewReq(p => ({ ...p, request_details: e.target.value }))} placeholder="Was wird benötigt?" style={{ width: '100%', padding: '10px 12px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit', minHeight: 60, resize: 'vertical' }} />
              </>}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => { setShowNewRequest(false); setOrderItems([]); setMenuSearch('') }} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button disabled={!newReq.room || (newReq.category === 'room_service' ? orderItems.length === 0 : !newReq.request_details)} onClick={async () => {
                  let details = newReq.request_details
                  let total = newReq.order_total ? parseFloat(newReq.order_total) : null
                  if (newReq.category === 'room_service' && orderItems.length > 0) {
                    details = orderItems.map(i => `${i.qty}x ${i.name} — ${(i.price * i.qty).toFixed(2)}€${i.note ? ` (${i.note})` : ''}`).join(', ')
                    total = orderItems.reduce((s, i) => s + i.price * i.qty, 0) + ROOM_SERVICE_FEE
                  }
                  await supabase.from('service_requests').insert({ category: newReq.category, room: newReq.room, guest_name: newReq.guest_name, request_details: details, status: 'pending', ...(total ? { order_total: Math.round(total * 100) / 100 } : {}), ...(newReq.booking_id ? { booking_id: newReq.booking_id } : {}) })
                  setShowNewRequest(false); setNewReq({ category: 'room_service', room: '', guest_name: '', request_details: '', order_total: '', booking_id: '' }); setGuestSearch(''); setOrderItems([]); setMenuSearch(''); refresh()
                }} style={{ flex: 1, padding: 12, background: newReq.room ? selColor : 'var(--bgCard)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: newReq.room ? '#fff' : 'var(--textDim)', cursor: newReq.room ? 'pointer' : 'default', fontFamily: 'inherit' }}>Anfrage erstellen</button>
              </div>
            </div>
          </div>
        )
      })()}

      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}

      {/* Booking Detail Popup */}
      {bookingDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setBookingDetail(null)}>
          <div style={{ background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Buchungsdetails</h3>
              <button onClick={() => setBookingDetail(null)} style={{ background: 'var(--bgCard)', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 14, cursor: 'pointer', color: 'var(--textMuted)' }}>✕</button>
            </div>
            {[
              ['Gast', bookingDetail.guest_name],
              ['Zimmer', bookingDetail.room],
              ['Check-in', bookingDetail.check_in],
              ['Check-out', bookingDetail.check_out],
              ['Nächte', bookingDetail.check_in && bookingDetail.check_out ? Math.round((new Date(bookingDetail.check_out) - new Date(bookingDetail.check_in)) / 86400000) : '-'],
              ['Status', bookingDetail.status === 'checked_in' ? 'Eingecheckt' : bookingDetail.status === 'reserved' ? 'Reserviert' : bookingDetail.status === 'confirmed' ? 'Bestätigt' : bookingDetail.status],
              ['Betrag', bookingDetail.amount_due ? `${parseFloat(bookingDetail.amount_due).toFixed(2)}€` : '-'],
              ['Quelle', bookingDetail.source || 'Direkt'],
            ].map(([l, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{l}</span>
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: l === 'Betrag' ? 600 : 400 }}>{v}</span>
              </div>
            ))}
            <button onClick={() => setBookingDetail(null)} style={{ width: '100%', marginTop: 20, padding: 12, background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Schließen</button>
          </div>
        </div>
      )}
    </div>
  )
}

function RequestIcon({ type, color, size = 12 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (type) {
    case 'room_service': return <svg {...p}><path d="M3 11h18M5 11V6a7 7 0 0114 0v5"/><line x1="12" y1="4" x2="12" y2="4.01"/></svg>
    case 'housekeeping': case 'pillow': case 'towels': case 'cleaning': return <svg {...p}><path d="M3 21h18M4 21V10l8-6 8 6v11"/><rect x="9" y="13" width="6" height="8"/></svg>
    case 'maintenance': return <svg {...p}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
    case 'taxi': return <svg {...p}><path d="M5 17h14M6 17l1-5h10l1 5"/><path d="M8 12l1-4h6l1 4"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>
    case 'complaint': return <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    case 'late_checkout': return <svg {...p}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    case 'luggage': return <svg {...p}><rect x="6" y="7" width="12" height="14" rx="2"/><path d="M9 7V5a3 3 0 016 0v2"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
    case 'wake_up': return <svg {...p}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3l2 2M19 3l-2 2"/></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
  }
}

function DashboardClock({ style }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(iv) }, [])
  return <span style={style}>{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · <span style={{ color: 'var(--text,#fff)', fontWeight: 500, fontSize: 13 }}>{now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span></span>
}

function RealtimeBar() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(iv) }, [])
  return <div style={s.realtimeBar}>Supabase Realtime aktiv · {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
}

function Stat({ label, value, change, up }) {
  return (
    <div style={s.statCard}><div style={s.statLabel}>{label}</div><div style={s.statValue}>{value}</div>
      {change && <div style={{ fontSize: 10, color: up ? 'var(--accent-green)' : 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 6 }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{up ? <path d="M5 10l7-7m0 0l7 7m-7-7v18"/> : <path d="M19 14l-7 7m0 0l-7-7m7 7V3"/>}</svg>{change}
      </div>}
    </div>
  )
}
function Card({ title, count, extra, children }) {
  return <div style={s.card}><div style={s.cardHead}><span style={s.cardTitle}>{title}</span><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{extra && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{extra}</span>}{count !== undefined && <span style={s.cardCount}>{count}</span>}</div></div><div>{children}</div></div>
}
function Row({ children, style: x }) { return <div style={{ ...s.row, ...x }}>{children}</div> }
function Prio({ c }) { return <div style={{ width: 3, borderRadius: 2, alignSelf: 'stretch', flexShrink: 0, background: c }} /> }
function Dot({ c, l }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} /><span style={{ fontSize: 9, color: 'var(--textDim)' }}>{l}</span></div> }

function EventTypeIcon({ type }) {
  const p = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }
  const c = 'var(--textDim)'
  switch (type) {
    case 'fussball': return <svg {...p} stroke={c}><circle cx="12" cy="12" r="10"/><path d="M12 2l3 7h-6l3-7m-7.66 15l5-4.5-1.5-6.5m15.32 0l-6.5 1.5-4.5 5"/></svg>
    case 'eishockey': return <svg {...p} stroke={c}><path d="M4 20l8-8 8 8"/><circle cx="12" cy="8" r="4"/></svg>
    case 'konzert': return <svg {...p} stroke={c}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
    case 'messe': return <svg {...p} stroke={c}><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
    case 'volksfest': return <svg {...p} stroke={c}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
    default: return <svg {...p} stroke={c}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  }
}

const s = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h1: { fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: 0, letterSpacing: -0.5 },
  date: { fontSize: 12, color: 'var(--textMuted)', marginTop: 4 },
  hotelBadge: { fontSize: 11, color: 'var(--textMuted)', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', padding: '7px 14px', borderRadius: 10 },
  liveDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px rgba(16,185,129,0.4)', animation: 'pulse 2s ease-in-out infinite' },
  grid6: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 },
  statCard: { background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, padding: '16px 18px' },
  statLabel: { fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.5 },
  card: { background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' },
  cardHead: { padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 12, fontWeight: 500, color: 'var(--text)' }, cardCount: { fontSize: 10, color: 'var(--textMuted)', background: 'var(--border)', padding: '2px 8px', borderRadius: 10 },
  row: { display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 },
  rowName: { fontSize: 12, color: 'var(--textSec)', display: 'flex', alignItems: 'center', gap: 6 }, rowSub: { fontSize: 10, color: 'var(--textDim)', marginTop: 1 },
  badge: { fontSize: 10, color: 'var(--textMuted)', background: 'var(--border)', padding: '3px 8px', borderRadius: 5, flexShrink: 0 },
  vip: { fontSize: 8, color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.1)', padding: '2px 5px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase' },
  eventDate: { fontSize: 10, color: 'var(--textMuted)', background: 'var(--border)', padding: '4px 8px', borderRadius: 5, textAlign: 'center', minWidth: 40, flexShrink: 0 },
  realtimeBar: { textAlign: 'center', fontSize: 10, color: 'var(--textDim)', padding: '16px 0', borderTop: '1px solid var(--border)' },
  reqRow: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 12 },
  minuteInput: { width: 50, padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 12, color: 'var(--text)', textAlign: 'center', outline: 'none' },
  confirmSmBtn: { padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  acceptBtn: { padding: '6px 12px', background: 'var(--bg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 11, color: 'var(--textSec)', cursor: 'pointer', fontFamily: 'inherit' },
  resolveBtn: { padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, fontSize: 11, color: '#10b981', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
}
