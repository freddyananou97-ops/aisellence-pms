/**
 * One-time migration: Hash all plaintext PINs in the employees table.
 * Run with: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/migrate-pin-hashes.js
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://niabwewrwezstpyefxup.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_KEY) { console.error('Missing SUPABASE_ANON_KEY'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(pin + ':' + salt)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function migrate() {
  const { data: employees } = await supabase.from('employees').select('id, name, pin')
  if (!employees || employees.length === 0) { console.log('No employees found.'); return }

  console.log(`Migrating ${employees.length} employees...`)
  for (const emp of employees) {
    // Skip if PIN already looks like a hash (64 hex chars)
    if (emp.pin && emp.pin.length === 64 && /^[0-9a-f]+$/.test(emp.pin)) {
      console.log(`  ${emp.name}: already hashed, skipping`)
      continue
    }
    const hashed = await hashPin(emp.pin, emp.id)
    await supabase.from('employees').update({ pin: hashed }).eq('id', emp.id)
    console.log(`  ${emp.name}: PIN hashed successfully`)
  }
  console.log('Migration complete.')
}

migrate()
