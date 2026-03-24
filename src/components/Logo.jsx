export default function Logo({ size = 'normal' }) {
  const w = size === 'small' ? 22 : 30
  const f = size === 'small' ? 14 : 18
  const c = 'var(--text, #fff)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <svg width={w} height={w} viewBox="0 0 44 44">
        <rect x="2" y="2" width="40" height="40" rx="10" fill="none" stroke={c} strokeWidth="1.5"/>
        <path d="M12 32L22 12L32 32" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="16" y1="24" x2="28" y2="24" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <span style={{ fontSize: f, fontWeight: 300, color: c, letterSpacing: 1 }}>Isellence</span>
    </div>
  )
}
