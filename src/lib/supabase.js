import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================
// BOOKINGS
// ============================================================
export async function fetchBookings() {
  const { data, error } = await supabase.from('bookings').select('*').order('check_in', { ascending: true })
  if (error) console.error('fetchBookings:', error)
  return data || []
}

// ============================================================
// SHIFT LOGS
// ============================================================
export async function fetchShiftLogs(limit = 5) {
  const { data, error } = await supabase.from('shift_logs').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) console.error('fetchShiftLogs:', error)
  return data || []
}

// ============================================================
// COMPLAINTS / MAINTENANCE / SERVICE REQUESTS
// ============================================================
export async function fetchComplaints() {
  const { data, error } = await supabase.from('complaints').select('*').eq('resolved', false).order('created_at', { ascending: false })
  if (error) console.error('fetchComplaints:', error)
  return data || []
}

export async function fetchMaintenance() {
  const { data, error } = await supabase.from('maintenance').select('*').eq('resolved', false).order('created_at', { ascending: false })
  if (error) console.error('fetchMaintenance:', error)
  return data || []
}

export async function fetchServiceRequests() {
  const { data, error } = await supabase.from('service_requests').select('*').eq('status', 'pending').order('timestamp', { ascending: false })
  if (error) console.error('fetchServiceRequests:', error)
  return data || []
}

export async function fetchAllOpenRequests() {
  const { data, error } = await supabase.from('service_requests').select('*').in('status', ['pending', 'accepted']).order('timestamp', { ascending: true })
  if (error) console.error('fetchAllOpenRequests:', error)
  return data || []
}

// ============================================================
// HOUSEKEEPING
// ============================================================
export async function fetchHousekeeping() {
  const { data, error } = await supabase.from('housekeeping').select('*')
  if (error) console.error('fetchHousekeeping:', error)
  return data || []
}

// ============================================================
// REVENUE
// ============================================================
export async function fetchRevenueInsights() {
  const { data, error } = await supabase.from('revenue_insights').select('*').order('date', { ascending: false }).limit(1)
  if (error) console.error('fetchRevenueInsights:', error)
  return data?.[0] || null
}

// ============================================================
// EVENTS
// ============================================================
export async function fetchEvents(daysAhead = 7) {
  const today = new Date().toISOString().split('T')[0]
  const future = new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0]
  const { data, error } = await supabase.from('events_calendar').select('*').gte('start_date', today).lte('start_date', future).order('start_date', { ascending: true })
  if (error) console.error('fetchEvents:', error)
  return data || []
}

export async function insertEvents(events) {
  const { data, error } = await supabase.from('events_calendar').insert(events)
  if (error) console.error('insertEvents:', error)
  return { data, error }
}

// ============================================================
// FEEDBACK
// ============================================================
export async function fetchFeedback(limit = 5) {
  const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) console.error('fetchFeedback:', error)
  return data || []
}

// ============================================================
// RESTAURANT
// ============================================================
export async function fetchRestaurantTables() {
  const { data, error } = await supabase.from('restaurant_tables').select('*').eq('active', true).order('name', { ascending: true })
  if (error) console.error('fetchRestaurantTables:', error)
  return data || []
}

export async function fetchRestaurantReservations(date) {
  const { data, error } = await supabase.from('restaurant_reservations').select('*').eq('date', date).order('time', { ascending: true })
  if (error) console.error('fetchRestaurantReservations:', error)
  return data || []
}

// ============================================================
// SPA
// ============================================================
export async function fetchSpaTreatments() {
  const { data, error } = await supabase.from('spa_treatments').select('*').order('name', { ascending: true })
  if (error) console.error('fetchSpaTreatments:', error)
  return data || []
}

export async function fetchSpaBookings(date) {
  const { data, error } = await supabase.from('spa_bookings').select('*').eq('date', date).order('time', { ascending: true })
  if (error) console.error('fetchSpaBookings:', error)
  return data || []
}

// ============================================================
// GUEST DISPLAY SESSIONS
// ============================================================
export async function fetchGuestDisplaySessions() {
  const { data, error } = await supabase.from('guest_display_sessions').select('*').order('created_at', { ascending: false })
  if (error) console.error('fetchGuestDisplaySessions:', error)
  return data || []
}

// ============================================================
// AUTH
// ============================================================
export async function loginEmployee(name, pin) {
  const { data, error } = await supabase.from('employees').select('*').eq('name', name.trim()).eq('pin', pin.trim()).eq('active', true).single()
  if (error) return null
  return data
}

// ============================================================
// REALTIME
// ============================================================
export function subscribeToTable(table, callback) {
  const channel = supabase
    .channel(`realtime-${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      console.log(`[Realtime] ${table}:`, payload.eventType)
      callback(payload)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeToMultiple(tables, callback) {
  const unsubscribes = tables.map(table => subscribeToTable(table, callback))
  return () => unsubscribes.forEach(unsub => unsub())
}
