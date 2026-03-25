/**
 * Seed script for events_calendar table.
 *
 * Usage (after npm install):
 *   node scripts/seed-events.js
 *
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY env vars, or edit the values below.
 * You can also paste this into the browser console while the app is running:
 *   import { supabase } from '/src/lib/supabase'; then run the insert.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://niabwewrwezstpyefxup.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_ANON_KEY. Set it as env var or edit this file.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const events = [
  { event_name: 'ERC Ingolstadt Playoff Heim vs München', start_date: '2026-03-27', event_type: 'eishockey', impact_level: 'high' },
  { event_name: 'ERC Ingolstadt Playoff Heim vs München', start_date: '2026-03-29', event_type: 'eishockey', impact_level: 'high' },
  { event_name: 'ABBA Concert Theater', start_date: '2026-03-28', event_type: 'konzert', impact_level: 'medium' },
  { event_name: 'Herr der Ringe Konzert', start_date: '2026-04-06', event_type: 'konzert', impact_level: 'medium' },
  { event_name: 'Rock meets Classic Saturn Arena', start_date: '2026-04-13', event_type: 'konzert', impact_level: 'medium' },
  { event_name: 'Ralf Schmitz Saturn Arena', start_date: '2026-04-23', event_type: 'konzert', impact_level: 'medium' },
  { event_name: 'Monika Gruber Ingolstadt', start_date: '2026-06-14', event_type: 'konzert', impact_level: 'high' },
  { event_name: 'Özcan Cosar Saturn Arena', start_date: '2026-09-29', event_type: 'konzert', impact_level: 'medium' },
  { event_name: 'Dieter Nuhr Saturn Arena', start_date: '2026-10-10', event_type: 'konzert', impact_level: 'medium' },
  { event_name: 'Kaya Yanar Saturn Arena', start_date: '2026-11-14', event_type: 'konzert', impact_level: 'medium' },
  { event_name: 'Hazel Brugger Saturn Arena', start_date: '2026-11-20', event_type: 'konzert', impact_level: 'medium' },
]

console.log(`Inserting ${events.length} events into events_calendar...`)
const { data, error } = await supabase.from('events_calendar').insert(events)

if (error) {
  console.error('Insert failed:', error.message)
  process.exit(1)
} else {
  console.log(`Successfully inserted ${events.length} events.`)
}
