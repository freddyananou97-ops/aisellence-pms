/**
 * Create a Stripe Checkout session via our Vercel API route.
 * Returns { url, id } where url is the Stripe Checkout page.
 */
export async function createCheckoutSession({ lineItems, metadata, successUrl, cancelUrl }) {
  const res = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineItems, metadata, successUrl, cancelUrl }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || 'Failed to create checkout session')
  }
  return res.json()
}

/**
 * Build Stripe line items from PMS invoice data.
 */
export function buildLineItems({ roomTotal, nights, room, charges }) {
  const items = []

  if (roomTotal > 0) {
    items.push({
      name: `Übernachtung (${nights || 1} Nächte) · Zimmer ${room}`,
      amount_cents: Math.round(roomTotal * 100),
      quantity: 1,
    })
  }

  if (charges && charges.length > 0) {
    for (const c of charges) {
      if (c.amount > 0) {
        items.push({
          name: `${c.type}${c.details ? ': ' + c.details : ''}`,
          amount_cents: Math.round(c.amount * 100),
          quantity: 1,
        })
      }
    }
  }

  return items
}
