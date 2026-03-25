import { supabase } from './supabase'
import { loadInvoiceData, openInvoicePDF } from './invoice'
import { logAction } from './audit'

/**
 * Prepare checkout items from a booking.
 * Returns array of { id, type, details, amount } items.
 */
export async function prepareCheckoutItems(booking) {
  const charges = await loadInvoiceData(booking)
  const roomTotal = parseFloat(booking.amount_due) || 0
  const nights = Math.max(1, Math.round((new Date(booking.check_out) - new Date(booking.check_in)) / 86400000))
  return [
    { id: 'room', type: 'Übernachtung', details: `${nights} Nächte · Zimmer ${booking.room}`, amount: roomTotal },
    ...charges.map((c, i) => ({ id: `ch-${i}`, type: c.type, details: c.details, amount: c.amount })),
  ]
}

/**
 * Finalize checkout: update booking status, open PDF.
 * @param {object} booking - The booking object
 * @param {array} items - Checkout items (with potentially edited amounts)
 * @param {string} paymentMethod - 'card'|'cash'|'invoice' or label string
 */
export async function finalizeCheckout(booking, items, paymentMethod) {
  const pmLabel = paymentMethod === 'card' ? 'Kartenzahlung' : paymentMethod === 'cash' ? 'Barzahlung' : paymentMethod === 'invoice' ? 'Rechnung' : paymentMethod
  const { error } = await supabase.from('bookings').update({
    status: 'checked_out',
    payment_method: pmLabel,
    checked_out_at: new Date().toISOString(),
  }).eq('id', booking.id)
  if (error) throw new Error(`Checkout fehlgeschlagen: ${error.message}`)
  logAction('checkout', 'booking', booking.booking_id, { guest: booking.guest_name, room: booking.room, payment: pmLabel, total: items.reduce((s, i) => s + i.amount, 0) })
  const invoiceCharges = items.filter(i => i.id !== 'room').map(i => ({ type: i.type, details: i.details, amount: i.amount, date: new Date().toISOString() }))
  openInvoicePDF({ ...booking, amount_due: items.find(i => i.id === 'room')?.amount || 0 }, invoiceCharges)
}

/**
 * Safe multi-table operation: try all updates, report first failure.
 */
export async function safeMultiUpdate(operations) {
  const results = []
  for (const op of operations) {
    const { error } = await op()
    if (error) {
      console.error('Multi-table update failed:', error)
      return { success: false, error: error.message, completed: results.length }
    }
    results.push(true)
  }
  return { success: true, completed: results.length }
}
