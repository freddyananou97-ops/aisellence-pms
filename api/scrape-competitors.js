import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://niabwewrwezstpyefxup.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
)
const APIFY_TOKEN = process.env.APIFY_TOKEN

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Get competitor hotels from DB
    const { data: hotels } = await supabase.from('competitor_hotels').select('*').eq('active', true)
    if (!hotels || hotels.length === 0) return res.status(200).json({ prices: [], message: 'No competitor hotels configured' })

    // Tomorrow's date for price check
    const tomorrow = new Date(Date.now() + 86400000)
    const checkin = tomorrow.toISOString().split('T')[0]
    const co = new Date(tomorrow.getTime() + 86400000).toISOString().split('T')[0]

    const results = []

    for (const hotel of hotels) {
      try {
        const url = `${hotel.booking_url}?checkin=${checkin}&checkout=${co}&group_adults=2&no_rooms=1&selected_currency=EUR`
        const apifyRes = await fetch(
          `https://api.apify.com/v2/acts/voyager~booking-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startUrls: [{ url }], maxResults: 1 }),
          }
        )
        const data = await apifyRes.json()
        const item = Array.isArray(data) && data[0]
        const price = item?.price?.value || item?.price || null

        if (price) {
          await supabase.from('competitor_prices').insert({
            hotel_name: hotel.hotel_name,
            price: parseFloat(price),
            date_checked: checkin,
            source: 'booking.com',
            room_type: 'Doppelzimmer',
          })
          results.push({ hotel: hotel.hotel_name, price: parseFloat(price), date: checkin })
        } else {
          results.push({ hotel: hotel.hotel_name, price: null, error: 'No price found' })
        }
      } catch (e) {
        results.push({ hotel: hotel.hotel_name, price: null, error: e.message })
      }
    }

    res.status(200).json({ prices: results, date: checkin })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
