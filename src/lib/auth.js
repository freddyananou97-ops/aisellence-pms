import { supabase } from './supabase'

/**
 * Hash a PIN with SHA-256 using employee_id as salt.
 * Works in all modern browsers via crypto.subtle.
 */
export async function hashPin(pin, salt = '') {
  const data = new TextEncoder().encode(pin + ':' + salt)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Login: fetch employee by name, then verify PIN hash.
 */
export async function loginWithHash(name, pin) {
  const { data: employees } = await supabase.from('employees').select('*').eq('name', name.trim()).eq('active', true)
  if (!employees || employees.length === 0) return null

  for (const emp of employees) {
    // Support both hashed and legacy plaintext PINs
    const hashed = await hashPin(pin, emp.id)
    if (emp.pin === hashed) return emp
    // Fallback: plaintext comparison (for un-migrated PINs)
    if (emp.pin === pin.trim()) return emp
  }
  return null
}
