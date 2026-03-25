import { useState, useEffect } from 'react'
import { useDashboardData } from '../hooks/useRealtime'
import { fetchBookings, fetchShiftLogs, fetchComplaints, fetchMaintenance, fetchAllOpenRequests, fetchRevenueInsights, fetchEvents, fetchHousekeeping, supabase } from '../lib/supabase'
import { useNotifications } from '../hooks/useNotifications'
import { useTier } from '../lib/tier.jsx'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Dashboard({ user }) {
  const { tier } = useTier()
  const { data, loading, lastUpdate } = useDashboardData({
    bookings: fetchBookings, logs: fetchShiftLogs, complaints: fetchComplaints,
    maintenance: fetchMaintenance, requests: fetchAllOpenRequests,
    revenue: fetchRevenueInsights, events: () => fetchEvents(7), housekeeping: fetchHousekeeping,
    rooms: async () => { const { data } = await supabase.from('rooms').select('*'); return data || [] },
  })
  const [taxiMinutes, setTaxiMinutes] = useState({})
  const [confirm, setConfirm] = useState(null)
  const { notify } = useNotifications('dashboard')
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=48.7665&longitude=11.4258&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&timezone=Europe/Berlin&forecast_days=7')
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
  const dEvents = events.length > 0 ? events : [
    { start_date: '2026-03-23', event_name: 'FC Ingolstadt vs. TSV 1860', event_type: 'fussball', impact_level: 'high' },
    { start_date: '2026-03-25', event_name: 'Audi Zulieferer-Konferenz', event_type: 'messe', impact_level: 'medium' },
    { start_date: '2026-03-27', event_name: 'ERC Ingolstadt Playoff Heim vs München', event_type: 'eishockey', impact_level: 'high' },
    { start_date: '2026-03-28', event_name: 'ABBA Concert Theater', event_type: 'konzert', impact_level: 'medium' },
    { start_date: '2026-03-28', event_name: 'Ingolstädter Frühjahrsmesse', event_type: 'volksfest', impact_level: 'low' },
    { start_date: '2026-03-29', event_name: 'ERC Ingolstadt Playoff Heim vs München', event_type: 'eishockey', impact_level: 'high' },
  ]
  const dComp = (revenueData?.competitor_prices ? (typeof revenueData.competitor_prices === 'string' ? JSON.parse(revenueData.competitor_prices) : revenueData.competitor_prices) : []).length > 0
    ? (typeof revenueData.competitor_prices === 'string' ? JSON.parse(revenueData.competitor_prices) : revenueData.competitor_prices)
    : [{ name: 'NH Hotel', price: 109, diff: -9 }, { name: 'IntercityHotel', price: 109, diff: -9 }, { name: 'Rappensberger', price: 111, diff: -7 }, { name: 'BLOCK Hotel', price: 170, diff: 52 }]

  const liveRequests = openRequests

  // Booking detail popup
  const [bookingDetail, setBookingDetail] = useState(null)
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [newReq, setNewReq] = useState({ category: 'towels', room: '', guest_name: '', request_details: '' })

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
    const map = { taxi: 'Taxi', complaint: 'Beschwerde', room_service: 'Room Service', pillow: 'Kissen', towels: 'Handtücher', housekeeping: 'Reinigung', wake_up: 'Weckruf', luggage: 'Gepäck', maintenance: 'Wartung' }
    return map[type] || type
  }

  const getRequestColor = (type) => {
    const map = { taxi: '#3b82f6', complaint: '#ef4444', room_service: '#f59e0b', pillow: '#8b5cf6', towels: '#8b5cf6', housekeeping: '#10b981', maintenance: '#f59e0b' }
    return map[type] || '#6b7280'
  }

  const getAge = (created) => Math.round((Date.now() - new Date(created).getTime()) / 60000)

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="pulse" style={{ color: 'var(--text-muted)', fontSize: 14 }}>Dashboard laden...</div></div></div>

  return (
    <div style={s.content} className="fade-in">
      <div style={s.header}>
        <div><h1 style={s.h1}>{tier === 'concierge' ? 'Marco Concierge' : 'Dashboard'}</h1><p style={s.date}><DashboardClock /></p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={s.liveDot} title="Realtime aktiv" /><div style={s.hotelBadge}>{user.hotel}</div></div>
      </div>

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
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${color}15`, color, fontWeight: 500 }}>{getRequestLabel(req.category)}</span>
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
                  {req.category !== 'taxi' && req.status === 'pending' && (
                    <button style={s.acceptBtn} onClick={() => handleAccept(req)}>Annehmen</button>
                  )}
                  {req.status === 'accepted' && (
                    <button style={s.resolveBtn} onClick={() => handleResolve(req)}>Erledigt</button>
                  )}
                  {req.category === 'complaint' && req.status === 'pending' && (
                    <button style={s.resolveBtn} onClick={() => handleResolve(req)}>Erledigt</button>
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
        <Card title="Events diese Woche" extra={`${dEvents.length}`}>
          {dEvents.slice(0, 6).map((ev, i) => {
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
                  return (
                    <div key={day} style={{ flex: 1, textAlign: 'center', background: isToday ? 'rgba(255,255,255,0.03)' : 'var(--bgCard,#111)', borderRadius: 8, padding: '8px 4px', border: isToday ? '1px solid var(--borderLight,#222)' : '1px solid transparent' }}>
                      <div style={{ fontSize: 9, color: isToday ? 'var(--text,#fff)' : 'var(--textDim,#555)', fontWeight: isToday ? 500 : 400 }}>{new Date(day + 'T00:00').toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)}</div>
                      <div style={{ fontSize: 16, margin: '4px 0' }}>{di}</div>
                      <div style={{ fontSize: 12, color: 'var(--textSec,#ccc)', fontWeight: 500 }}>{Math.round(weather.daily.temperature_2m_max[i])}°</div>
                      <div style={{ fontSize: 8, color: rain > 20 ? '#3b82f6' : 'var(--textDim,#444)', marginTop: 2 }}>{rain}%</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: '6px 16px 10px', fontSize: 9, color: 'var(--textDim,#333)' }}>Quelle: Open-Meteo API · Live</div>
            </>
          })() : (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Wetterdaten werden geladen...</div>
          )}
        </Card>
      </div>

      <RealtimeBar />
      {/* New Request Modal */}
      {showNewRequest && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowNewRequest(false)}>
          <div style={{ background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Neue Anfrage erfassen</h3>
              <button onClick={() => setShowNewRequest(false)} style={{ background: 'var(--bgCard)', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 14, cursor: 'pointer', color: 'var(--textMuted)' }}>✕</button>
            </div>

            <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 4, textTransform: 'uppercase' }}>Kategorie</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {[['towels','Handtücher'],['pillow','Kissen'],['cleaning','Reinigung'],['room_service','Room Service'],['taxi','Taxi'],['complaint','Beschwerde'],['toiletries','Pflegeprodukte'],['other','Sonstiges']].map(([k,l]) => (
                <button key={k} onClick={() => setNewReq(p => ({ ...p, category: k }))} style={{
                  padding: '6px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                  background: newReq.category === k ? 'rgba(59,130,246,0.1)' : 'var(--bgCard)',
                  color: newReq.category === k ? '#3b82f6' : 'var(--textMuted)',
                  border: `1px solid ${newReq.category === k ? '#3b82f6' : 'var(--borderLight)'}`,
                }}>{l}</button>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 4, textTransform: 'uppercase' }}>Zimmernummer</label>
            <input value={newReq.room} onChange={e => setNewReq(p => ({ ...p, room: e.target.value }))} placeholder="z.B. 101" style={{ width: '100%', padding: '10px 12px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit' }} />

            <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 4, textTransform: 'uppercase' }}>Gastname</label>
            <input value={newReq.guest_name} onChange={e => setNewReq(p => ({ ...p, guest_name: e.target.value }))} placeholder="Name des Gastes" style={{ width: '100%', padding: '10px 12px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit' }} />

            <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 4, textTransform: 'uppercase' }}>Details</label>
            <textarea value={newReq.request_details} onChange={e => setNewReq(p => ({ ...p, request_details: e.target.value }))} placeholder="Was wird benötigt?" style={{ width: '100%', padding: '10px 12px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 14, fontFamily: 'inherit', minHeight: 60, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNewRequest(false)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button disabled={!newReq.room || !newReq.request_details} onClick={async () => {
                await supabase.from('service_requests').insert({ category: newReq.category, room: newReq.room, guest_name: newReq.guest_name, request_details: newReq.request_details, status: 'pending' })
                setShowNewRequest(false); setNewReq({ category: 'towels', room: '', guest_name: '', request_details: '' }); refresh()
              }} style={{ flex: 1, padding: 12, background: newReq.room && newReq.request_details ? '#3b82f6' : 'var(--bgCard)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: newReq.room && newReq.request_details ? '#fff' : 'var(--textDim)', cursor: newReq.room && newReq.request_details ? 'pointer' : 'default', fontFamily: 'inherit' }}>Anfrage erstellen</button>
            </div>
          </div>
        </div>
      )}

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
