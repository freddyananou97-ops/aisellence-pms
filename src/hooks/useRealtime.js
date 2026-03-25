import { useState, useEffect, useCallback } from 'react'
import { subscribeToMultiple } from '../lib/supabase'

// Only subscribe to tables that actually need live updates on the Dashboard
const DASHBOARD_TABLES = ['bookings', 'service_requests', 'maintenance']

export function useRealtime(fetchFn, tables) {
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
    const realtimeTables = tables || DASHBOARD_TABLES
    const unsubscribe = subscribeToMultiple(realtimeTables, () => refresh())
    return unsubscribe
  }, [refresh, tables])

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
    // Dashboard only needs live updates from these core tables
    const unsubscribe = subscribeToMultiple(DASHBOARD_TABLES, () => refresh())
    return unsubscribe
  }, [refresh])

  return { data, loading, lastUpdate, refresh }
}
