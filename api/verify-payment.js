import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SK)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { sessionId } = req.body
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    res.status(200).json({ paid: session.payment_status === 'paid', status: session.payment_status })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
