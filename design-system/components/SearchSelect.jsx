/**
 * Searchable Select Dropdown — used in GuestDisplay (nationalities, phone codes)
 * Supports keyboard navigation (ArrowDown/Up, Enter, Escape).
 *
 * Props:
 *   options: [{ v: 'value', l: 'Label' }] or [{ code: '+49', l: 'Deutschland +49' }]
 *   value: current selected value
 *   onChange: (value) => void
 *   placeholder: string
 */
import { useState, useEffect, useRef } from 'react'

export default function SearchSelect({ options, value, onChange, placeholder, style: extraStyle }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlighted, setHighlighted] = useState(-1)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [open])

  const selected = options.find(o => o.v === value || o.code === value)
  const displayValue = selected ? (selected.l || selected.v) : ''
  const filtered = options.filter(o => {
    if (o.v === '---' || o.code === '---') return !search
    const q = search.toLowerCase()
    return !q || (o.l || '').toLowerCase().includes(q) || (o.v || '').toLowerCase().includes(q) || (o.code || '').toLowerCase().includes(q)
  })
  const selectables = filtered.filter(o => o.v !== '---' && o.code !== '---')

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, selectables.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && highlighted >= 0 && selectables[highlighted]) {
      e.preventDefault()
      onChange(selectables[highlighted].v || selectables[highlighted].code)
      setOpen(false); setSearch('')
    }
  }

  const inputStyle = { width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 15, color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

  return (
    <div ref={ref} style={{ position: 'relative', ...extraStyle }}>
      <button type="button" onClick={() => { setOpen(!open); setSearch(''); setHighlighted(-1) }} style={{
        ...inputStyle, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: displayValue ? '#1a1a1a' : '#9ca3af' }}>{displayValue || placeholder}</span>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, marginTop: 4, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', maxHeight: 260, display: 'flex', flexDirection: 'column' }}>
          <input autoFocus value={search} onChange={e => { setSearch(e.target.value); setHighlighted(0) }} onKeyDown={handleKeyDown} placeholder={placeholder || 'Suchen...'} style={{ ...inputStyle, border: 'none', borderBottom: '1px solid #e5e7eb', borderRadius: '10px 10px 0 0', fontSize: 14 }} />
          <div style={{ overflowY: 'auto', maxHeight: 210 }}>
            {filtered.map((o, i) => {
              const key = o.v || o.code || i
              if (o.v === '---' || o.code === '---') return <div key={key + i} style={{ padding: '4px 14px', fontSize: 11, color: '#d1d5db' }}>{o.l}</div>
              const selIdx = selectables.indexOf(o)
              return (
                <button key={key} type="button" onClick={() => { onChange(o.v || o.code); setOpen(false); setSearch('') }} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', cursor: 'pointer',
                  background: selIdx === highlighted ? '#dbeafe' : (o.v === value || o.code === value) ? '#eff6ff' : 'transparent',
                  color: '#1a1a1a', fontSize: 14, fontFamily: 'inherit',
                }}>{o.l}</button>
              )
            })}
            {filtered.length === 0 && <div style={{ padding: 14, color: '#9ca3af', fontSize: 13 }}>Keine Ergebnisse</div>}
          </div>
        </div>
      )}
    </div>
  )
}
