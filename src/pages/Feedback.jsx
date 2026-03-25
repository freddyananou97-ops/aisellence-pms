import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'

export default function Feedback() {
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('alle')
  const [selected, setSelected] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [savingResponse, setSavingResponse] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newFeedback, setNewFeedback] = useState({ guest_name: '', room_number: '', message: '', overall_rating: 5 })
  const [visibleCount, setVisibleCount] = useState(50)

  const load = useCallback(async () => {
    const { data } = await supabase.from('feedback').select('*').order('submitted_at', { ascending: false })
    setFeedbacks(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load(); const u = subscribeToTable('feedback', () => load()); return u }, [load])

  const isPositive = (f) => (f.overall_rating || 5) >= 4
  const positiveCount = feedbacks.filter(f => isPositive(f)).length
  const negativeCount = feedbacks.filter(f => !isPositive(f)).length
  const total = feedbacks.length
  const posPercent = total > 0 ? Math.round((positiveCount / total) * 100) : 0

  const filtered = filter === 'alle' ? feedbacks : filter === 'positiv' ? feedbacks.filter(f => isPositive(f)) : feedbacks.filter(f => !isPositive(f))

  const openFeedback = (f) => {
    setSelected(f)
    setResponseText(f.response || '')
  }

  const saveResponse = async () => {
    if (!selected) return
    setSavingResponse(true)
    await supabase.from('feedback').update({ response: responseText }).eq('id', selected.id)
    setSavingResponse(false)
    setSelected(null); load()
  }

  const escalate = async (f) => {
    await supabase.from('feedback').update({ escalated_to_reception: true }).eq('id', f.id)
    load()
  }

  const resolve = async (f) => {
    await supabase.from('feedback').update({ resolved: true }).eq('id', f.id)
    load()
  }

  const createFeedback = async () => {
    await supabase.from('feedback').insert({
      guest_name: newFeedback.guest_name, room_number: newFeedback.room_number,
      message: newFeedback.message, overall_rating: newFeedback.overall_rating,
      submitted_at: new Date().toISOString(),
    })
    setShowNew(false)
    setNewFeedback({ guest_name: '', room_number: '', message: '', overall_rating: 5 })
    load()
  }

  // Monthly chart data (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const month = d.toLocaleDateString('de-DE', { month: 'short' })
    const year = d.getFullYear(); const m = d.getMonth()
    const monthFeedbacks = feedbacks.filter(f => {
      const fd = new Date(f.submitted_at); return fd.getFullYear() === year && fd.getMonth() === m
    })
    const pos = monthFeedbacks.filter(f => isPositive(f)).length
    const neg = monthFeedbacks.filter(f => !isPositive(f)).length
    return { month, pos, neg, total: pos + neg }
  })
  const maxMonthly = Math.max(...monthlyData.map(m => m.total), 1)

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={s.content}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={s.h1}>Gästefeedback</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted)', marginTop: -12 }}>{total} Bewertungen · {posPercent}% positiv</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#10b981', color: '#fff', border: 'none' }}>+ Feedback erfassen</button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 10, marginBottom: 16 }}>
        <div style={s.kpi}>
          <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Gesamt</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)' }}>{total}</div>
        </div>
        <div style={s.kpi}>
          <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Positiv</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#10b981' }}>{positiveCount}</div>
        </div>
        <div style={s.kpi}>
          <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>Negativ</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#ef4444' }}>{negativeCount}</div>
        </div>

        {/* Donut + Bar Chart */}
        <div style={{ ...s.kpi, display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px' }}>
          {/* Donut */}
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
            <svg viewBox="0 0 36 36" style={{ width: 64, height: 64, transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(239,68,68,0.2)" strokeWidth="4" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="4"
                strokeDasharray={`${total > 0 ? (positiveCount / total) * 88 : 0} 88`} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{posPercent}%</span>
            </div>
          </div>

          {/* Monthly bars */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
            {monthlyData.map((m, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {m.neg > 0 && <div style={{ height: Math.max(2, (m.neg / maxMonthly) * 35), background: '#ef4444', borderRadius: '2px 2px 0 0' }} />}
                  {m.pos > 0 && <div style={{ height: Math.max(2, (m.pos / maxMonthly) * 35), background: '#10b981', borderRadius: m.neg > 0 ? '0' : '2px 2px 0 0' }} />}
                  {m.total === 0 && <div style={{ height: 2, background: 'var(--border)' }} />}
                </div>
                <div style={{ fontSize: 8, color: 'var(--textDim)', marginTop: 3 }}>{m.month}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['alle', `Alle ${total}`], ['positiv', `Positiv ${positiveCount}`], ['negativ', `Negativ ${negativeCount}`]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
            background: filter === k ? (k === 'positiv' ? 'rgba(16,185,129,0.1)' : k === 'negativ' ? 'rgba(239,68,68,0.1)' : 'var(--text)') : 'var(--bgCard)',
            color: filter === k ? (k === 'positiv' ? '#10b981' : k === 'negativ' ? '#ef4444' : 'var(--bg)') : 'var(--textMuted)',
            border: `1px solid ${filter === k ? (k === 'positiv' ? '#10b981' : k === 'negativ' ? '#ef4444' : 'var(--text)') : 'var(--borderLight)'}`,
          }}>{l}</button>
        ))}
      </div>

      {/* Feedback List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.slice(0, visibleCount).map(f => {
          const pos = isPositive(f)
          const color = pos ? '#10b981' : '#ef4444'
          return (
            <div key={f.id} onClick={() => openFeedback(f)} style={{
              background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderLeft: `4px solid ${color}`,
              borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: `${color}10`, color, fontWeight: 500 }}>{pos ? 'Positiv' : 'Negativ'}</span>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{f.guest_name || 'Anonym'}</span>
                  {f.room_number && <span style={{ fontSize: 10, color: 'var(--textDim)' }}>Zi. {f.room_number}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {f.escalated_to_reception && !f.resolved && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>Eskaliert</span>}
                  {f.resolved && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>Gelöst</span>}
                  {f.response && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>Notiz</span>}
                  <span style={{ fontSize: 10, color: 'var(--textDim)' }}>{f.submitted_at ? new Date(f.submitted_at).toLocaleDateString('de-DE') : ''}</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--textSec)', lineHeight: 1.5, margin: 0 }}>{f.message || 'Keine Nachricht'}</p>
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Keine Feedbacks</div>}
        {filtered.length > visibleCount && (
          <button onClick={() => setVisibleCount(v => v + 50)} style={{ width: '100%', padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
            Mehr laden ({visibleCount} von {filtered.length} angezeigt)
          </button>
        )}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={s.overlay} onClick={() => setSelected(null)}>
          <div style={{ ...s.modal, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{selected.guest_name || 'Anonym'}</h3>
                <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{selected.room_number ? `Zimmer ${selected.room_number} · ` : ''}{selected.submitted_at ? new Date(selected.submitted_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}</span>
              </div>
              <button onClick={() => setSelected(null)} style={s.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '12px 16px', background: isPositive(selected) ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${isPositive(selected) ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 10, color: isPositive(selected) ? '#10b981' : '#ef4444', fontWeight: 500 }}>{isPositive(selected) ? 'Positives Feedback' : 'Negatives Feedback'}</span>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, margin: '8px 0 0' }}>{selected.message || 'Keine Nachricht'}</p>
            </div>

            {[
              ['Buchungs-ID', selected.booking_id || '—'],
              ['Eskaliert', selected.escalated_to_reception ? 'Ja' : 'Nein'],
              ['Gelöst', selected.resolved ? 'Ja' : 'Nein'],
            ].map(([l, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{l}</span>
                <span style={{ fontSize: 11, color: 'var(--textSec)' }}>{v}</span>
              </div>
            ))}

            {/* Internal Note */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Interne Notiz</div>
              <textarea value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Notiz zur Nachverfolgung..."
                style={{ width: '100%', padding: '10px 12px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', minHeight: 60, resize: 'vertical' }} />
              <button onClick={saveResponse} disabled={savingResponse} style={{ marginTop: 6, padding: '8px 14px', background: responseText !== (selected.response || '') ? '#3b82f6' : 'var(--bgCard)', border: responseText !== (selected.response || '') ? 'none' : '1px solid var(--borderLight)', borderRadius: 6, fontSize: 11, color: responseText !== (selected.response || '') ? '#fff' : 'var(--textDim)', cursor: responseText !== (selected.response || '') ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {savingResponse ? 'Speichert...' : responseText !== (selected.response || '') ? 'Notiz speichern' : 'Gespeichert'}
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {!isPositive(selected) && !selected.escalated_to_reception && (
                <button onClick={() => { escalate(selected); setSelected(null) }} style={{ flex: 1, padding: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 11, color: '#ef4444', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>An Rezeption eskalieren</button>
              )}
              {!selected.resolved && (
                <button onClick={() => { resolve(selected); setSelected(null) }} style={{ flex: 1, padding: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 11, color: '#10b981', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Als gelöst markieren</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Feedback Modal */}
      {showNew && (
        <div style={s.overlay} onClick={() => setShowNew(false)}>
          <div style={{ ...s.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Feedback erfassen</h3>
              <button onClick={() => setShowNew(false)} style={s.closeBtn}>✕</button>
            </div>

            <label style={s.label}>Gastname</label>
            <input style={s.input} placeholder="Name des Gastes" value={newFeedback.guest_name} onChange={e => setNewFeedback(p => ({ ...p, guest_name: e.target.value }))} />

            <label style={s.label}>Zimmernummer</label>
            <input style={s.input} placeholder="z.B. 101" value={newFeedback.room_number} onChange={e => setNewFeedback(p => ({ ...p, room_number: e.target.value }))} />

            <label style={s.label}>Bewertung</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[['positiv', 5, '#10b981'], ['negativ', 1, '#ef4444']].map(([l, val, col]) => (
                <button key={l} onClick={() => setNewFeedback(p => ({ ...p, overall_rating: val }))} style={{
                  flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, textAlign: 'center',
                  background: newFeedback.overall_rating === val ? `${col}10` : 'var(--bgCard)',
                  color: newFeedback.overall_rating === val ? col : 'var(--textMuted)',
                  border: `2px solid ${newFeedback.overall_rating === val ? col : 'var(--borderLight)'}`,
                }}>{l.charAt(0).toUpperCase() + l.slice(1)}</button>
              ))}
            </div>

            <label style={s.label}>Feedback</label>
            <textarea style={{ ...s.input, minHeight: 80, resize: 'vertical' }} placeholder="Was hat der Gast gesagt?" value={newFeedback.message} onChange={e => setNewFeedback(p => ({ ...p, message: e.target.value }))} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={createFeedback} disabled={!newFeedback.message} style={{ flex: 1, padding: 12, background: newFeedback.message ? '#10b981' : 'var(--bgCard)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: newFeedback.message ? '#fff' : 'var(--textDim)', cursor: newFeedback.message ? 'pointer' : 'default', fontFamily: 'inherit' }}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 1000 },
  h1: { fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '0 0 16px', letterSpacing: -0.5 },
  kpi: { background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, padding: 16, textAlign: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440 },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '10px 12px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit' },
}
