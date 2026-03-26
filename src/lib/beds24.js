const BEDS24_API_KEY = import.meta.env.VITE_BEDS24_API_KEY || 'aisellence2026apikey'
const BEDS24_API = 'https://api.beds24.com/json'

/**
 * Sync a price to Beds24 for a specific room and date range.
 */
export async function syncPriceToBeds24(roomId, startDate, endDate, price) {
  if (!roomId) return { success: false, error: 'No Beds24 Room ID' }
  try {
    const res = await fetch(`${BEDS24_API}/setRoomPrices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: BEDS24_API_KEY,
        roomId,
        dateFrom: startDate,
        dateTo: endDate,
        price: [{ nrGuests: 1, price }],
      }),
    })
    const data = await res.json()
    return { success: !data.error, data }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
