import { supabase } from './supabase'

export async function loadInvoiceData(booking) {
  const [sr, mb] = await Promise.all([
    supabase.from('service_requests').select('*').eq('room', String(booking.room)).eq('status', 'delivered'),
    supabase.from('minibar_consumption').select('*').eq('room', String(booking.room)),
  ])

  const charges = [
    ...(sr.data || []).map(r => ({
      type: r.category === 'room_service' ? 'Room Service' : 'Service',
      details: r.request_details,
      amount: parseFloat(r.order_total) || 0,
      date: r.timestamp,
    })),
    ...(mb.data || []).map(r => ({
      type: 'Minibar',
      details: `${r.quantity}x ${r.product_name}`,
      amount: parseFloat(r.total) || 0,
      date: r.created_at,
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date))

  return charges
}

export function generateInvoiceHTML(booking, charges, invoiceNumber) {
  const nights = Math.max(1, Math.round((new Date(booking.check_out) - new Date(booking.check_in)) / 86400000))
  const roomTotal = parseFloat(booking.amount_due) || 0
  const chargesTotal = charges.reduce((s, c) => s + c.amount, 0)
  const grandTotal = roomTotal + chargesTotal
  const netto = (grandTotal / 1.07).toFixed(2)
  const mwst = (grandTotal - grandTotal / 1.07).toFixed(2)

  const chargeRows = charges.map(c => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee;font-size:12px">${c.type}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;font-size:12px">${c.details || ''}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;font-size:12px;text-align:right">${c.amount.toFixed(2)} €</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html><head><title>Rechnung ${invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #222; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .hotel { font-size: 20px; font-weight: 600; }
  .hotel-sub { font-size: 11px; color: #666; margin-top: 4px; line-height: 1.6; }
  .invoice-title { font-size: 24px; font-weight: 300; text-align: right; }
  .invoice-nr { font-size: 12px; color: #666; text-align: right; margin-top: 4px; }
  .guest-box { background: #f8f8f8; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
  .guest-box h3 { font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #444; }
  .guest-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
  .guest-row span:first-child { color: #888; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; padding: 8px 0; border-bottom: 2px solid #222; }
  th:last-child { text-align: right; }
  .total-row td { padding: 10px 0; font-weight: 600; font-size: 14px; border-top: 2px solid #222; }
  .total-row td:last-child { text-align: right; }
  .tax-row td { padding: 4px 0; font-size: 11px; color: #888; }
  .tax-row td:last-child { text-align: right; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #999; line-height: 1.8; text-align: center; }
  @media print { body { padding: 20px; } }
</style></head><body>

<div class="header">
  <div>
    <div class="hotel">Maritim Hotel Ingolstadt</div>
    <div class="hotel-sub">
      Am Congress Centrum 1 · 85049 Ingolstadt<br>
      Tel: +49 841 49050 · info@maritim-ingolstadt.de<br>
      USt-IdNr: DE 123 456 789
    </div>
  </div>
  <div>
    <div class="invoice-title">Rechnung</div>
    <div class="invoice-nr">${invoiceNumber}<br>${new Date().toLocaleDateString('de-DE')}</div>
  </div>
</div>

<div class="guest-box">
  <h3>Gastdaten</h3>
  <div class="guest-row"><span>Name</span><span>${booking.guest_name}</span></div>
  <div class="guest-row"><span>Zimmer</span><span>${booking.room}</span></div>
  <div class="guest-row"><span>Check-in</span><span>${booking.check_in}</span></div>
  <div class="guest-row"><span>Check-out</span><span>${booking.check_out}</span></div>
  <div class="guest-row"><span>Nächte</span><span>${nights}</span></div>
  <div class="guest-row"><span>Buchungs-ID</span><span>${booking.booking_id || '—'}</span></div>
</div>

<table>
  <thead><tr><th>Position</th><th>Details</th><th style="text-align:right">Betrag</th></tr></thead>
  <tbody>
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee;font-size:12px">Übernachtung (${nights} Nächte)</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;font-size:12px">Zimmer ${booking.room}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;font-size:12px;text-align:right">${roomTotal.toFixed(2)} €</td>
    </tr>
    ${chargeRows}
    <tr class="total-row">
      <td colspan="2">Gesamtbetrag</td>
      <td>${grandTotal.toFixed(2)} €</td>
    </tr>
    <tr class="tax-row">
      <td colspan="2">Nettobetrag (7% MwSt)</td>
      <td>${netto} €</td>
    </tr>
    <tr class="tax-row">
      <td colspan="2">MwSt 7%</td>
      <td>${mwst} €</td>
    </tr>
  </tbody>
</table>

<p style="font-size:12px;color:#666;margin-bottom:8px">Zahlungsart: ${booking.source === 'Booking.com' || booking.source === 'Expedia' ? 'Vorauszahlung über ' + booking.source : 'Rechnung'}</p>

<div class="footer">
  Maritim Hotel Ingolstadt · Am Congress Centrum 1 · 85049 Ingolstadt<br>
  Geschäftsführer: [Name] · HRB [Nr.] · Amtsgericht Ingolstadt<br>
  IBAN: DE89 3704 0044 0532 0130 00 · BIC: COBADEFFXXX
</div>

<script>setTimeout(() => window.print(), 500)</script>
</body></html>`
}

export function openInvoicePDF(booking, charges) {
  const invoiceNr = `RE-${new Date().getFullYear()}-${String(booking.booking_id || booking.id).slice(-4).toUpperCase()}`
  const html = generateInvoiceHTML(booking, charges, invoiceNr)
  const w = window.open('', '_blank', 'width=800,height=1000')
  w.document.write(html)
  return invoiceNr
}
