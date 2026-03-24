import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'

const CATEGORIES = [
  { id: 'übergabe', label: 'Übergabe', color: '#3b82f6' },
  { id: 'beschwerde', label: 'Beschwerde', color: '#ef4444' },
  { id: 'wartung', label: 'Wartung', color: '#f59e0b' },
  { id: 'vip', label: 'VIP', color: '#8b5cf6' },
  { id: 'allgemein', label: 'Allgemein', color: '#6b7280' },
]

const PRIORITIES = [
  { id: 'normal', label: 'Normal', color: '#6b7280' },
  { id: 'wichtig', label: 'Wichtig', color: '#f59e0b' },
  { id: 'dringend', label: 'Dringend', color: '#ef4444' },
]

function getCurrentShift() {
  const h = new Date().getHours()
  if (h >= 6 && h < 14) return 'früh'
  if (h >= 14 && h < 22) return 'spät'
  return 'nacht'
}

export default function Schichtbuch({ user }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('alle')

  const load = useCallback(async () => {
    const { data } = await supabase.from('shift_logs').select('*').order('created_at', { ascending: false }).limit(50)
    setEntries(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const unsub = subscribeToTable('shift_logs', () => load())
    return unsub
  }, [load])

  const acknowledge = async (id) => {
    await supabase.from('shift_logs').update({ acknowledged: true, acknowledged_by: user?.name || 'Admin' }).eq('id', id)
    load()
  }

  const markDone = async (id) => {
    await supabase.from('shift_logs').update({ status: 'done' }).eq('id', id)
    load()
  }

  const deleteEntry = async (id) => {
    await supabase.from('shift_logs').delete().eq('id', id)
    load()
  }

  const addEntry = async (entry) => {
    await supabase.from('shift_logs').insert({
      employee_name: user?.name || 'Admin',
      category: entry.category,
      priority: entry.priority,
      message: entry.message,
      room: entry.room || null,
      shift: getCurrentShift(),
    })
    setShowForm(false)
    load()
  }

  const filtered = filter === 'alle' ? entries : entries.filter(e => e.category === filter)
  const unread = entries.filter(e => !e.acknowledged).length

  return (
    <div style={s.content}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Schichtbuch</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {getCurrentShift() === 'früh' ? 'Frühschicht' : getCurrentShift() === 'spät' ? 'Spätschicht' : 'Nachtschicht'} · {unread} ungelesen
          </p>
        </div>
        <button style={s.addBtn} onClick={() => setShowForm(true)}>+ Neuer Eintrag</button>
      </div>

      <div style={s.chips}>
        {[{ id: 'alle', label: 'Alle' }, ...CATEGORIES].map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            style={{ ...s.chip, background: filter === c.id ? '#fff' : 'var(--bg-card)', color: filter === c.id ? '#080808' : 'var(--text-muted)', border: `1px solid ${filter === c.id ? '#fff' : 'var(--border-light)'}` }}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="pulse" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(entry => {
            const cat = CATEGORIES.find(c => c.id === entry.category) || CATEGORIES[4]
            const pri = PRIORITIES.find(p => p.id === entry.priority) || PRIORITIES[0]
            return (
              <div key={entry.id} style={{ ...s.entryCard, borderLeft: `3px solid ${pri.color}` }}>
                <div style={s.entryTop}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ ...s.badge, background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
                    {pri.id !== 'normal' && <span style={{ ...s.badge, background: `${pri.color}15`, color: pri.color }}>{pri.label}</span>}
                    {entry.room && <span style={{ ...s.badge, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>Zi. {entry.room}</span>}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {new Date(entry.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} · {new Date(entry.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={s.entryMsg}>{entry.message}</p>
                <div style={s.entryBottom}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {entry.employee_name} · {entry.shift === 'früh' ? 'Frühschicht' : entry.shift === 'spät' ? 'Spätschicht' : 'Nachtschicht'}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {!entry.acknowledged ? (
                      <button onClick={() => acknowledge(entry.id)} style={s.ackBtn}>✓ Gelesen</button>
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--accent-green)' }}>✓ {entry.acknowledged_by}</span>
                    )}
                    {entry.status !== 'done' ? (
                      <button onClick={() => markDone(entry.id)} style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Erledigt</button>
                    ) : (
                      <span style={{ fontSize: 10, color: '#3b82f6' }}>✓ Erledigt</span>
                    )}
                    <button onClick={() => deleteEntry(entry.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>×</button>
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Keine Einträge</div>
          )}
        </div>
      )}

      {showForm && <EntryForm onSave={addEntry} onCancel={() => setShowForm(false)} />}
    </div>
  )
}

function EntryForm({ onSave, onCancel }) {
  const [category, setCategory] = useState('übergabe')
  const [priority, setPriority] = useState('normal')
  const [message, setMessage] = useState('')
  const [room, setRoom] = useState('')

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.formPanel} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, color: '#fff', margin: 0, fontWeight: 500 }}>Neuer Eintrag</h2>
          <button onClick={onCancel} style={s.closeBtn}>✕</button>
        </div>

        <label style={s.label}>Kategorie</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', background: category === c.id ? c.color : 'var(--bg-card)', color: category === c.id ? '#fff' : 'var(--text-muted)' }}>
              {c.label}
            </button>
          ))}
        </div>

        <label style={s.label}>Priorität</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {PRIORITIES.map(p => (
            <button key={p.id} onClick={() => setPriority(p.id)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', textAlign: 'center', background: priority === p.id ? p.color : 'var(--bg-card)', color: priority === p.id ? '#fff' : 'var(--text-muted)' }}>
              {p.label}
            </button>
          ))}
        </div>

        <label style={s.label}>Zimmer (optional)</label>
        <input style={s.input} placeholder="z.B. 312" value={room} onChange={e => setRoom(e.target.value)} />

        <label style={s.label}>Nachricht</label>
        <textarea style={{ ...s.input, minHeight: 100, resize: 'vertical' }} placeholder="Was soll die nächste Schicht wissen?"
          value={message} onChange={e => setMessage(e.target.value)} />

        <button style={{ ...s.saveBtn, opacity: !message.trim() ? 0.4 : 1 }}
          disabled={!message.trim()} onClick={() => onSave({ category, priority, message, room })}>
          Eintrag speichern
        </button>
      </div>
    </div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 900 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  h1: { fontSize: 22, fontWeight: 500, color: '#fff', margin: 0 },
  addBtn: { padding: '9px 16px', background: '#fff', color: '#080808', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  chips: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  chip: { padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  entryCard: { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '14px 16px' },
  entryTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  badge: { padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500 },
  entryMsg: { fontSize: 13, color: '#bbb', lineHeight: 1.5, margin: '0 0 10px' },
  entryBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  ackBtn: { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  formPanel: { width: '100%', maxWidth: 480, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', maxHeight: '90vh', overflow: 'auto' },
  closeBtn: { background: 'var(--bg-card)', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 14, cursor: 'pointer', color: 'var(--text-muted)' },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 16, fontFamily: 'inherit' },
  saveBtn: { width: '100%', padding: 12, background: '#fff', color: '#080808', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
}
