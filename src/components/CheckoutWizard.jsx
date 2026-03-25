import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { prepareCheckoutItems, finalizeCheckout } from '../lib/checkout'
import { loadInvoiceData, openInvoicePDF } from '../lib/invoice'
import { createCheckoutSession, buildLineItems } from '../lib/stripe'
import { logAction } from '../lib/audit'

/**
 * 5-Step Checkout Wizard — shared between Buchungen and Zimmer.
 * Props: booking (the booking object), onDone (callback when finished), onCancel
 */
export default function CheckoutWizard({ booking, onDone, onCancel }) {
  const [step, setStep] = useState(1)
  const [items, setItems] = useState([])
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [processing, setProcessing] = useState(false)

  const nights = Math.max(1, Math.round((new Date(booking.check_out) - new Date(booking.check_in)) / 86400000))
  const grandTotal = items.reduce((s, i) => s + i.amount, 0)

  // Step 1: Load charges on mount
  useEffect(() => {
    prepareCheckoutItems(booking).then(setItems)
  }, [booking])

  const updateItem = (id, field, value) => setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : i))
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))
  const addItem = () => { if (!newLabel) return; setItems(prev => [...prev, { id: `new-${Date.now()}`, type: 'Sonstige', details: newLabel, amount: parseFloat(newAmount) || 0 }]); setNewLabel(''); setNewAmount('') }

  // Step 2 → 3: Send invoice to guest display
  const sendToDisplay = async () => {
    setProcessing(true)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const charges = items.filter(i => i.id !== 'room').map(i => ({ type: i.type, details: i.details, amount: i.amount }))
    const { data: sess } = await supabase.from('guest_display_sessions').insert({
      type: 'invoice', status: 'active', room: booking.room,
      guest_name: booking.guest_name, booking_id: booking.booking_id || null,
      data: { room_total: items.find(i => i.id === 'room')?.amount || 0, nights, check_in: booking.check_in, check_out: booking.check_out, items: charges },
      created_at: new Date().toISOString(), expires_at: expiresAt,
    }).select().single()
    setSessionId(sess?.id)
    setProcessing(false)
    setStep(3)
  }

  // Step 3: Listen for guest signature
  useEffect(() => {
    if (step !== 3 || !sessionId) return
    const channel = supabase.channel(`checkout-${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guest_display_sessions', filter: `id=eq.${sessionId}` }, (payload) => {
        if (payload.new.status === 'signed') {
          if (grandTotal <= 0) { completeCheckout('Keine Zahlung (0€)'); return }
          setStep(4)
        }
        if (payload.new.status === 'paid') { completeCheckout(paymentMethod || 'Stripe Online') }
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [step, sessionId, grandTotal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Step 4: Payment actions
  const handleCard = async () => {
    setPaymentMethod('Kartenzahlung'); setProcessing(true)
    try {
      const charges = items.filter(i => i.id !== 'room')
      const lineItems = buildLineItems({ roomTotal: items.find(i => i.id === 'room')?.amount || 0, nights, room: booking.room, charges })
      const origin = window.location.origin
      const { url, id } = await createCheckoutSession({
        lineItems, metadata: { booking_id: booking.booking_id || '', guest_name: booking.guest_name, room: booking.room, session_id: sessionId },
        successUrl: `${origin}/guest-display?payment=success&gds=${sessionId}`,
        cancelUrl: `${origin}/guest-display?payment=cancelled`,
      })
      // Send Stripe link to guest display
      const sessData = items.find(i => i.id === 'room') ? { room_total: items.find(i => i.id === 'room').amount, nights, check_in: booking.check_in, check_out: booking.check_out, items: items.filter(i => i.id !== 'room'), stripe_url: url, stripe_session_id: id } : { stripe_url: url, stripe_session_id: id }
      await supabase.from('guest_display_sessions').update({ status: 'payment_pending', data: sessData }).eq('id', sessionId)
    } catch (e) { console.error('Stripe error:', e) }
    setProcessing(false)
  }

  const handleCash = () => {
    setPaymentMethod('Barzahlung')
  }

  const confirmCash = async () => {
    await supabase.from('guest_display_sessions').update({ status: 'paid' }).eq('id', sessionId)
    completeCheckout('Barzahlung')
  }

  const handleInvoice = async () => {
    await supabase.from('guest_display_sessions').update({ status: 'paid' }).eq('id', sessionId)
    completeCheckout('Rechnung')
  }

  const completeCheckout = async (method) => {
    await finalizeCheckout(booking, items, method)
    logAction('checkout', 'booking', booking.booking_id, { guest: booking.guest_name, room: booking.room, payment: method, total: grandTotal })
    setPaymentMethod(method)
    setStep(5)
  }

  // Listen for Stripe payment success (from guest display or polling)
  useEffect(() => {
    if (step !== 4 || paymentMethod !== 'Kartenzahlung' || !sessionId) return
    const channel = supabase.channel(`stripe-${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guest_display_sessions', filter: `id=eq.${sessionId}` }, (payload) => {
        if (payload.new.status === 'paid') completeCheckout('Kartenzahlung')
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [step, paymentMethod, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const netto7 = (items.find(i => i.id === 'room')?.amount || 0) / 1.07
  const mwst7 = (items.find(i => i.id === 'room')?.amount || 0) - netto7
  const chargesTotal = items.filter(i => i.id !== 'room').reduce((s, i) => s + i.amount, 0)

  return (
    <div style={ws.overlay} onClick={step < 5 ? onCancel : undefined}>
      <div style={ws.modal} onClick={e => e.stopPropagation()}>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[1,2,3,4,5].map(s => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? '#10b981' : 'var(--borderLight)', transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* STEP 2: Invoice Preview */}
        {step <= 2 && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Rechnungsvorschau</h3>
              <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{booking.guest_name} · Zimmer {booking.room}</span>
            </div>
            <button onClick={onCancel} style={ws.closeBtn}>✕</button>
          </div>

          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, marginRight: 6, background: item.id === 'room' ? 'rgba(16,185,129,0.08)' : 'rgba(107,114,128,0.08)', color: item.id === 'room' ? '#10b981' : '#6b7280' }}>{item.type}</span>
                <input value={item.details} onChange={e => updateItem(item.id, 'details', e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--textSec)', fontFamily: 'inherit', width: '100%', marginTop: 4, display: 'block' }} />
              </div>
              <input type="number" value={item.amount} onChange={e => updateItem(item.id, 'amount', e.target.value)} style={{ width: 80, padding: '6px 8px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 13, color: 'var(--text)', fontWeight: 500, textAlign: 'right', outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>€</span>
              <button onClick={() => removeItem(item.id)} style={{ width: 24, height: 24, borderRadius: 4, background: 'rgba(239,68,68,0.08)', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 6, padding: '10px 0', alignItems: 'center' }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Neue Position..." style={{ flex: 1, padding: '8px 10px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0" style={{ width: 70, padding: '8px 10px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 6, fontSize: 12, color: 'var(--text)', textAlign: 'right', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={addItem} disabled={!newLabel} style={{ padding: '8px 12px', background: newLabel ? 'rgba(16,185,129,0.1)' : 'transparent', border: `1px solid ${newLabel ? 'rgba(16,185,129,0.2)' : 'var(--borderLight)'}`, borderRadius: 6, fontSize: 11, color: newLabel ? '#10b981' : 'var(--textDim)', cursor: newLabel ? 'pointer' : 'default', fontFamily: 'inherit' }}>+</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid var(--border)', fontWeight: 600 }}>
            <span style={{ fontSize: 14, color: 'var(--text)' }}>Gesamtbetrag</span>
            <span style={{ fontSize: 18, color: '#10b981' }}>{grandTotal.toFixed(2)}€</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--textDim)', marginBottom: 16 }}>
            <span>inkl. 7% MwSt {mwst7.toFixed(2)}€</span>
            {chargesTotal > 0 && <span>inkl. 19% MwSt {(chargesTotal - chargesTotal/1.19).toFixed(2)}€</span>}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={{ flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
            <button onClick={sendToDisplay} disabled={processing} style={{ flex: 2, padding: 12, background: '#8b5cf6', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: processing ? 0.6 : 1 }}>
              {processing ? 'Wird gesendet...' : 'Weiter — Rechnung ans Gast-Display'}
            </button>
          </div>
        </>}

        {/* STEP 3: Waiting for signature */}
        {step === 3 && <>
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 8px' }}>Warte auf Unterschrift des Gastes</h3>
            <p style={{ fontSize: 13, color: 'var(--textMuted)', margin: 0 }}>Rechnung wurde ans Gast-Display gesendet.</p>
            <p style={{ fontSize: 12, color: 'var(--textDim)', marginTop: 4 }}>{booking.guest_name} · Zimmer {booking.room} · {grandTotal.toFixed(2)}€</p>
            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: 12, color: '#3b82f6' }}>Gast füllt Unterschrift aus...</span>
            </div>
          </div>
          <button onClick={onCancel} style={{ width: '100%', padding: 10, background: 'transparent', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 11, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
        </>}

        {/* STEP 4: Choose payment */}
        {step === 4 && <>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Gast hat unterschrieben</h3>
            <p style={{ fontSize: 22, fontWeight: 300, color: 'var(--text)', margin: '8px 0 0' }}>{grandTotal.toFixed(2)}€</p>
          </div>

          {!paymentMethod && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button onClick={handleCard} disabled={processing} style={{ flex: 1, padding: '20px 12px', background: 'var(--bgCard)', border: '2px solid var(--borderLight)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#635bff" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 8px' }}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Karte</div>
              </button>
              <button onClick={handleCash} style={{ flex: 1, padding: '20px 12px', background: 'var(--bgCard)', border: '2px solid var(--borderLight)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 8px' }}><circle cx="12" cy="12" r="9"/><path d="M12 8v8m-3-5a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3 3 3 0 00-3 3"/></svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Bar</div>
              </button>
              <button onClick={handleInvoice} style={{ flex: 1, padding: '20px 12px', background: 'var(--bgCard)', border: '2px solid var(--borderLight)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 8px' }}><path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Rechnung</div>
              </button>
            </div>
          )}

          {paymentMethod === 'Kartenzahlung' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#635bff', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <span style={{ fontSize: 13, color: '#635bff' }}>Gast bezahlt mit Karte...</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--textDim)' }}>QR-Code wird auf dem Gast-Display angezeigt.</p>
            </div>
          )}

          {paymentMethod === 'Barzahlung' && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>Betrag von <strong>{grandTotal.toFixed(2)}€</strong> erhalten?</p>
              <button onClick={confirmCash} style={{ width: '100%', padding: 14, background: '#10b981', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Barzahlung erhalten — Auschecken</button>
            </div>
          )}
        </>}

        {/* STEP 5: Done */}
        {step === 5 && <>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Check-out abgeschlossen</h3>
            <p style={{ fontSize: 12, color: 'var(--textMuted)' }}>{booking.guest_name} · Zimmer {booking.room} · {paymentMethod}</p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => openInvoicePDF(booking, items.filter(i => i.id !== 'room'))} style={{ flex: 1, padding: 12, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, fontSize: 12, color: '#3b82f6', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>PDF drucken</button>
          </div>
          <button onClick={onDone} style={{ width: '100%', padding: 14, background: 'var(--text)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit' }}>Fertig</button>
        </>}

      </div>
    </div>
  )
}

const ws = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto' },
  closeBtn: { background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--textMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
