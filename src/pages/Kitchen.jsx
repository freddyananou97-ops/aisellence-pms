import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, subscribeToTable } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'

const ORDER_STATUS = {
  pending: { label: 'Neu', color: '#3b82f6' },
  preparing: { label: 'In Zubereitung', color: '#f59e0b' },
  ready: { label: 'Fertig', color: '#10b981' },
  delivered: { label: 'Geliefert', color: '#6b7280' },
}

export default function Kitchen() {
  const [orders, setOrders] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('aktiv')
  const [confirm, setConfirm] = useState(null)
  const [timeDialog, setTimeDialog] = useState(null)
  const [estMinutes, setEstMinutes] = useState(20)
  const [signatureOrder, setSignatureOrder] = useState(null)

  const load = useCallback(async () => {
    const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const [active, hist] = await Promise.all([
      supabase.from('service_requests').select('*').eq('category', 'room_service').in('status', ['pending', 'preparing', 'ready']).order('timestamp', { ascending: false }),
      supabase.from('service_requests').select('*').eq('category', 'room_service').eq('status', 'delivered').gte('timestamp', threeDaysAgo.toISOString()).order('timestamp', { ascending: false }),
    ])
    setOrders(active.data || [])
    setHistory(hist.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load(); const u = subscribeToTable('service_requests', () => load()); return u }, [load])

  const startPreparing = (order) => { setTimeDialog(order); setEstMinutes(20) }

  const confirmPreparing = async () => {
    await supabase.from('service_requests').update({
      status: 'preparing', response_minutes: estMinutes,
      response_message: `Ihre Bestellung wird in ca. ${estMinutes} Minuten geliefert.`
    }).eq('id', timeDialog.id)
    setTimeDialog(null); load()
  }

  const markReady = (order) => {
    setConfirm({ title: 'Bestellung fertig', message: `Bestellung für Zi. ${order.room} als fertig markieren?`, confirmLabel: 'Fertig', confirmColor: '#10b981',
      onConfirm: async () => { await supabase.from('service_requests').update({ status: 'ready' }).eq('id', order.id); setConfirm(null); load() }
    })
  }

  const startDelivery = (order) => { setSignatureOrder(order) }

  const pendingCount = orders.filter(o => o.status === 'pending').length
  const preparingCount = orders.filter(o => o.status === 'preparing').length
  const readyCount = orders.filter(o => o.status === 'ready').length

  return (
    <div style={s.content}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Küche / Room Service</h1>
          <p style={{ fontSize: 12, color: 'var(--textMuted)', marginTop: 4 }}>{pendingCount} neue · {preparingCount} in Zubereitung · {readyCount} fertig</p>
        </div>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.4)', animation: 'pulse 2s ease-in-out infinite' }} />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[['Neu', pendingCount, '#3b82f6'], ['In Zubereitung', preparingCount, '#f59e0b'], ['Fertig', readyCount, '#10b981']].map(([l, c, col]) => (
          <div key={l} style={{ background: 'var(--bgCard)', border: `1px solid ${c > 0 ? col : 'var(--borderLight)'}`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: c > 0 ? col : 'var(--textDim)' }}>{c}</div>
            <div style={{ fontSize: 10, color: 'var(--textMuted)' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['aktiv', `Aktiv (${orders.length})`], ['verlauf', `Verlauf 3 Tage (${history.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            background: tab === k ? 'var(--text)' : 'var(--bgCard)', color: tab === k ? 'var(--bg)' : 'var(--textMuted)',
            border: `1px solid ${tab === k ? 'var(--text)' : 'var(--borderLight)'}`,
          }}>{l}</button>
        ))}
      </div>

      {/* Active Orders */}
      {tab === 'aktiv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(order => <OrderCard key={order.id} order={order} onPrepare={startPreparing} onReady={markReady} onDeliver={startDelivery} />)}
          {orders.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Keine aktiven Bestellungen</div>}
        </div>
      )}

      {/* History */}
      {tab === 'verlauf' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map(order => {
            const created = new Date(order.timestamp)
            const resolved = order.resolved_at ? new Date(order.resolved_at) : null
            const duration = resolved ? Math.round((resolved - created) / 60000) : null
            return (
              <div key={order.id} style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, padding: '12px 16px', opacity: 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Zi. {order.room}</span>
                    <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{order.guest_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {duration && <span style={{ fontSize: 10, color: 'var(--textDim)' }}>{duration} Min. Dauer</span>}
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(107,114,128,0.1)', color: '#6b7280' }}>Geliefert</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--textMuted)', margin: '4px 0 0' }}>{order.request_details}</p>
                <div style={{ fontSize: 10, color: 'var(--textDim)', marginTop: 4 }}>{created.toLocaleDateString('de-DE')} · {created.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            )
          })}
          {history.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Kein Verlauf in den letzten 3 Tagen</div>}
        </div>
      )}

      {/* Time Estimate Dialog */}
      {timeDialog && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Zubereitung starten</h3>
            <p style={{ fontSize: 12, color: 'var(--textMuted)', margin: '0 0 4px' }}>Zi. {timeDialog.room} · {timeDialog.guest_name}</p>
            <p style={{ fontSize: 11, color: 'var(--textDim)', margin: '0 0 20px' }}>{timeDialog.request_details}</p>
            <div style={{ fontSize: 10, color: 'var(--textMuted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Geschätzte Lieferzeit</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
              {[10, 15, 20, 30, 45].map(m => (
                <button key={m} onClick={() => setEstMinutes(m)} style={{
                  padding: '10px 14px', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                  background: estMinutes === m ? '#f59e0b' : 'var(--bgCard)', color: estMinutes === m ? '#000' : 'var(--textMuted)',
                  border: estMinutes === m ? '2px solid #f59e0b' : '1px solid var(--borderLight)',
                }}>{m}</button>
              ))}
            </div>
            <p style={{ fontSize: 10, color: 'var(--textDim)', marginBottom: 20 }}>Gast wird informiert: "Ihre Bestellung kommt in ca. {estMinutes} Min."</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setTimeDialog(null)} style={s.cancelBtn}>Abbrechen</button>
              <button onClick={confirmPreparing} style={{ flex: 1, padding: 12, background: '#f59e0b', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#000', cursor: 'pointer', fontFamily: 'inherit' }}>Starten</button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Dialog */}
      {signatureOrder && <SignaturePad order={signatureOrder} onComplete={async (sigData) => {
        await supabase.from('service_requests').update({ status: 'delivered', resolved_at: new Date().toISOString(), image_url: sigData }).eq('id', signatureOrder.id)
        setSignatureOrder(null); load()
      }} onCancel={() => setSignatureOrder(null)} />}

      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
    </div>
  )
}

function OrderCard({ order, onPrepare, onReady, onDeliver }) {
  const st = ORDER_STATUS[order.status] || ORDER_STATUS.pending
  const mins = order.timestamp ? Math.round((Date.now() - new Date(order.timestamp).getTime()) / 60000) : 0
  return (
    <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderLeft: `4px solid ${st.color}`, borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Zi. {order.room}</span>
          <span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{order.guest_name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--textDim)' }}>vor {mins} Min.</span>
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${st.color}15`, color: st.color, fontWeight: 500 }}>{st.label}</span>
        </div>
      </div>
      <p style={{ fontSize: 14, color: 'var(--textSec)', lineHeight: 1.5, margin: '10px 0 14px' }}>{order.request_details}</p>
      {order.status === 'preparing' && order.response_minutes && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 10px', background: 'rgba(245,158,11,0.06)', borderRadius: 6 }}>
          <span style={{ fontSize: 11, color: '#f59e0b' }}>⏱ ca. {order.response_minutes} Min.</span>
          <span style={{ fontSize: 10, color: 'var(--textDim)' }}>— Gast informiert</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        {order.status === 'pending' && <button style={{ ...s.actionBtn, background: '#f59e0b', color: '#000' }} onClick={() => onPrepare(order)}>Zubereitung starten</button>}
        {order.status === 'preparing' && <button style={{ ...s.actionBtn, background: '#10b981', color: '#fff' }} onClick={() => onReady(order)}>Fertig</button>}
        {order.status === 'ready' && <button style={{ ...s.actionBtn, background: '#6b7280', color: '#fff' }} onClick={() => onDeliver(order)}>Geliefert — Unterschrift</button>}
      </div>
    </div>
  )
}

function SignaturePad({ order, onComplete, onCancel }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDraw = (e) => {
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
  }

  const draw = (e) => {
    if (!drawing) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#fff'
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
    setHasDrawn(true)
  }

  const endDraw = () => setDrawing(false)

  const clear = () => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    setHasDrawn(false)
  }

  const submit = () => {
    if (!hasDrawn) return
    const data = canvasRef.current.toDataURL('image/png')
    onComplete(data)
  }

  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: 460, textAlign: 'center' }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Lieferbestätigung — Unterschrift</h3>
        <p style={{ fontSize: 12, color: 'var(--textMuted)', margin: '0 0 4px' }}>Zi. {order.room} · {order.guest_name}</p>
        <p style={{ fontSize: 11, color: 'var(--textDim)', margin: '0 0 16px' }}>{order.request_details}</p>

        <div style={{ border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden', marginBottom: 8, position: 'relative' }}>
          <canvas ref={canvasRef} width={400} height={180} style={{ width: '100%', height: 180, cursor: 'crosshair', touchAction: 'none', background: 'var(--bg)' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
          {!hasDrawn && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--textDim)', fontSize: 13, pointerEvents: 'none' }}>Hier unterschreiben</div>}
        </div>
        <button onClick={clear} style={{ fontSize: 10, color: 'var(--textDim)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12, fontFamily: 'inherit' }}>Löschen und neu</button>

        <p style={{ fontSize: 10, color: 'var(--textDim)', marginBottom: 12 }}>Betrag wird auf die Zimmerrechnung gebucht.</p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={s.cancelBtn}>Abbrechen</button>
          <button onClick={submit} disabled={!hasDrawn} style={{ flex: 1, padding: 12, background: hasDrawn ? '#10b981' : 'var(--bgCard)', border: hasDrawn ? 'none' : '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, fontWeight: 600, color: hasDrawn ? '#fff' : 'var(--textDim)', cursor: hasDrawn ? 'pointer' : 'default', fontFamily: 'inherit' }}>Lieferung bestätigen</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  content: { padding: '28px 32px', maxWidth: 800 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  h1: { fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: 0 },
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlayBg, rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--modalBg, #111)', border: '1px solid var(--modalBorder, #222)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440 },
  cancelBtn: { flex: 1, padding: 12, background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 10, fontSize: 12, color: 'var(--textMuted)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  actionBtn: { padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
}
