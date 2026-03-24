import { useState, useEffect, useCallback } from 'react'
import { subscribeToMultiple } from '../lib/supabase'

const REALTIME_TABLES = [
  'bookings',
  'complaints',
  'maintenance',
  'service_requests',
  'shift_logs',
  'housekeeping',
  'feedback',
  'minibar_consumption',
  'restaurant_tables',
  'restaurant_reservations',
  'spa_bookings',
]

export function useRealtime(fetchFn) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFn()
      setData(result)
      setLastUpdate(new Date())
    } catch (e) {
      console.error('useRealtime refresh error:', e)
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    refresh()
    const unsubscribe = subscribeToMultiple(REALTIME_TABLES, () => refresh())
    return unsubscribe
  }, [refresh])

  return { data, loading, lastUpdate, refresh }
}

export function useDashboardData(fetchFunctions) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const refresh = useCallback(async () => {
    try {
      const results = {}
      const entries = Object.entries(fetchFunctions)
      await Promise.all(entries.map(async ([key, fn]) => { results[key] = await fn() }))
      setData(results)
      setLastUpdate(new Date())
    } catch (e) {
      console.error('useDashboardData error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const unsubscribe = subscribeToMultiple(REALTIME_TABLES, () => refresh())
    return unsubscribe
  }, [refresh])

  return { data, loading, lastUpdate, refresh }
}
