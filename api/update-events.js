import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://niabwewrwezstpyefxup.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' })
  if (!SUPABASE_KEY) return res.status(500).json({ error: 'SUPABASE_ANON_KEY not configured.' })

  const debug = req.query?.debug === '1'
  const debugLog = []
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    const today = new Date()
    const twoWeeks = new Date(today.getTime() + 14 * 86400000)
    const fromDate = today.toISOString().split('T')[0]
    const toDate = twoWeeks.toISOString().split('T')[0]

    console.log(`Searching events from ${fromDate} to ${toDate}`)

    // Call Claude with web search
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Suche nach allen Veranstaltungen, Messen, Konzerten, Sportevents, Volksfesten und wichtigen Events die zwischen ${fromDate} und ${toDate} in Ingolstadt und Umgebung (20km Radius) stattfinden. Antworte NUR mit einem JSON Array, keine andere Erklärung. Format pro Event: { "name": "Eventname", "date": "YYYY-MM-DD", "type": "fussball|eishockey|konzert|messe|volksfest|theater|sport|sonstiges", "impact": "high|medium|low", "description": "Kurzbeschreibung in 1 Satz" }. Impact-Bewertung: high = bringt viele Besucher in die Stadt (Bundesliga, große Messe, großes Konzert), medium = mittelgroß (regionales Konzert, Theateraufführung), low = klein (lokales Fest, Lesung). Gib mindestens 5-10 Events zurück wenn vorhanden.`
        }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('Claude API error:', claudeRes.status, errText)
      return res.status(500).json({ error: `Claude API ${claudeRes.status}`, details: errText.slice(0, 200) })
    }

    const claudeData = await claudeRes.json()
    console.log('Claude response content blocks:', claudeData.content?.length)
    if (debug) debugLog.push({ step: 'claude_response', blocks: claudeData.content?.length, stop_reason: claudeData.stop_reason })

    // Extract text from response (may have multiple content blocks with tool use)
    let jsonText = ''
    for (const block of (claudeData.content || [])) {
      if (block.type === 'text' && block.text) jsonText += block.text
    }

    // Parse JSON array from response
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON array found in response:', jsonText.slice(0, 300))
      return res.status(200).json({ events: [], message: 'No JSON array in Claude response', raw: jsonText.slice(0, 300) })
    }

    let events
    try {
      events = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('JSON parse error:', e.message)
      return res.status(200).json({ events: [], message: 'JSON parse error', raw: jsonMatch[0].slice(0, 300) })
    }

    if (!Array.isArray(events)) {
      return res.status(200).json({ events: [], message: 'Response is not an array' })
    }

    console.log(`Parsed ${events.length} events from Claude`)
    if (debug) debugLog.push({ step: 'parsed', count: events.length, events })

    // Insert new events (skip duplicates)
    let inserted = 0
    const insertResults = []
    for (const ev of events) {
      if (!ev.name || !ev.date) { insertResults.push({ name: ev.name, skip: 'missing name or date' }); continue }

      const { data: existing, error: checkErr } = await supabase.from('events_calendar')
        .select('id')
        .eq('event_name', ev.name)
        .eq('start_date', ev.date)
        .maybeSingle()

      if (checkErr) {
        console.error(`  Check error for ${ev.name}:`, checkErr.message)
        insertResults.push({ name: ev.name, date: ev.date, skip: 'check_error', error: checkErr.message })
        continue
      }

      if (existing) {
        console.log(`  Skip (exists): ${ev.name} on ${ev.date}`)
        insertResults.push({ name: ev.name, date: ev.date, skip: 'exists' })
        continue
      }

      const row = { event_name: ev.name, start_date: ev.date, event_type: ev.type || 'sonstiges', impact_level: ev.impact || 'medium', description: ev.description || null }
      const { error: insErr } = await supabase.from('events_calendar').insert(row)

      if (insErr) {
        console.error(`  Insert error for ${ev.name}:`, insErr.message)
        insertResults.push({ name: ev.name, date: ev.date, result: 'error', error: insErr.message, row })
      } else {
        console.log(`  Inserted: ${ev.name} on ${ev.date}`)
        insertResults.push({ name: ev.name, date: ev.date, result: 'inserted' })
        inserted++
      }
    }

    const result = { total: events.length, inserted, skipped: events.length - inserted }
    if (debug) result.debugLog = debugLog
    if (debug) result.claudeRaw = jsonText.slice(0, 1000)
    if (debug) result.insertResults = insertResults
    res.status(200).json(result)
  } catch (err) {
    console.error('Event update error:', err)
    res.status(500).json({ error: err.message })
  }
}
