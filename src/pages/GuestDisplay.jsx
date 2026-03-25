import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ============================================================
// SIGNATURE CANVAS
// ============================================================
function SignatureCanvas({ onSign, label = 'Unterschrift' }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.parentElement.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = 160
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#bbb'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(40, canvas.height - 40)
    ctx.lineTo(canvas.width - 40, canvas.height - 40)
    ctx.stroke()
    ctx.fillStyle = '#ccc'
    ctx.font = '11px system-ui'
    ctx.fillText(label, 40, canvas.height - 24)
  }, [label])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return { x: t.clientX - rect.left, y: t.clientY - rect.top }
  }

  const start = (e) => {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasDrawn(true)
  }

  const end = () => {
    drawing.current = false
    if (hasDrawn && onSign) onSign(canvasRef.current.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#bbb'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(40, canvas.height - 40)
    ctx.lineTo(canvas.width - 40, canvas.height - 40)
    ctx.stroke()
    ctx.fillStyle = '#ccc'
    ctx.font = '11px system-ui'
    ctx.fillText(label, 40, canvas.height - 24)
    setHasDrawn(false)
    if (onSign) onSign(null)
  }

  return (
    <div>
      <div style={{ border: '1px solid #d1d5db', borderRadius: 12, overflow: 'hidden', background: '#fff', touchAction: 'none' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 160, cursor: 'crosshair' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      </div>
      {hasDrawn && (
        <button onClick={clear} style={{ marginTop: 8, padding: '6px 16px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>
          Unterschrift löschen
        </button>
      )}
    </div>
  )
}

// ============================================================
// WELCOME SCREEN
// ============================================================
function WelcomeScreen() {
  const [clock, setClock] = useState(new Date())
  useEffect(() => { const iv = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(iv) }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)', padding: 40 }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width={44} height={44} viewBox="0 0 44 44">
          <rect x="2" y="2" width="40" height="40" rx="10" fill="none" stroke="#1a1a1a" strokeWidth="1.5"/>
          <path d="M12 32L22 12L32 32" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="16" y1="24" x2="28" y2="24" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 24, fontWeight: 300, color: '#1a1a1a', letterSpacing: 1 }}>Isellence</span>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 300, color: '#1a1a1a', margin: '0 0 8px', textAlign: 'center', letterSpacing: -0.5 }}>
        Willkommen im Maritim Hotel Ingolstadt
      </h1>
      <p style={{ fontSize: 16, color: '#6b7280', margin: 0, textAlign: 'center' }}>
        Am Congress Centrum 1 · 85049 Ingolstadt
      </p>

      <div style={{ marginTop: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 200, color: '#1a1a1a', letterSpacing: 2 }}>
          {clock.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>
          {clock.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s ease-in-out infinite' }} />
        <span style={{ fontSize: 12, color: '#9ca3af' }}>Bereit für den nächsten Gast</span>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}

// ============================================================
// CHECK-IN FORM (Meldeschein §30 BMG)
// ============================================================
function CheckinForm({ session, onComplete }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', birth_date: '', street: '', zip: '', city: '', country: 'Deutschland',
    nationality: 'deutsch', id_number: '',
  })
  const [companions, setCompanions] = useState([])
  const [signature, setSignature] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const addCompanion = () => setCompanions(prev => [...prev, { first_name: '', last_name: '', birth_date: '', nationality: 'deutsch' }])
  const updateCompanion = (i, field, value) => setCompanions(prev => prev.map((c, j) => j === i ? { ...c, [field]: value } : c))
  const removeCompanion = (i) => setCompanions(prev => prev.filter((_, j) => j !== i))

  const canSubmit = form.first_name && form.last_name && form.birth_date && form.street && form.zip && form.city && signature

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)

    // Save to registration_forms
    await supabase.from('registration_forms').insert({
      booking_id: session.booking_id || null,
      room: session.room,
      guest_name: `${form.first_name} ${form.last_name}`,
      data: { main_guest: form, companions },
      signature,
      status: 'completed',
      created_at: new Date().toISOString(),
    })

    // Create/update guest record
    const { data: existing } = await supabase.from('guests').select('id').eq('first_name', form.first_name).eq('last_name', form.last_name).maybeSingle()
    if (existing) {
      await supabase.from('guests').update({
        birth_date: form.birth_date, address: `${form.street}, ${form.zip} ${form.city}`,
        nationality: form.nationality, id_number: form.id_number,
      }).eq('id', existing.id)
    } else {
      await supabase.from('guests').insert({
        first_name: form.first_name, last_name: form.last_name, birth_date: form.birth_date,
        address: `${form.street}, ${form.zip} ${form.city}`, nationality: form.nationality,
        id_number: form.id_number, language: 'german', total_stays: 1,
      })
    }

    // Mark booking meldeschein as completed
    if (session.booking_id) {
      await supabase.from('bookings').update({ meldeschein_completed: true }).eq('booking_id', session.booking_id)
    }

    // Update session
    await supabase.from('guest_display_sessions').update({ status: 'completed', signature }).eq('id', session.id)
    setSubmitting(false)
    onComplete()
  }

  const u = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }))

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '32px 24px', overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <svg width={28} height={28} viewBox="0 0 44 44"><rect x="2" y="2" width="40" height="40" rx="10" fill="none" stroke="#1a1a1a" strokeWidth="1.5"/><path d="M12 32L22 12L32 32" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="16" y1="24" x2="28" y2="24" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 16, fontWeight: 300, color: '#1a1a1a', letterSpacing: 1 }}>Isellence</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 400, color: '#1a1a1a', margin: '0 0 4px' }}>Meldeschein</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Zimmer {session.room} · {session.guest_name}</p>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Pflichtangaben gemäß §30 BMG</p>
        </div>

        {/* Main Guest */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', margin: '0 0 16px' }}>Hauptgast</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={ls.label}>Vorname *</label>
              <input style={ls.input} value={form.first_name} onChange={u('first_name')} placeholder="Vorname" />
            </div>
            <div>
              <label style={ls.label}>Nachname *</label>
              <input style={ls.input} value={form.last_name} onChange={u('last_name')} placeholder="Nachname" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <label style={ls.label}>Geburtsdatum *</label>
              <input style={ls.input} type="date" value={form.birth_date} onChange={u('birth_date')} />
            </div>
            <div>
              <label style={ls.label}>Staatsangehörigkeit *</label>
              <input style={ls.input} value={form.nationality} onChange={u('nationality')} placeholder="z.B. deutsch" />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={ls.label}>Straße und Hausnummer *</label>
            <input style={ls.input} value={form.street} onChange={u('street')} placeholder="Musterstraße 1" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <label style={ls.label}>PLZ *</label>
              <input style={ls.input} value={form.zip} onChange={u('zip')} placeholder="85049" />
            </div>
            <div>
              <label style={ls.label}>Ort *</label>
              <input style={ls.input} value={form.city} onChange={u('city')} placeholder="Ingolstadt" />
            </div>
            <div>
              <label style={ls.label}>Land</label>
              <input style={ls.input} value={form.country} onChange={u('country')} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={ls.label}>Ausweisnummer</label>
            <input style={ls.input} value={form.id_number} onChange={u('id_number')} placeholder="Personalausweis- oder Reisepassnummer" />
          </div>
        </div>

        {/* Companions */}
        {companions.map((c, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>Begleitperson {i + 1}</h2>
              <button onClick={() => removeCompanion(i)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '4px 12px', fontSize: 12, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }}>Entfernen</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={ls.label}>Vorname</label>
                <input style={ls.input} value={c.first_name} onChange={e => updateCompanion(i, 'first_name', e.target.value)} placeholder="Vorname" />
              </div>
              <div>
                <label style={ls.label}>Nachname</label>
                <input style={ls.input} value={c.last_name} onChange={e => updateCompanion(i, 'last_name', e.target.value)} placeholder="Nachname" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label style={ls.label}>Geburtsdatum</label>
                <input style={ls.input} type="date" value={c.birth_date} onChange={e => updateCompanion(i, 'birth_date', e.target.value)} />
              </div>
              <div>
                <label style={ls.label}>Staatsangehörigkeit</label>
                <input style={ls.input} value={c.nationality} onChange={e => updateCompanion(i, 'nationality', e.target.value)} />
              </div>
            </div>
          </div>
        ))}

        <button onClick={addCompanion} style={{ width: '100%', padding: 14, background: '#fff', border: '1px dashed #d1d5db', borderRadius: 12, fontSize: 14, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 24 }}>
          + Begleitperson hinzufügen
        </button>

        {/* Signature */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', margin: '0 0 4px' }}>Unterschrift</h2>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>Ich bestätige die Richtigkeit der Angaben.</p>
          <SignatureCanvas onSign={setSignature} label="Hier unterschreiben" />
        </div>

        {/* Submit */}
        <button disabled={!canSubmit || submitting} onClick={handleSubmit} style={{
          width: '100%', padding: 18, border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 600,
          cursor: canSubmit && !submitting ? 'pointer' : 'default', fontFamily: 'inherit',
          background: canSubmit ? '#1a1a1a' : '#d1d5db', color: canSubmit ? '#fff' : '#9ca3af',
          marginBottom: 32,
        }}>
          {submitting ? 'Wird gespeichert...' : 'Meldeschein absenden'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// INVOICE VIEW
// ============================================================
function InvoiceView({ session, onComplete }) {
  const data = session.data || {}
  const items = data.items || []
  const roomTotal = parseFloat(data.room_total) || 0
  const chargesTotal = items.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
  const grandTotal = roomTotal + chargesTotal
  const netto7 = roomTotal / 1.07
  const mwst7 = roomTotal - netto7
  const netto19 = chargesTotal / 1.19
  const mwst19 = chargesTotal - netto19
  const [signature, setSignature] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSign = async () => {
    if (!signature || submitting) return
    setSubmitting(true)
    await supabase.from('guest_display_sessions').update({ status: 'signed', signature }).eq('id', session.id)
    setSubmitting(false)
    onComplete()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '32px 24px', overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>Maritim Hotel Ingolstadt</div>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6, marginTop: 4 }}>Am Congress Centrum 1 · 85049 Ingolstadt<br/>Tel: +49 841 49050</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 300, color: '#1a1a1a' }}>Rechnung</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{new Date().toLocaleDateString('de-DE')}</div>
          </div>
        </div>

        {/* Guest info */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['Gast', session.guest_name], ['Zimmer', session.room], ['Check-in', data.check_in || '—'], ['Check-out', data.check_out || '—']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>{l}</span>
                <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line items */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '12px 20px', borderBottom: '2px solid #1a1a1a' }}>
            <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Position</span>
            <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Betrag</span>
          </div>

          {/* Room charge */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '12px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <div style={{ fontSize: 14, color: '#1a1a1a' }}>Übernachtung ({data.nights || 1} Nächte)</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Zimmer {session.room} · 7% MwSt</div>
            </div>
            <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500 }}>{roomTotal.toFixed(2)} €</div>
          </div>

          {/* Extra charges */}
          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '12px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <div>
                <div style={{ fontSize: 14, color: '#1a1a1a' }}>{item.type}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{item.details || ''} · 19% MwSt</div>
              </div>
              <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500 }}>{parseFloat(item.amount).toFixed(2)} €</div>
            </div>
          ))}

          {/* Totals */}
          <div style={{ padding: '16px 20px', borderTop: '2px solid #1a1a1a', background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Gesamtbetrag</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{grandTotal.toFixed(2)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
              <span>Netto (7% MwSt: {mwst7.toFixed(2)} €)</span>
              <span>{netto7.toFixed(2)} €</span>
            </div>
            {chargesTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
                <span>Netto (19% MwSt: {mwst19.toFixed(2)} €)</span>
                <span>{netto19.toFixed(2)} €</span>
              </div>
            )}
          </div>
        </div>

        {/* Signature */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', margin: '0 0 4px' }}>Unterschrift</h2>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>Hiermit bestätige ich den Erhalt und die Richtigkeit der Rechnung.</p>
          <SignatureCanvas onSign={setSignature} label="Hier unterschreiben" />
        </div>

        <button disabled={!signature || submitting} onClick={handleSign} style={{
          width: '100%', padding: 18, border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 600,
          cursor: signature && !submitting ? 'pointer' : 'default', fontFamily: 'inherit',
          background: signature ? '#1a1a1a' : '#d1d5db', color: signature ? '#fff' : '#9ca3af',
          marginBottom: 32,
        }}>
          {submitting ? 'Wird gespeichert...' : 'Unterschreiben & Bestätigen'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// MAIN GUEST DISPLAY
// ============================================================
export default function GuestDisplay() {
  const [session, setSession] = useState(null)
  const [showComplete, setShowComplete] = useState(false)

  useEffect(() => {
    // Check for active session on mount
    const checkActive = async () => {
      const { data } = await supabase.from('guest_display_sessions').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1)
      if (data && data.length > 0) setSession(data[0])
    }
    checkActive()

    // Listen for realtime changes
    const channel = supabase
      .channel('guest-display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_display_sessions' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.status === 'active') {
          setSession(payload.new)
          setShowComplete(false)
        }
        if (payload.eventType === 'UPDATE') {
          if (payload.new.status === 'active') {
            setSession(payload.new)
            setShowComplete(false)
          }
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const handleComplete = () => {
    setShowComplete(true)
    setTimeout(() => {
      setSession(null)
      setShowComplete(false)
    }, 3000)
  }

  // Success screen
  if (showComplete) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 400, color: '#1a1a1a', margin: '0 0 8px' }}>Vielen Dank!</h1>
        <p style={{ fontSize: 15, color: '#6b7280' }}>
          {session?.type === 'invoice' ? 'Die Rechnung wurde bestätigt.' : 'Der Meldeschein wurde erfolgreich übermittelt.'}
        </p>
      </div>
    )
  }

  // Active session
  if (session) {
    if (session.type === 'checkin') return <CheckinForm session={session} onComplete={handleComplete} />
    if (session.type === 'invoice') return <InvoiceView session={session} onComplete={handleComplete} />
  }

  // Default: Welcome screen
  return <WelcomeScreen />
}

// ============================================================
// LIGHT THEME STYLES
// ============================================================
const ls = {
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 },
  input: { width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 15, color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
}
