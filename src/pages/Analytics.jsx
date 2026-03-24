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
}

export default function Analytics() {
  const { tier } = useTier()
  const [period, setPeriod] = useState('month')
  const [marcoStats, setMarcoStats] = useState({ total: 0, byType: {}, avgResponse: 0 })
  const [restaurantRev, setRestaurantRev] = useState(0)
  const [spaCount, setSpaCount] = useState(0)

  useEffect(() => {
    loadMarcoStats()
    loadRestaurantRevenue()
    loadSpaBookings()
  }, [])

  const loadMarcoStats = async () => {
    const { data } = await supabase.from('service_requests').select('*')
    if (!data) return
    const byType = {}
    let totalResponse = 0, responseCount = 0
    data.forEach(r => {
      byType[r.request_type] = (byType[r.request_type] || 0) + 1
      if (r.resolved_at && r.created_at) {
        totalResponse += (new Date(r.resolved_at) - new Date(r.created_at)) / 60000
        responseCount++
      }
    })
    setMarcoStats({ total: data.length, byType, avgResponse: responseCount > 0 ? (totalResponse / responseCount).toFixed(1) : 'N/A' })
  }

  const loadRestaurantRevenue = async () => {
    const { data } = await supabase.from('restaurant_orders').select('product_price, quantity')
    if (data) setRestaurantRev(data.reduce((sum, o) => sum + (o.product_price * (o.quantity || 1)), 0))
  }

  const loadSpaBookings = async () => {
    const { data } = await supabase.from('spa_bookings').select('id')
    if (data) setSpaCount(data.length)
  }

  // Demo data for hotel KPIs (in real PMS: calculated from bookings table)
  const months = ['Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mär']
  const revenueData = [38200, 41500, 45800, 52300, 48900, 44200, 39800, 35100, 42600, 47300, 43900, 51200]
  const occData = [62, 68, 74, 82, 78, 71, 65, 58, 69, 76, 72, 79]
  const maxRev = Math.max(...revenueData)
  const currentRev = revenueData[11]; const prevRev = revenueData[10]; const revChange = Math.round((currentRev - prevRev) / prevRev * 100)
  const currentOcc = occData[11]; const occChange = currentOcc - occData[10]

  const sources = [
    { name: 'Booking.com', pct: 42, color: '#003580' },
    { name: 'Direkt (Website)', pct: 24, color: '#10b981' },
    { name: 'Expedia', pct: 16, color: '#f59e0b' },
    { name: 'HRS', pct: 10, color: '#8b5cf6' },
    { name: 'Telefon/Walk-in', pct: 8, color: '#6b7280' },
  ]

  const roomTypes = [
    { type: 'Doppelzimmer', rev: 28400, pct: 55, rooms: 108, color: '#3b82f6' },
    { type: 'Einzelzimmer', rev: 12800, pct: 25, rooms: 52, color: '#10b981' },
    { type: 'Junior Suite', rev: 7200, pct: 14, rooms: 28, color: '#8b5cf6' },
    { type: 'Suite', rev: 2800, pct: 6, rooms: 9, color: '#f59e0b' },
  ]

  const weekdays = [{ d: 'Mo', occ: 72 }, { d: 'Di', occ: 74 }, { d: 'Mi', occ: 76 }, { d: 'Do', occ: 81 }, { d: 'Fr', occ: 88 }, { d: 'Sa', occ: 91 }, { d: 'So', occ: 65 }]

  const requestTypes = [
    ['room_service', 'Room Service', '#f59e0b'],
    ['pillow', 'Housekeeping', '#3b82f6'],
    ['taxi', 'Taxi', '#10b981'],
    ['complaint', 'Beschwerden', '#ef4444'],
    ['maintenance', 'Wartung', '#8b5cf6'],
  ]

  const estimatedValue = Math.round(marcoStats.total * 8 / 60 * 26 + restaurantRev * 0.15 + spaCount * 25)

  return (
    <div style={S.content}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text,#fff)', margin: 0 }}>{tier === 'concierge' ? 'Marco Performance' : 'Analytics & Reports'}</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted,#888)', marginTop: 4 }}>März 2026 · Maritim Hotel Ingolstadt</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['month', 'Monat'], ['quarter', 'Quartal'], ['year', 'Jahr']].map(([k, l]) =>
            <button key={k} onClick={() => setPeriod(k)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: period === k ? '#fff' : 'var(--bgCard,#0e0e0e)', color: period === k ? '#080808' : 'var(--textMuted,#888)', border: `1px solid ${period === k ? '#fff' : 'var(--borderLight,#1a1a1a)'}` }}>{l}</button>
          )}
        </div>
      </div>

      {/* Hotel KPIs - PMS only */}
      {tier !== 'concierge' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            ['Umsatz', `${(currentRev / 1000).toFixed(1)}k€`, `${revChange > 0 ? '+' : ''}${revChange}%`, true],
            ['Auslastung', `${currentOcc}%`, `${occChange > 0 ? '+' : ''}${occChange}%`, occChange > 0],
            ['ADR', '122€', '+6€', true],
            ['RevPAR', '96€', '+8€', true],
            ['Ø Aufenthalt', '2,4 Nächte', '+0,2', true],
            ['Stornorate', '6,2%', '-1,1%', true],
          ].map(([label, value, change, up], i) =>
            <div key={i} style={S.statCard}>
              <div style={S.statLabel}>{label}</div>
              <div style={S.statValue}>{value}</div>
              <div style={{ fontSize: 10, color: up ? '#10b981' : '#ef4444', marginTop: 6 }}>{change} vs. Vormonat</div>
            </div>
          )}
        </div>

        {/* Revenue + Occupancy Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.cardTitle}>Umsatz 12 Monate</span><span style={S.cardCount}>{(revenueData.reduce((a, b) => a + b, 0) / 1000).toFixed(0)}k€</span></div>
            <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
              {months.map((m, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--textMuted,#888)', marginBottom: 4 }}>{(revenueData[i] / 1000).toFixed(0)}k</div>
                  <div style={{ height: (revenueData[i] / maxRev) * 120, background: i === 11 ? '#10b981' : i >= 9 ? '#1a5a3e' : 'var(--border,#1a3a2e)', borderRadius: '4px 4px 0 0' }} />
                  <div style={{ fontSize: 9, color: i === 11 ? '#10b981' : 'var(--textDim,#444)', marginTop: 4, fontWeight: i === 11 ? 600 : 400 }}>{m}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.cardTitle}>Auslastung Trend</span></div>
            <div style={{ padding: 16, display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
              {months.map((m, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: 'var(--textMuted,#888)', marginBottom: 2 }}>{occData[i]}%</div>
                  <div style={{ height: occData[i] * 1.2, background: occData[i] >= 80 ? '#10b981' : occData[i] >= 70 ? '#f59e0b' : '#ef4444', borderRadius: '3px 3px 0 0', opacity: i === 11 ? 1 : 0.6 }} />
                  <div style={{ fontSize: 8, color: 'var(--textDim,#444)', marginTop: 4 }}>{m}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sources + Room Types + Weekdays */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.cardTitle}>Buchungsquellen</span></div>
            <div style={{ padding: '12px 16px' }}>
              {sources.map((s, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--textSec,#ccc)' }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--textMuted,#888)' }}>{s.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border,#151515)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.cardTitle}>Umsatz nach Zimmertyp</span></div>
            <div style={{ padding: '12px 16px' }}>
              {roomTypes.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border,#151515)', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--textSec,#ccc)' }}>{r.type}</div>
                    <div style={{ fontSize: 10, color: 'var(--textDim,#444)' }}>{r.rooms} Buchungen</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text,#fff)', fontWeight: 500 }}>{(r.rev / 1000).toFixed(1)}k€</div>
                    <div style={{ fontSize: 10, color: 'var(--textMuted,#888)' }}>{r.pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.cardTitle}>Belegung nach Wochentag</span></div>
            <div style={{ padding: 16, display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
              {weekdays.map((w, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--textMuted,#888)', marginBottom: 4 }}>{w.occ}%</div>
                  <div style={{ height: w.occ * 1.1, background: w.occ >= 85 ? '#10b981' : w.occ >= 75 ? '#f59e0b' : 'var(--border,#1a3a2e)', borderRadius: '4px 4px 0 0' }} />
                  <div style={{ fontSize: 10, color: 'var(--textDim,#555)', marginTop: 4 }}>{w.d}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 16px 12px', fontSize: 10, color: 'var(--textDim,#444)' }}>Peak: Freitag & Samstag</div>
          </div>
        </div>
      </>}

      {/* Marco Performance - BOTH tiers */}
      <div style={{ ...S.card, marginBottom: 16, border: '1px solid rgba(139,92,246,0.2)' }}>
        <div style={{ ...S.cardHead, background: 'rgba(139,92,246,0.03)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6' }}>Marco AI Concierge — Performance Report</span>
          <span style={S.cardCount}>{marcoStats.total} Anfragen</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              ['Anfragen gesamt', marcoStats.total, '#8b5cf6'],
              ['Ø Reaktionszeit', `${marcoStats.avgResponse} Min.`, '#10b981'],
              ['Restaurant-Umsatz', `${restaurantRev.toFixed(0)}€`, '#3b82f6'],
              ['Spa-Buchungen', spaCount, '#ec4899'],
              ['Geschätzter Mehrwert', `${estimatedValue}€`, '#10b981'],
            ].map(([l, v, c], i) =>
              <div key={i} style={{ background: `${c}08`, border: `1px solid ${c}20`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: c }}>{v}</div>
                <div style={{ fontSize: 10, color: 'var(--textMuted,#888)', marginTop: 4 }}>{l}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--textMuted,#888)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Anfragen nach Typ</div>
              {requestTypes.map(([type, label, color], i) => {
                const count = marcoStats.byType[type] || 0
                const maxCount = Math.max(...Object.values(marcoStats.byType), 1)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border,#151515)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                      <span style={{ fontSize: 12, color: 'var(--textSec,#ccc)' }}>{label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: (count / maxCount) * 60, height: 4, borderRadius: 2, background: color }} />
                      <span style={{ fontSize: 12, color: 'var(--text,#fff)', fontWeight: 500, minWidth: 20, textAlign: 'right' }}>{count}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--textMuted,#888)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Mehrwert-Berechnung</div>
              <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#10b981', marginBottom: 8 }}>{estimatedValue}€</div>
                <div style={{ fontSize: 11, color: 'var(--textMuted,#888)', lineHeight: 1.6 }}>
                  {marcoStats.total} Anfragen × Ø 8 Min. = {Math.round(marcoStats.total * 8 / 60)} Std. Personalkosten eingespart<br />
                  Restaurant Upselling: {restaurantRev.toFixed(0)}€<br />
                  Spa Buchungen: {spaCount} × 25€ Marge
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--textDim,#333)', padding: '8px 0' }}>
        {tier === 'concierge'
          ? 'Daten aus Supabase Realtime · service_requests, restaurant_orders, spa_bookings'
          : 'Daten aus Supabase Realtime · bookings, service_requests, restaurant_orders, spa_bookings, feedback'}
      </div>
    </div>
  )
}
