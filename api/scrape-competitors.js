import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://niabwewrwezstpyefxup.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const APIFY_TOKEN = process.env.APIFY_TOKEN

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Debug mode: show config status
  if (req.query?.debug === '1') {
    return res.status(200).json({
      apify_token_set: !!APIFY_TOKEN,
      apify_token_length: APIFY_TOKEN?.length || 0,
      supabase_key_set: !!SUPABASE_KEY,
      supabase_url: SUPABASE_URL,
      env_keys: Object.keys(process.env).filter(k => k.includes('APIFY') || k.includes('SUPABASE')),
    })
  }

  // Check required env vars
  if (!APIFY_TOKEN) return res.status(500).json({ error: 'APIFY_TOKEN not configured. Add it to Vercel Environment Variables.', hint: 'Go to Vercel → Settings → Environment Variables → Add APIFY_TOKEN' })
  if (!SUPABASE_KEY) return res.status(500).json({ error: 'SUPABASE_ANON_KEY not configured.', hint: 'Add VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY to Vercel env vars' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    const { data: hotels, error: dbErr } = await supabase.from('competitor_hotels').select('*').eq('active', true)
    if (dbErr) return res.status(500).json({ error: `DB error: ${dbErr.message}` })
    if (!hotels || hotels.length === 0) return res.status(200).json({ prices: [], message: 'No competitor hotels configured' })

    const tomorrow = new Date(Date.now() + 86400000)
    const checkin = tomorrow.toISOString().split('T')[0]
    const checkout = new Date(tomorrow.getTime() + 86400000).toISOString().split('T')[0]

    const results = []

    for (const hotel of hotels) {
      try {
        const bookingUrl = `${hotel.booking_url}?checkin=${checkin}&checkout=${checkout}&group_adults=2&no_rooms=1&selected_currency=EUR`
        const apifyUrl = `https://api.apify.com/v2/acts/voyager~booking-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`

        console.log(`Scraping ${hotel.hotel_name}: ${bookingUrl}`)

        const apifyRes = await fetch(apifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startUrls: [{ url: bookingUrl }],
            maxResults: 1,
          }),
        })

        if (!apifyRes.ok) {
          const errText = await apifyRes.text()
          console.error(`Apify error for ${hotel.hotel_name}: ${apifyRes.status} ${errText}`)
          results.push({ hotel: hotel.hotel_name, price: null, error: `Apify ${apifyRes.status}` })
          continue
        }

        const data = await apifyRes.json()
        console.log(`Apify response for ${hotel.hotel_name}:`, JSON.stringify(data).slice(0, 200))

        const item = Array.isArray(data) ? data[0] : null
        const price = item?.price?.value || item?.price || item?.rooms?.[0]?.price || null

        if (price && !isNaN(parseFloat(price))) {
          await supabase.from('competitor_prices').insert({
            hotel_name: hotel.hotel_name,
            price: parseFloat(price),
            date_checked: checkin,
            source: 'booking.com',
            room_type: 'Doppelzimmer',
          })
          results.push({ hotel: hotel.hotel_name, price: parseFloat(price), date: checkin })
        } else {
          results.push({ hotel: hotel.hotel_name, price: null, error: 'No price in response', raw: JSON.stringify(data).slice(0, 100) })
        }
      } catch (e) {
        console.error(`Error scraping ${hotel.hotel_name}:`, e.message)
        results.push({ hotel: hotel.hotel_name, price: null, error: e.message })
      }
    }

    res.status(200).json({ prices: results, date: checkin, count: results.filter(r => r.price).length })
  } catch (err) {
    console.error('Scraper error:', err)
    res.status(500).json({ error: err.message })
  }
}
