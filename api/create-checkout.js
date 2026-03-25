import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SK)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { lineItems, metadata, successUrl, cancelUrl } = req.body

    if (!lineItems || !lineItems.length) {
      return res.status(400).json({ error: 'lineItems required' })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems.map(item => ({
        price_data: {
          currency: 'eur',
          product_data: { name: item.name },
          unit_amount: Math.round(item.amount_cents),
        },
        quantity: item.quantity || 1,
      })),
      success_url: successUrl || `${req.headers.origin || 'http://localhost:5173'}/guest-display?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin || 'http://localhost:5173'}/guest-display?payment=cancelled`,
      metadata: metadata || {},
    })

    res.status(200).json({ url: session.url, id: session.id })
  } catch (err) {
    console.error('Stripe error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
