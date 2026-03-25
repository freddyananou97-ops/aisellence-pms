import { useState, useEffect, useRef, useCallback } from 'react'

export default function SignatureCanvas({ onSign, label = 'Unterschrift', clearLabel = 'Unterschrift löschen' }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const getCanvasHeight = () => Math.max(160, Math.min(240, Math.round(window.innerHeight * 0.18)))

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.parentElement.getBoundingClientRect()
    const h = getCanvasHeight()
    canvas.width = rect.width
    canvas.height = h
    canvas.style.height = h + 'px'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#bbb'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(40, canvas.height - 40)
    ctx.lineTo(canvas.width - 40, canvas.height - 40)
    ctx.stroke()
    ctx.fillStyle = '#ccc'
    ctx.font = '11px system-ui'
    ctx.fillText(label, 40, canvas.height - 24)
  }, [label])

  useEffect(() => { initCanvas() }, [initCanvas])

  useEffect(() => {
    const handleResize = () => { if (!hasDrawn) initCanvas() }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [hasDrawn, initCanvas])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return { x: t.clientX - rect.left, y: t.clientY - rect.top }
  }
  const start = (e) => { e.preventDefault(); drawing.current = true; const ctx = canvasRef.current.getContext('2d'); const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round' }
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); setHasDrawn(true) }
  const end = () => { drawing.current = false; if (hasDrawn && onSign) onSign(canvasRef.current.toDataURL('image/png')) }
  const clear = () => { initCanvas(); setHasDrawn(false); if (onSign) onSign(null) }

  return (
    <div>
      <div style={{ border: '1px solid var(--borderLight, #d1d5db)', borderRadius: 12, overflow: 'hidden', background: '#fff', touchAction: 'none' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: getCanvasHeight(), cursor: 'crosshair' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      </div>
      {hasDrawn && <button onClick={clear} style={{ marginTop: 8, padding: '6px 16px', background: 'var(--bgCard, #f3f4f6)', border: '1px solid var(--borderLight, #e5e7eb)', borderRadius: 8, fontSize: 13, color: 'var(--textMuted, #6b7280)', cursor: 'pointer', fontFamily: 'inherit' }}>{clearLabel}</button>}
    </div>
  )
}
