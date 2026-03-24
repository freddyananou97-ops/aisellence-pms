import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'

const LANG_FLAGS = { german: '🇩🇪', english: '🇬🇧', french: '🇫🇷', italian: '🇮🇹', spanish: '🇪🇸', turkish: '🇹🇷', arabic: '🇸🇦', russian: '🇷🇺', chinese: '🇨🇳', japanese: '🇯🇵' }

export default function Gaeste() {
  const [guests, setGuests] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('alle')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [guestBookings, setGuestBookings] = useState([])

  const load = useCallback(async () => {
    const [g, b] = await Promise.all([
      supabase.from('guests').select('*').order('last_name', { ascending: true }),
      supabase.from('bookings').select('*').order('check_in', { ascending: false }),
    ])
    setGuests(g.data || [])
    setBookings(b.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load(); const u = subscribeToTable('guests', () => load()); return u }, [load])

  const openGuest = (guest) => {
    setSelected(guest)
    setEditing(false)
    // Find bookings for this guest
    const name = `${guest.first_name} ${guest.last_name}`.toLowerCase()
    const gb = bookings.filter(b => b.guest_name?.toLowerCase() === name || b.guest_name?.toLowerCase().includes(guest.last_name.toLowerCase()))
    setGuestBookings(gb)
  }

  const startEdit = () => {
    setEditing(true)
    setEditData({
      first_name: selected.first_name, last_name: selected.last_name, email: selected.email, phone: selected.phone,
      language: selected.language, nationality: selected.nationality, birth_date: selected.birth_date,
      address: selected.address, id_type: selected.id_type, id_number: selected.id_number,
      vip: selected.vip, vip_notes: selected.vip_notes, preferences: selected.preferences,
      blacklisted: selected.blacklisted,
    })
  }

  const saveEdit = async () => {
    await supabase.from('guests').update(editData).eq('id', selected.id)
    setEditing(false); setSelected(null); load()
  }

  const toggleVIP = async (guest) => {
    await supabase.from('guests').update({ vip: !guest.vip }).eq('id', guest.id)
    load()
  }

  const toggleBlacklist = async (guest) => {
    await supabase.from('guests').update({ blacklisted: !guest.blacklisted }).eq('id', guest.id)
    load()
  }

  // Filtering
  const filtered = guests.filter(g => {
    const q = search.toLowerCase()
    const matchesSearch = !q || `${g.first_name} ${g.last_name}`.toLowerCase().includes(q) || g.email?.toLowerCase().includes(q) || g.phone?.includes(q)
    const matchesFilter = filter === 'alle' || (filter === 'vip' && g.vip) || (filter === 'blacklisted' && g.blacklisted)
    return matchesSearch && matchesFilter
  })

  const vipCount = guests.filter(g => g.vip).length
  const blacklistCount = guests.filter(g => g.blacklisted).length

  if (loading) return <div style={s.content}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--textMuted)' }}>Laden...</div></div>

  return (
    <div style={s.content}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={s.h1}>Gästedatenbank</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted)', marginTop: -12 }}>{guests.length} Gäste · {vipCount} VIP</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, E-Mail oder Telefon..."
          style={{ flex: 1, minWidth: 200, padding: '10px 14px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
        {[['alle', `Alle ${guests.length}`], ['vip', `VIP ${vipCount}`], ['blacklisted', `Gesperrt ${blacklistCount}`]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
            background: filter === k ? (k === 'vip' ? 'rgba(245,158,11,0.1)' : k === 'blacklisted' ? 'rgba(239,68,68,0.1)' : 'var(--text)') : 'var(--bgCard)',
            color: filter === k ? (k === 'vip' ? '#f59e0b' : k === 'blacklisted' ? '#ef4444' : 'var(--bg)') : 'var(--textMuted)',
            border: `1px solid ${filter === k ? (k === 'vip' ? '#f59e0b' : k === 'blacklisted' ? '#ef4444' : 'var(--text)') : 'var(--borderLight)'}`,
          }}>{l}</button>
        ))}
      </div>

      {/* Guest Table */}
      <div style={s.card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 80px 80px 60px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
          {['Name', 'E-Mail', 'Telefon', 'Sprache', 'Aufenthalte', 'Status'].map(h => (
            <span key={h} style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>{h}</span>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>{search ? 'Kein Gast gefunden' : 'Keine Gäste'}</div>
        ) : filtered.map(g => (
          <div key={g.id} onClick={() => openGuest(g)} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 140px 80px 80px 60px', padding: '12px 16px',
            borderBottom: '1px solid var(--border)', gap: 8, cursor: 'pointer',
            background: g.blacklisted ? 'rgba(239,68,68,0.02)' : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{g.first_name} {g.last_name}</span>
              {g.vip && <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600 }}>VIP</span>}
              {g.blacklisted && <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600 }}>GESPERRT</span>}
            </div>
            <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{g.email || '—'}</span>
            <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{g.phone || '—'}</span>
            <span style={{ fontSize: 12, color: 'var(--textSec)' }}>{LANG_FLAGS[g.language] || ''} {g.language || '—'}</span>
            <span style={{ fontSize: 12, color: 'var(--textSec)' }}>{g.total_stays || 0}x</span>
            <span style={{ fontSize: 12, color: g.total_spent > 0 ? '#10b981' : 'var(--textDim)' }}>{g.total_spent ? `${parseFloat(g.total_spent).toFixed(0)}€` : '—'}</span>
          </div>
        ))}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={s.overlay} onClick={() => { setSelected(null); setEditing(false) }}>
          <div style={{ ...s.modal, maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
                  {selected.first_name} {selected.last_name}
                  {selected.vip && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600, marginLeft: 8 }}>VIP</span>}
                </h3>
                <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>Gast seit {selected.created_at ? new Date(selected.created_at).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : '—'}</span>
              </div>
              <button onClick={() => { setSelected(null); setEditing(false) }} style={s.closeBtn}>✕</button>
            </div>

            {!editing ? <>
              {/* Info */}
              {[
                ['E-Mail', selected.email || '—'],
                ['Telefon', selected.phone || '—'],
                ['Sprache', `${LANG_FLAGS[selected.language] || ''} ${selected.language || '—'}`],
                ['Nationalität', selected.nationality || '—'],
                ['Geburtsdatum', selected.birth_date || '—'],
                ['Adresse', selected.address || '—'],
                ['Ausweis', selected.id_type ? `${selected.id_type}: ${selected.id_number || '—'}` : '—'],
                ['Aufenthalte', `${selected.total_stays || 0}x`],
                ['Gesamtumsatz', selected.total_spent ? `${parseFloat(selected.total_spent).toFixed(2)}€` : '—'],
                ['Loyalty-Punkte', selected.loyalty_points || '0'],
                ['DSGVO-Einwilligung', selected.gdpr_consent ? `✓ ${selected.gdpr_consent_date || ''}` : '— Nicht erteilt'],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{l}</span>
                  <span style={{ fontSize: 11, color: l === 'DSGVO-Einwilligung' ? (selected.gdpr_consent ? '#10b981' : '#f59e0b') : 'var(--textSec)' }}>{v}</span>
                </div>
              ))}

              {/* Preferences */}
              {selected.preferences && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bgCard)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Präferenzen</div>
                  <div style={{ fontSize: 12, color: 'var(--textSec)' }}>{typeof selected.preferences === 'object' ? (selected.preferences.notes || JSON.stringify(selected.preferences)) : selected.preferences}</div>
                </div>
              )}

              {selected.vip_notes && (
                <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>VIP-Notiz</div>
                  <div style={{ fontSize: 12, color: '#f59e0b' }}>{selected.vip_notes}</div>
                </div>
              )}

              {/* Booking History */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Buchungshistorie</div>
                {guestBookings.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--textDim)', textAlign: 'center', padding: '8px 0' }}>Keine Buchungen gefunden</div>
                ) : guestBookings.slice(0, 10).map((b, i) => {
                  const sc = { reserved: '#3b82f6', confirmed: '#8b5cf6', checked_in: '#10b981', checked_out: '#6b7280', cancelled: '#ef4444' }
                  const sl = { reserved: 'Reserviert', confirmed: 'Bestätigt', checked_in: 'Eingecheckt', checked_out: 'Ausgecheckt', cancelled: 'Storniert' }
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--textSec)' }}>Zi. {b.room}</span>
                        <span style={{ fontSize: 10, color: 'var(--textDim)', marginLeft: 8 }}>{b.check_in} → {b.check_out}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {b.amount_due && <span style={{ fontSize: 10, color: 'var(--textMuted)' }}>{parseFloat(b.amount_due).toFixed(0)}€</span>}
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${sc[b.status] || '#333'}10`, color: sc[b.status] || '#666' }}>{sl[b.status] || b.status}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                <button onClick={startEdit} style={s.actionBtn}>Gast bearbeiten</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => toggleVIP(selected)} style={{ ...s.actionBtn, flex: 1, color: selected.vip ? '#f59e0b' : 'var(--textMuted)', border: `1px solid ${selected.vip ? 'rgba(245,158,11,0.3)' : 'var(--borderLight)'}` }}>
                    {selected.vip ? '★ VIP entfernen' : '☆ Als VIP markieren'}
                  </button>
                  <button onClick={() => toggleBlacklist(selected)} style={{ ...s.actionBtn, flex: 1, color: selected.blacklisted ? '#ef4444' : 'var(--textMuted)', border: `1px solid ${selected.blacklisted ? 'rgba(239,68,68,0.3)' : 'var(--borderLight)'}` }}>
                    {selected.blacklisted ? 'Entsperren' : 'Sperren'}
                  </button>
                </div>
              </div>
            </> : <>
              {/* Edit Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={s.label}>Vorname</label><input style={s.input} value={editData.first_name || ''} onChange={e => setEditData(p => ({ ...p, first_name: e.target.value }))} /></div>
                <div><label style={s.label}>Nachname</label><input style={s.input} value={editData.last_name || ''} onChange={e => setEditData(p => ({ ...p, last_name: e.target.value }))} /></div>
              </div>
              <label style={s.label}>E-Mail</label><input style={s.input} value={editData.email || ''} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} />
              <label style={s.label}>Telefon</label><input style={s.input} value={editData.phone || ''} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={s.label}>Sprache</label><select style={s.input} value={editData.language || ''} onChange={e => setEditData(p => ({ ...p, language: e.target.value }))}>
                  <option value="">—</option>{Object.keys(LANG_FLAGS).map(l => <option key={l} value={l}>{l}</option>)}
                </select></div>
                <div><label style={s.label}>Nationalität</label><input style={s.input} value={editData.nationality || ''} onChange={e => setEditData(p => ({ ...p, nationality: e.target.value }))} /></div>
              </div>
              <label style={s.label}>Geburtsdatum</label><input style={s.input} type="date" value={editData.birth_date || ''} onChange={e => setEditData(p => ({ ...p, birth_date: e.target.value }))} />
              <label style={s.label}>Adresse</label><input style={s.input} value={editData.address || ''} onChange={e => setEditData(p => ({ ...p, address: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={s.label}>Ausweis-Typ</label><select style={s.input} value={editData.id_type || ''} onChange={e => setEditData(p => ({ ...p, id_type: e.target.value }))}>
                  <option value="">—</option><option value="passport">Reisepass</option><option value="id_card">Personalausweis</option><option value="drivers_license">Führerschein</option>
                </select></div>
                <div><label style={s.label}>Ausweis-Nr.</label><input style={s.input} value={editData.id_number || ''} onChange={e => setEditData(p => ({ ...p, id_number: e.target.value }))} /></div>
              </div>
              <label style={s.label}>Präferenzen</label><textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={typeof editData.preferences === 'object' ? (editData.preferences?.notes || '') : (editData.preferences || '')} onChange={e => setEditData(p => ({ ...p, preferences: { notes: e.target.value } }))} />
              <label style={s.label}>VIP-Notiz</label><input style={s.input} value={editData.vip_notes || ''} onChange={e => setEditData(p => ({ ...p, vip_notes: e.target.value }))} />

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(false)} style={s.cancelBtn}>Abbrechen</button>
                <button onClick={saveEdit} style={{ flex: 1, padding: 12, background: '#10b981', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Speichern</button>
              </div>
            </>}
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
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440 },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionBtn: { width: '100%', padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textSec)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, textAlign: 'center' },
  cancelBtn: { flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '10px 12px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit' },
}
