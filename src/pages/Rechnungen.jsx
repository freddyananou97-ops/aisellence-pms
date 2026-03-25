import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'
import { loadInvoiceData, openInvoicePDF } from '../lib/invoice'

export default function Rechnungen() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [charges, setCharges] = useState([])
  const [dateFilter, setDateFilter] = useState('alle')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('bookings').select('*').order('check_out', { ascending: false })
    setBookings(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load(); const u = subscribeToTable('bookings', () => load()); return u }, [load])

  const nights = (ci, co) => Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000))

  const openDetail = async (b) => {
    setSelected(b)
    const ch = await loadInvoiceData(b)
    setCharges(ch)
  }

  // Date helpers
  const todayStr = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const getDateRange = () => {
    if (dateFilter === 'heute') return [todayStr, todayStr]
    if (dateFilter === 'woche') return [weekAgo, todayStr]
    if (dateFilter === 'monat') return [monthStart, todayStr]
    if (dateFilter === 'custom' && customFrom && customTo) return [customFrom, customTo]
    return [null, null]
  }

  const [rangeFrom, rangeTo] = getDateRange()

  // Only checked_out bookings for the archive
  const completed = bookings.filter(b => b.status === 'checked_out')

  const filtered = completed.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q || b.guest_name?.toLowerCase().includes(q) || b.room?.includes(q) || b.booking_id?.toLowerCase().includes(q)
    const coDate = b.checked_out_at ? b.checked_out_at.split('T')[0] : b.check_out
    const matchDate = !rangeFrom || (coDate >= rangeFrom && coDate <= rangeTo)
    return matchSearch && matchDate
  })

  const totalRevenue = filtered.reduce((s, b) => s + (parseFloat(b.amount_due) || 0), 0)
  const openAmount = bookings.filter(b => b.status === 'checked_in').reduce((s, b) => s + (parseFloat(b.amount_due) || 0), 0)

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={s.content}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={s.h1}>Rechnungen</h1>
        <p style={{ fontSize: 12, color: 'var(--textMuted)', marginTop: -12 }}>{completed.length} abgeschlossene Rechnungen</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={s.kpi}>
          <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>{dateFilter === 'alle' ? 'Gesamt abgeschlossen' : `Umsatz (${dateFilter === 'heute' ? 'heute' : dateFilter === 'woche' ? 'diese Woche' : dateFilter === 'monat' ? 'dieser Monat' : 'Zeitraum'})`}</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#10b981' }}>{totalRevenue.toLocaleString('de-DE', { minimumFractionDigits: 0 })}€</div>
          <div style={{ fontSize: 10, color: 'var(--textDim)', marginTop: 2 }}>{filtered.length} Rechnungen</div>
        </div>
        <div style={s.kpi}>
          <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Offen (eingecheckt)</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#f59e0b' }}>{openAmount.toLocaleString('de-DE', { minimumFractionDigits: 0 })}€</div>
          <div style={{ fontSize: 10, color: 'var(--textDim)', marginTop: 2 }}>{bookings.filter(b => b.status === 'checked_in').length} Gäste</div>
        </div>
        <div style={s.kpi}>
          <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Durchschnitt / Rechnung</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{filtered.length > 0 ? Math.round(totalRevenue / filtered.length) : 0}€</div>
        </div>
      </div>

      {/* Search + Date Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Gast, Zimmer oder Buchungs-ID..."
          style={{ flex: 1, minWidth: 200, padding: '10px 14px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
        {[['alle', 'Alle'], ['heute', 'Heute'], ['woche', 'Woche'], ['monat', 'Monat'], ['custom', 'Zeitraum']].map(([k, l]) => (
          <button key={k} onClick={() => setDateFilter(k)} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
            background: dateFilter === k ? 'var(--text)' : 'var(--bgCard)', color: dateFilter === k ? 'var(--bg)' : 'var(--textMuted)',
            border: `1px solid ${dateFilter === k ? 'var(--text)' : 'var(--borderLight)'}`,
          }}>{l}</button>
        ))}
      </div>

      {dateFilter === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--text)', fontFamily: 'inherit' }} />
          <span style={{ fontSize: 12, color: 'var(--textDim)' }}>bis</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--text)', fontFamily: 'inherit' }} />
        </div>
      )}

      {/* Table */}
      <div style={s.card}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 60px 90px 60px 70px 80px 60px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
          {['Rechnung', 'Gast', 'Zi.', 'Check-out', 'Nächte', 'Betrag', 'Zahlung', 'PDF'].map(h => (
            <span key={h} style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>{h}</span>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Rechnungen im gewählten Zeitraum</div>
        ) : filtered.map(b => {
          const invoiceNr = `RE-${new Date(b.check_out).getFullYear()}-${String(b.booking_id || b.id).slice(-4).toUpperCase()}`
          return (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 60px 90px 60px 70px 80px 60px', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 8, cursor: 'pointer' }}
              onClick={() => openDetail(b)}>
              <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 500 }}>{invoiceNr}</span>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{b.guest_name}</span>
              <span style={{ fontSize: 12, color: 'var(--textSec)' }}>{b.room}</span>
              <span style={{ fontSize: 12, color: 'var(--textSec)' }}>{b.check_out}</span>
              <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{nights(b.check_in, b.check_out)}</span>
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{parseFloat(b.amount_due || 0).toFixed(0)}€</span>
              <span style={{ fontSize: 9, color: 'var(--textDim)' }}>{b.payment_method || '—'}</span>
              <button onClick={async (e) => { e.stopPropagation(); const ch = await loadInvoiceData(b); openInvoicePDF(b, ch) }} style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, fontSize: 10, color: '#3b82f6', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>PDF</button>
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
                <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Rechnung</h3>
                <span style={{ fontSize: 11, color: '#3b82f6' }}>RE-{new Date(selected.check_out).getFullYear()}-{String(selected.booking_id || selected.id).slice(-4).toUpperCase()}</span>
              </div>
              <button onClick={() => setSelected(null)} style={s.closeBtn}>✕</button>
            </div>

            {[
              ['Gast', selected.guest_name],
              ['Zimmer', selected.room],
              ['Check-in', selected.check_in],
              ['Check-out', selected.check_out],
              ['Nächte', nights(selected.check_in, selected.check_out)],
              ['Quelle', selected.source || 'Direkt'],
              ['Zahlungsart', selected.payment_method || '—'],
              ['Buchungs-ID', selected.booking_id || '—'],
            ].map(([l, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{l}</span>
                <span style={{ fontSize: 11, color: 'var(--textSec)' }}>{v}</span>
              </div>
            ))}

            {/* Positions */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Positionen</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--textSec)' }}>Übernachtung ({nights(selected.check_in, selected.check_out)} Nächte)</span>
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{parseFloat(selected.amount_due || 0).toFixed(2)}€</span>
              </div>
              {charges.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, marginRight: 6, background: c.type === 'Room Service' ? 'rgba(245,158,11,0.08)' : c.type === 'Minibar' ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)', color: c.type === 'Room Service' ? '#f59e0b' : c.type === 'Minibar' ? '#8b5cf6' : '#3b82f6' }}>{c.type}</span>
                    <span style={{ fontSize: 11, color: 'var(--textSec)' }}>{c.details}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{c.amount.toFixed(2)}€</span>
                </div>
              ))}

              {/* Totals */}
              {(() => {
                const roomTotal = parseFloat(selected.amount_due || 0)
                const chargesTotal = charges.reduce((s, c) => s + c.amount, 0)
                const grand = roomTotal + chargesTotal
                const netto7 = roomTotal / 1.07; const mwst7 = roomTotal - netto7
                const netto19 = chargesTotal / 1.19; const mwst19 = chargesTotal - netto19
                return <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid var(--border)', marginTop: 4, fontWeight: 600 }}>
                    <span style={{ fontSize: 14, color: 'var(--text)' }}>Gesamtbetrag</span>
                    <span style={{ fontSize: 16, color: '#10b981' }}>{grand.toFixed(2)}€</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10, color: 'var(--textDim)' }}>
                    <span>Übernachtung netto (7% MwSt: {mwst7.toFixed(2)}€)</span><span>{netto7.toFixed(2)}€</span>
                  </div>
                  {chargesTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10, color: 'var(--textDim)' }}>
                      <span>Services netto (19% MwSt: {mwst19.toFixed(2)}€)</span><span>{netto19.toFixed(2)}€</span>
                    </div>
                  )}
                </>
              })()}
            </div>

            <button onClick={() => openInvoicePDF(selected, charges)} style={{ width: '100%', marginTop: 16, padding: 12, background: '#3b82f6', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Rechnung als PDF öffnen</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 1400 },
  h1: { fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '0 0 16px', letterSpacing: -0.5 },
  card: { background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' },
  kpi: { background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, padding: 16, textAlign: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440 },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
