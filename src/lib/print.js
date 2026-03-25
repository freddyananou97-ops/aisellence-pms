import { HOTEL, HOTEL_ADDRESS } from './hotel'

/**
 * Open a print-ready HTML page in a new tab.
 */
export function openPrintPage(title, bodyHTML) {
  const w = window.open('', '_blank', 'width=800,height=1000')
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #222; padding: 32px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #222; }
  .hotel { font-size: 18px; font-weight: 600; }
  .hotel-sub { font-size: 10px; color: #666; margin-top: 4px; }
  .title { font-size: 20px; font-weight: 300; text-align: right; }
  .date { font-size: 11px; color: #666; text-align: right; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; padding: 6px 8px; border-bottom: 2px solid #222; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  .summary { background: #f8f8f8; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; }
  .summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 9px; color: #999; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="header">
  <div><div class="hotel">${HOTEL.name}</div><div class="hotel-sub">${HOTEL_ADDRESS} · Tel: ${HOTEL.phone}</div></div>
  <div><div class="title">${title}</div><div class="date">${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
</div>
${bodyHTML}
<div class="footer">${HOTEL.name} · ${HOTEL_ADDRESS} · USt-IdNr: ${HOTEL.taxId}</div>
<script>setTimeout(() => window.print(), 400)</script>
</body></html>`)
}

export function buildTable(headers, rows) {
  const ths = headers.map(h => `<th>${h}</th>`).join('')
  const trs = rows.map(row => `<tr>${row.map(c => `<td>${c ?? '—'}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
}
