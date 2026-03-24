import { useState, useEffect, useCallback } from 'react'

const SOUNDS = {
  dashboard: [880, 1100, 880],
  housekeeping: [660, 880],
  kitchen: [523, 784, 1047],
  wartung: [440, 330, 440],
}

export function useNotifications(type = 'dashboard') {
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const playSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      const freqs = SOUNDS[type] || SOUNDS.dashboard
      freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1))
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } catch (e) { /* silent fail */ }
  }, [type])

  const sendBrowserNotification = useCallback((title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  }, [])

  const triggerFlash = useCallback(() => {
    setFlash(true)
    setTimeout(() => setFlash(false), 1500)
  }, [])

  const notify = useCallback((title, body) => {
    playSound()
    sendBrowserNotification(title, body)
    triggerFlash()
  }, [playSound, sendBrowserNotification, triggerFlash])

  return { flash, notify, playSound, triggerFlash }
}
