import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTier } from '../lib/tier.jsx'

const S = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  statCard: { background: 'var(--bgCard,#0e0e0e)', border: '1px solid var(--borderLight,#1a1a1a)', borderRadius: 12, padding: '16px 18px' },
  statLabel: { fontSize: 10, color: 'var(--textMuted,#888)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: 600, color: 'var(--text,#fff)', letterSpacing: -0.5 },
  card: { background: 'var(--bgCard,#0e0e0e)', border: '1px solid var(--borderLight,#1a1a1a)', borderRadius: 12, overflow: 'hidden' },
  cardHead: { padding: '14px 16px', borderBottom: '1px solid var(--border,#151515)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 12, fontWeight: 500, color: 'var(--text,#fff)' },
  cardCount: { fontSize: 10, color: 'var(--textMuted,#888)', background: 'var(--border,#141414)', padding: '2px 8px', borderRadius: 10 },
  noData: { padding: 32, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 },
}

export default function Analytics() {
  const { tier } = useTier()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState([])
  const [rooms, setRooms] = useState([])
  const [marcoStats, setMarcoStats] = useState({ total: 0, avgResponse: 0 })
  const [restaurantRev, setRestaurantRev] = useState(0)
  const [spaCount, setSpaCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      const [b, r, sr, ro, sp] = await Promise.all([
        supabase.from('bookings').select('*').order('check_in', { ascending: false }),
        supabase.from('rooms').select('*'),
        supabase.from('service_requests').select('*'),
        supabase.from('restaurant_orders').select('product_price, quantity'),
        supabase.from('spa_bookings').select('id'),
      ])
      setBookings(b.data || [])
      setRooms(r.data || [])
      if (sr.data) {
        let totalResp = 0, respCount = 0
        sr.data.forEach(req => { if (req.resolved_at && req.timestamp) { totalResp += (new Date(req.resolved_at) - new Date(req.timestamp)) / 60000; respCount++ } })
        setMarcoStats({ total: sr.data.length, avgResponse: respCount > 0 ? (totalResp / respCount).toFixed(1) : 'N/A' })
      }
      if (ro.data) setRestaurantRev(ro.data.reduce((s, o) => s + (o.product_price * (o.quantity || 1)), 0))
      if (sp.data) setSpaCount(sp.data.length)
      setLoading(false)
    }
    load()
  }, [])

  const todayStr = new Date().toISOString().split('T')[0]
  const totalRooms = rooms.length || 1

  // Monthly revenue + occupancy from bookings (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const year = d.getFullYear(); const month = d.getMonth()
    const monthStr = d.toLocaleDateString('de-DE', { month: 'short' })
    const first = new Date(year, month, 1).toISOString().split('T')[0]
    const last = new Date(year, month + 1, 0).toISOString().split('T')[0]
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const monthBookings = bookings.filter(b => b.check_in <= last && b.check_out >= first && b.status !== 'cancelled')
    const revenue = monthBookings.reduce((s, b) => s + (parseFloat(b.amount_due) || 0), 0)
    // Approximate occupancy: count occupied room-nights / total room-nights
    let occupiedNights = 0
    monthBookings.forEach(b => {
      const ci = new Date(Math.max(new Date(b.check_in), new Date(first)))
      const co = new Date(Math.min(new Date(b.check_out), new Date(last)))
      occupiedNights += Math.max(0, Math.round((co - ci) / 86400000))
    })
    const occ = totalRooms > 0 ? Math.round((occupiedNights / (totalRooms * daysInMonth)) * 100) : 0
    return { month: monthStr, revenue, occ, count: monthBookings.length }
  })

  const currentMonth = monthlyData[5]
  const prevMonth = monthlyData[4]
  const revChange = prevMonth.revenue > 0 ? Math.round((currentMonth.revenue - prevMonth.revenue) / prevMonth.revenue * 100) : 0
  const occChange = currentMonth.occ - prevMonth.occ
  const maxRev = Math.max(...monthlyData.map(m => m.revenue), 1)

  // Booking sources from real data
  const sourceMap = {}
  bookings.filter(b => b.status !== 'cancelled').forEach(b => { const src = b.source || 'Direkt'; sourceMap[src] = (sourceMap[src] || 0) + 1 })
  const totalSourced = Object.values(sourceMap).reduce((a, b) => a + b, 0) || 1
  const sources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count], i) => ({
    name, pct: Math.round(count / totalSourced * 100), color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6b7280'][i] || '#6b7280',
  }))

  // Weekday occupancy
  const weekdayOcc = [0,0,0,0,0,0,0]
  const weekdayCounts = [0,0,0,0,0,0,0]
  bookings.filter(b => b.status !== 'cancelled').forEach(b => {
    const ci = new Date(b.check_in + 'T12:00'); const co = new Date(b.check_out + 'T12:00')
    for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
      const wd = (d.getDay() + 6) % 7 // Monday=0
      weekdayOcc[wd]++; weekdayCounts[wd]++
    }
  })
  const weekdays = ['Mo','Di','Mi','Do','Fr','Sa','So'].map((d, i) => ({ d, occ: weekdayCounts[i] > 0 ? Math.min(100, Math.round(weekdayOcc[i] / Math.max(totalRooms, 1) * 100 / 4)) : 0 }))

  const hasBookingData = bookings.length > 0

  if (loading) return <div style={S.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={S.content}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text,#fff)', margin: 0 }}>{tier === 'concierge' ? 'Marco Performance' : 'Analytics & Reports'}</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted,#888)', marginTop: 4 }}>Basierend auf {bookings.length} Buchungen</p>
        </div>
      </div>

      {/* Hotel KPIs - PMS only */}
      {tier !== 'concierge' && <>
        {hasBookingData ? <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              ['Umsatz (Monat)', `${(currentMonth.revenue / 1000).toFixed(1)}k€`, revChange !== 0 ? `${revChange > 0 ? '+' : ''}${revChange}%` : null, revChange >= 0],
              ['Auslastung', `${currentMonth.occ}%`, occChange !== 0 ? `${occChange > 0 ? '+' : ''}${occChange}%` : null, occChange >= 0],
              ['Buchungen (Monat)', String(currentMonth.count), null, true],
              ['Ø Aufenthalt', `${bookings.length > 0 ? (bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + Math.max(1, Math.round((new Date(b.check_out) - new Date(b.check_in)) / 86400000)), 0) / Math.max(1, bookings.filter(b => b.status !== 'cancelled').length)).toFixed(1) : '0'} Nächte`, null, true],
            ].map(([label, value, change, up], i) =>
              <div key={i} style={S.statCard}>
                <div style={S.statLabel}>{label}</div>
                <div style={S.statValue}>{value}</div>
                {change && <div style={{ fontSize: 10, color: up ? '#10b981' : '#ef4444', marginTop: 6 }}>{change} vs. Vormonat</div>}
              </div>
            )}
          </div>

          {/* Revenue Chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={S.card}>
              <div style={S.cardHead}><span style={S.cardTitle}>Umsatz 6 Monate</span></div>
              <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
                {monthlyData.map((m, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--textMuted,#888)', marginBottom: 4 }}>{m.revenue > 0 ? `${(m.revenue / 1000).toFixed(0)}k` : '—'}</div>
                    <div style={{ height: Math.max(4, (m.revenue / maxRev) * 120), background: i === 5 ? '#10b981' : 'var(--border,#1a3a2e)', borderRadius: '4px 4px 0 0' }} />
                    <div style={{ fontSize: 9, color: i === 5 ? '#10b981' : 'var(--textDim,#444)', marginTop: 4, fontWeight: i === 5 ? 600 : 400 }}>{m.month}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardHead}><span style={S.cardTitle}>Auslastung Trend</span></div>
              <div style={{ padding: 16, display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
                {monthlyData.map((m, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: 'var(--textMuted,#888)', marginBottom: 2 }}>{m.occ}%</div>
                    <div style={{ height: Math.max(4, m.occ * 1.2), background: m.occ >= 80 ? '#10b981' : m.occ >= 60 ? '#f59e0b' : '#ef4444', borderRadius: '3px 3px 0 0', opacity: i === 5 ? 1 : 0.6 }} />
                    <div style={{ fontSize: 8, color: 'var(--textDim,#444)', marginTop: 4 }}>{m.month}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sources + Weekdays */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={S.card}>
              <div style={S.cardHead}><span style={S.cardTitle}>Buchungsquellen</span></div>
              <div style={{ padding: '12px 16px' }}>
                {sources.length > 0 ? sources.map((src, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--textSec,#ccc)' }}>{src.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--textMuted,#888)' }}>{src.pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--border,#151515)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${src.pct}%`, background: src.color, borderRadius: 3 }} />
                    </div>
                  </div>
                )) : <div style={S.noData}>Keine Buchungsquellen</div>}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardHead}><span style={S.cardTitle}>Belegung nach Wochentag</span></div>
              <div style={{ padding: 16, display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
                {weekdays.map((w, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--textMuted,#888)', marginBottom: 4 }}>{w.occ}%</div>
                    <div style={{ height: Math.max(4, w.occ * 1.1), background: w.occ >= 85 ? '#10b981' : w.occ >= 60 ? '#f59e0b' : 'var(--border,#1a3a2e)', borderRadius: '4px 4px 0 0' }} />
                    <div style={{ fontSize: 10, color: 'var(--textDim,#555)', marginTop: 4 }}>{w.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </> : <div style={{ ...S.card, marginBottom: 16 }}><div style={S.noData}>Nicht genug Buchungsdaten für Analytics vorhanden. Erstellen Sie Buchungen um Trends zu sehen.</div></div>}
      </>}

      {/* Marco Performance - BOTH tiers */}
      <div style={{ ...S.card, marginBottom: 16, border: '1px solid rgba(139,92,246,0.2)' }}>
        <div style={{ ...S.cardHead, background: 'rgba(139,92,246,0.03)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6' }}>Marco AI Concierge — Performance</span>
          <span style={S.cardCount}>{marcoStats.total} Anfragen</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              ['Anfragen gesamt', marcoStats.total, '#8b5cf6'],
              ['Ø Reaktionszeit', `${marcoStats.avgResponse} Min.`, '#10b981'],
              ['Restaurant-Umsatz', `${restaurantRev.toFixed(0)}€`, '#3b82f6'],
              ['Spa-Buchungen', spaCount, '#ec4899'],
            ].map(([l, v, c], i) =>
              <div key={i} style={{ background: `${c}08`, border: `1px solid ${c}20`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: c }}>{v}</div>
                <div style={{ fontSize: 10, color: 'var(--textMuted,#888)', marginTop: 4 }}>{l}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
