import { useState, useEffect, useRef } from 'react'
import QRCodeLib from 'qrcode'

export default function QRCode({ value, size = 200 }) {
  const canvasRef = useRef(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!value || !canvasRef.current) return
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size, margin: 2, color: { dark: '#000', light: '#fff' },
    }).catch(() => setError(true))
  }, [value, size])

  if (!value) return null
  if (error) return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: 12, fontSize: 11, color: '#6b7280' }}>QR-Code nicht verfügbar</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <canvas ref={canvasRef} style={{ borderRadius: 12 }} />
      <span style={{ fontSize: 10, color: 'var(--textDim, #9ca3af)', maxWidth: size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        Mit Handy scannen um zu bezahlen
      </span>
    </div>
  )
}
