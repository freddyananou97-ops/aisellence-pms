import { supabase } from './supabase'

/**
 * Default hotel configuration (fallback if Supabase table is empty).
 */
const DEFAULTS = {
  name: 'Maritim Hotel Ingolstadt',
  street: 'Am Congress Centrum 1',
  zip: '85049',
  city: 'Ingolstadt',
  country: 'Deutschland',
  phone: '+49 841 49050',
  email: 'info@maritim-ingolstadt.de',
  taxId: 'DE 123 456 789',
  iban: 'DE89 3704 0044 0532 0130 00',
  bic: 'COBADEFFXXX',
}

// Mutable hotel object — updated on load
export const HOTEL = { ...DEFAULTS }
export const LATE_CHECKOUT = {
  price: 30,  // Late Checkout bis 14:00 = 30€
}

export const MAKE_WEBHOOKS = {
  late_checkout_response: 'https://hook.eu2.make.com/DEIN_WEBHOOK_HIER',
}

export let HOTEL_ADDRESS = `${HOTEL.street} · ${HOTEL.zip} ${HOTEL.city}`
export let HOTEL_FULL = `${HOTEL.name} · ${HOTEL_ADDRESS}`

let loaded = false

/**
 * Load hotel settings from Supabase. Call once at app start.
 * Falls back to defaults if table doesn't exist or is empty.
 */
export async function loadHotelSettings() {
  if (loaded) return HOTEL
  try {
    const { data } = await supabase.from('hotel_settings').select('*')
    if (data && data.length > 0) {
      data.forEach(row => { if (HOTEL.hasOwnProperty(row.key)) HOTEL[row.key] = row.value })
      HOTEL_ADDRESS = `${HOTEL.street} · ${HOTEL.zip} ${HOTEL.city}`
      HOTEL_FULL = `${HOTEL.name} · ${HOTEL_ADDRESS}`
    }
  } catch (e) {
    // Table doesn't exist yet — use defaults
  }
  loaded = true
  return HOTEL
}

/**
 * Save a hotel setting to Supabase.
 */
export async function saveHotelSetting(key, value) {
  const { error } = await supabase.from('hotel_settings').upsert({ key, value })
  if (!error) HOTEL[key] = value
  HOTEL_ADDRESS = `${HOTEL.street} · ${HOTEL.zip} ${HOTEL.city}`
  HOTEL_FULL = `${HOTEL.name} · ${HOTEL_ADDRESS}`
  return !error
}
