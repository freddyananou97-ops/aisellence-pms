import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'
import { getAllPrices } from '../lib/pricing'
import { syncPriceToBeds24 } from '../lib/beds24'
import ConfirmDialog from '../components/ConfirmDialog'

const TYPE_LABELS = { season: 'Saison', special: 'Sonder', event: 'Event' }
const TYPE_COLORS = { season: '#3b82f6', special: '#f59e0b', event: '#ef4444', base: '#6b7280' }

export default function RateManagement() {
  const [tab, setTab] = useState('kalender')
  const [categories, setCategories] = useState([])
  const [rules, setRules] = useState([])
  const [competitors, setCompetitors] = useState([])
  const [compHotels, setCompHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)
  const [showRule, setShowRule] = useState(null)
  const [showCat, setShowCat] = useState(null)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [calPrices, setCalPrices] = useState({})
  const [selectedDay, setSelectedDay] = useState(null)
  const [scraping, setScraping] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    const [cats, rl, cp, ch] = await Promise.all([
      supabase.from('room_categories').select('*').eq('active', true).order('base_price'),
      supabase.from('rate_rules').select('*').order('priority', { ascending: false }),
      supabase.from('competitor_prices').select('*').order('scraped_at', { ascending: false }).limit(200),
      supabase.from('competitor_hotels').select('*').eq('active', true),
    ])
    setCategories(cats.data || []); setRules(rl.data || []); setCompetitors(cp.data || []); setCompHotels(ch.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load(); const u = subscribeToTable('rate_rules', () => load()); return u }, [load])

  // Load calendar prices when month changes
  useEffect(() => {
    const loadCalPrices = async () => {
      const year = calMonth.getFullYear(); const month = calMonth.getMonth()
      const days = new Date(year, month + 1, 0).getDate()
      const prices = {}
      for (let d = 1; d <= days; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        prices[dateStr] = await getAllPrices(dateStr)
      }
      setCalPrices(prices)
    }
    if (categories.length > 0) loadCalPrices()
  }, [calMonth, categories.length, rules]) // eslint-disable-line react-hooks/exhaustive-deps

  const scrapeCompetitors = async () => {
    setScraping(true)
    try {
      const res = await fetch('/api/scrape-competitors', { method: 'POST' })
      const data = await res.json()
      setConfirm({ title: 'Scraping abgeschlossen', message: `${data.prices?.length || 0} Hotels geprüft für ${data.date || 'morgen'}.`, confirmLabel: 'OK', confirmColor: '#10b981', onConfirm: () => { setConfirm(null); load() } })
    } catch (e) {
      setConfirm({ title: 'Fehler', message: e.message, confirmLabel: 'OK', confirmColor: '#ef4444', onConfirm: () => setConfirm(null) })
    }
    setScraping(false)
  }

  const saveRule = async (data) => {
    if (data.id) {
      await supabase.from('rate_rules').update(data).eq('id', data.id)
    } else {
      await supabase.from('rate_rules').insert(data)
    }
    setShowRule(null); load()
  }

  const deleteRule = async (id) => {
    await supabase.from('rate_rules').delete().eq('id', id)
    load()
  }

  const saveCat = async (data) => {
    if (data.id) {
      await supabase.from('room_categories').update(data).eq('id', data.id)
    } else {
      await supabase.from('room_categories').insert(data)
    }
    setShowCat(null); load()
  }

  const syncRule = async (rule) => {
    const cat = categories.find(c => c.id === rule.category_id)
    if (!cat?.beds24_room_id) { setConfirm({ title: 'Fehler', message: 'Keine Beds24 Room ID verknüpft.', confirmLabel: 'OK', confirmColor: '#ef4444', onConfirm: () => setConfirm(null) }); return }
    const price = rule.price_type === 'fixed' ? rule.price_value : cat.base_price * (1 + rule.price_value / 100)
    const result = await syncPriceToBeds24(cat.beds24_room_id, rule.start_date, rule.end_date, price)
    if (result.success) {
      await supabase.from('rate_rules').update({ synced_to_beds24: true }).eq('id', rule.id)
      load()
    }
    setConfirm({ title: result.success ? 'Synchronisiert' : 'Fehler', message: result.success ? 'Preis an Beds24 gesendet.' : result.error, confirmLabel: 'OK', confirmColor: result.success ? '#10b981' : '#ef4444', onConfirm: () => setConfirm(null) })
  }

  // Calendar helpers
  const year = calMonth.getFullYear(); const month = calMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay() || 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const calCells = []
  for (let i = 1; i < firstDay; i++) calCells.push(null)
  for (let i = 1; i <= daysInMonth; i++) calCells.push(i)

  // Competitor data for next 14 days
  const next14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0] })

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={s.content}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Rate Management</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted)', margin: '4px 0 0' }}>{categories.length} Kategorien · {rules.filter(r => r.active).length} aktive Regeln</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['kalender', 'Kalender'], ['regeln', `Preisregeln (${rules.length})`], ['kategorien', `Kategorien (${categories.length})`], ['konkurrenz', 'Konkurrenz']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: tab === k ? 'var(--text)' : 'var(--bgCard)', color: tab === k ? 'var(--bg)' : 'var(--textMuted)', border: `1px solid ${tab === k ? 'var(--text)' : 'var(--borderLight)'}` }}>{l}</button>
        ))}
      </div>

      {/* ====== KALENDER TAB ====== */}
      {tab === 'kalender' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} style={s.navBtn}>←</button>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', minWidth: 140, textAlign: 'center' }}>{calMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} style={s.navBtn}>→</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(TYPE_COLORS).map(([k, c]) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: c }} /><span style={{ fontSize: 9, color: 'var(--textDim)' }}>{TYPE_LABELS[k] || 'Basis'}</span></div>)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => <div key={d} style={{ fontSize: 10, color: 'var(--textDim)', textAlign: 'center', padding: 4 }}>{d}</div>)}
          {calCells.map((day, i) => {
            if (!day) return <div key={i} />
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayPrices = calPrices[dateStr] || []
            const isToday = dateStr === todayStr
            const mainPrice = dayPrices[0]
            const source = mainPrice?.source || 'base'
            return (
              <button key={i} onClick={() => setSelectedDay({ date: dateStr, prices: dayPrices })} style={{
                padding: '6px 4px', textAlign: 'center', cursor: 'pointer', borderRadius: 8, border: isToday ? '2px solid #3b82f6' : '1px solid var(--borderLight)',
                background: 'var(--bgCard)', fontFamily: 'inherit', minHeight: 64, display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                <div style={{ fontSize: 12, color: isToday ? '#3b82f6' : 'var(--text)', fontWeight: isToday ? 600 : 400 }}>{day}</div>
                {mainPrice && <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: TYPE_COLORS[source], marginTop: 4 }}>{mainPrice.effectivePrice}€</div>
                  {dayPrices.length > 1 && <div style={{ fontSize: 8, color: 'var(--textDim)' }}>+{dayPrices.length - 1}</div>}
                </>}
              </button>
            )
          })}
        </div>

        {/* Day detail panel */}
        {selectedDay && (
          <div style={{ marginTop: 16, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{new Date(selectedDay.date + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
              <button onClick={() => { setShowRule({ start_date: selectedDay.date, end_date: selectedDay.date, type: 'special', price_type: 'fixed', price_value: '', name: '', category_id: '', priority: 10, active: true }) }} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', fontWeight: 500 }}>Preis anpassen</button>
            </div>
            {selectedDay.prices.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--textSec)' }}>{p.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TYPE_COLORS[p.source] }}>{p.effectivePrice}€</span>
                  {p.source !== 'base' && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${TYPE_COLORS[p.source]}12`, color: TYPE_COLORS[p.source] }}>{p.ruleName || TYPE_LABELS[p.source]}</span>}
                </div>
              </div>
            ))}
            {/* Competitor prices for this day */}
            {(() => {
              const dayComp = competitors.filter(c => c.date_checked === selectedDay.date)
              if (dayComp.length === 0) return null
              return <>
                <div style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 }}>Konkurrenz</div>
                {dayComp.map((c, i) => {
                  const own = selectedDay.prices[0]?.effectivePrice || 0
                  const diff = c.price - own
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{c.hotel_name}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text)' }}>{c.price}€</span>
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: diff < 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: diff < 0 ? '#10b981' : '#ef4444' }}>{diff > 0 ? '+' : ''}{diff.toFixed(0)}€</span>
                      </div>
                    </div>
                  )
                })}
              </>
            })()}
          </div>
        )}
      </>}

      {/* ====== PREISREGELN TAB ====== */}
      {tab === 'regeln' && <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={() => setShowRule({ name: '', category_id: '', type: 'season', start_date: '', end_date: '', price_type: 'fixed', price_value: '', priority: 0, active: true })} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#3b82f6', color: '#fff', border: 'none' }}>+ Neue Regel</button>
        </div>
        <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px 100px 80px 60px 60px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
            {['Name', 'Kategorie', 'Typ', 'Zeitraum', 'Preis', 'Priorität', 'Sync', ''].map(h => <span key={h} style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>)}
          </div>
          {rules.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Preisregeln</div> : rules.map(r => {
            const cat = categories.find(c => c.id === r.category_id)
            return (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px 100px 80px 60px 60px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8, alignItems: 'center', opacity: r.active ? 1 : 0.5 }}>
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{r.name}</span>
                <span style={{ fontSize: 10, color: 'var(--textMuted)' }}>{cat?.name || 'Alle'}</span>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${TYPE_COLORS[r.type]}12`, color: TYPE_COLORS[r.type], fontWeight: 500, textAlign: 'center' }}>{TYPE_LABELS[r.type]}</span>
                <span style={{ fontSize: 10, color: 'var(--textMuted)' }}>{r.start_date?.slice(5)} — {r.end_date?.slice(5)}</span>
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{r.price_type === 'fixed' ? `${r.price_value}€` : `${r.price_value > 0 ? '+' : ''}${r.price_value}%`}</span>
                <span style={{ fontSize: 11, color: 'var(--textMuted)', textAlign: 'center' }}>{r.priority}</span>
                <span style={{ fontSize: 10, color: r.synced_to_beds24 ? '#10b981' : 'var(--textDim)', textAlign: 'center' }}>{r.synced_to_beds24 ? '✓' : '○'}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setShowRule({ ...r })} style={{ fontSize: 9, padding: '3px 6px', borderRadius: 4, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>✎</button>
                  <button onClick={() => syncRule(r)} style={{ fontSize: 9, padding: '3px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', cursor: 'pointer', fontFamily: 'inherit' }}>↑</button>
                </div>
              </div>
            )
          })}
        </div>
      </>}

      {/* ====== KATEGORIEN TAB ====== */}
      {tab === 'kategorien' && <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={() => setShowCat({ name: '', base_price: '', max_occupancy: 2, description: '', beds24_room_id: '', active: true })} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#10b981', color: '#fff', border: 'none' }}>+ Neue Kategorie</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{cat.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--textMuted)', marginTop: 2 }}>{cat.description || ''}</div>
                </div>
                <button onClick={() => setShowCat({ ...cat })} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Bearbeiten</button>
              </div>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div style={{ fontSize: 9, color: 'var(--textDim)', textTransform: 'uppercase' }}>Basispreis</div><div style={{ fontSize: 20, fontWeight: 600, color: '#10b981' }}>{cat.base_price}€</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--textDim)', textTransform: 'uppercase' }}>Max. Belegung</div><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{cat.max_occupancy}P</div></div>
              </div>
              {cat.beds24_room_id && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--textDim)' }}>Beds24: {cat.beds24_room_id}</div>}
            </div>
          ))}
        </div>
      </>}

      {/* ====== KONKURRENZ TAB ====== */}
      {tab === 'konkurrenz' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--textMuted)' }}>
            Letztes Scraping: {competitors[0]?.scraped_at ? new Date(competitors[0].scraped_at).toLocaleString('de-DE') : 'Noch nie'}
          </div>
          <button onClick={scrapeCompetitors} disabled={scraping} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#3b82f6', color: '#fff', border: 'none', opacity: scraping ? 0.6 : 1 }}>{scraping ? 'Scraping läuft...' : 'Konkurrenzpreise aktualisieren'}</button>
        </div>

        {/* 14-day comparison */}
        <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Preisvergleich — nächste 14 Tage</div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(14, minmax(60px, 1fr))`, minWidth: 1000 }}>
              <div style={{ padding: '8px 12px', fontSize: 10, color: 'var(--textDim)', borderBottom: '1px solid var(--border)' }}>Hotel</div>
              {next14.map(d => <div key={d} style={{ padding: '8px 4px', fontSize: 9, color: d === todayStr ? '#3b82f6' : 'var(--textDim)', textAlign: 'center', borderBottom: '1px solid var(--border)', fontWeight: d === todayStr ? 600 : 400 }}>{new Date(d + 'T12:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>)}

              {/* Own price row */}
              <div style={{ padding: '8px 12px', fontSize: 11, color: '#10b981', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Unser Preis</div>
              {next14.map(d => { const p = calPrices[d]?.[0]; return <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, color: '#10b981', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{p ? `${p.effectivePrice}€` : '—'}</div> })}

              {/* Competitor rows */}
              {compHotels.map(h => (
                <div key={h.id} style={{ display: 'contents' }}>
                  <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--textSec)', borderBottom: '1px solid var(--border)' }}>{h.hotel_name.split(' ').slice(0, 2).join(' ')}</div>
                  {next14.map(d => {
                    const cp = competitors.find(c => c.hotel_name === h.hotel_name && c.date_checked === d)
                    return <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, color: cp ? 'var(--text)' : 'var(--textDim)', borderBottom: '1px solid var(--border)' }}>{cp ? `${cp.price}€` : '—'}</div>
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </>}

      {/* ====== RULE MODAL ====== */}
      {showRule && (
        <div style={s.overlay} onClick={() => setShowRule(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 16px' }}>{showRule.id ? 'Regel bearbeiten' : 'Neue Preisregel'}</h3>
            <label style={s.label}>Name</label><input style={s.input} value={showRule.name} onChange={e => setShowRule(p => ({ ...p, name: e.target.value }))} placeholder="z.B. Sommersaison 2026" />
            <label style={s.label}>Kategorie</label><select style={s.input} value={showRule.category_id || ''} onChange={e => setShowRule(p => ({ ...p, category_id: e.target.value || null }))}>
              <option value="">Alle Kategorien</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={s.label}>Typ</label><select style={s.input} value={showRule.type} onChange={e => setShowRule(p => ({ ...p, type: e.target.value }))}><option value="season">Saison</option><option value="special">Sonder</option><option value="event">Event</option></select></div>
              <div><label style={s.label}>Priorität</label><input style={s.input} type="number" value={showRule.priority} onChange={e => setShowRule(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={s.label}>Von</label><input style={s.input} type="date" value={showRule.start_date} onChange={e => setShowRule(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><label style={s.label}>Bis</label><input style={s.input} type="date" value={showRule.end_date} onChange={e => setShowRule(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={s.label}>Preisart</label><select style={s.input} value={showRule.price_type} onChange={e => setShowRule(p => ({ ...p, price_type: e.target.value }))}><option value="fixed">Festpreis (€)</option><option value="percentage">Prozent (%)</option></select></div>
              <div><label style={s.label}>Wert</label><input style={s.input} type="number" value={showRule.price_value} onChange={e => setShowRule(p => ({ ...p, price_value: e.target.value }))} placeholder={showRule.price_type === 'fixed' ? '149' : '+20'} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setShowRule(null)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              {showRule.id && <button onClick={() => { deleteRule(showRule.id); setShowRule(null) }} style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }}>Löschen</button>}
              <button onClick={() => saveRule(showRule)} disabled={!showRule.name || !showRule.start_date || !showRule.end_date} style={{ flex: 1, padding: 12, background: '#3b82f6', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== CATEGORY MODAL ====== */}
      {showCat && (
        <div style={s.overlay} onClick={() => setShowCat(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 16px' }}>{showCat.id ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h3>
            <label style={s.label}>Name</label><input style={s.input} value={showCat.name} onChange={e => setShowCat(p => ({ ...p, name: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={s.label}>Basispreis (€)</label><input style={s.input} type="number" value={showCat.base_price} onChange={e => setShowCat(p => ({ ...p, base_price: e.target.value }))} /></div>
              <div><label style={s.label}>Max. Belegung</label><input style={s.input} type="number" value={showCat.max_occupancy} onChange={e => setShowCat(p => ({ ...p, max_occupancy: parseInt(e.target.value) || 2 }))} /></div>
            </div>
            <label style={s.label}>Beschreibung</label><input style={s.input} value={showCat.description || ''} onChange={e => setShowCat(p => ({ ...p, description: e.target.value }))} />
            <label style={s.label}>Beds24 Room ID</label><input style={s.input} value={showCat.beds24_room_id || ''} onChange={e => setShowCat(p => ({ ...p, beds24_room_id: e.target.value }))} placeholder="Optional" />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setShowCat(null)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={() => saveCat(showCat)} disabled={!showCat.name || !showCat.base_price} style={{ flex: 1, padding: 12, background: '#10b981', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Speichern</button>
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
  navBtn: { padding: '6px 10px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', color: 'var(--textMuted)' },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto' },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '10px 14px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 14, fontFamily: 'inherit' },
}
