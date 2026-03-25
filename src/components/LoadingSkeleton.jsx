/**
 * Reusable loading skeleton with pulse animation.
 * Usage: <LoadingSkeleton rows={5} /> or <LoadingSkeleton type="cards" count={6} />
 */
export function SkeletonBar({ width = '100%', height = 14, style }) {
  return <div style={{ width, height, borderRadius: 6, background: 'var(--borderLight, #1a1a1a)', animation: 'skeleton-pulse 1.5s ease-in-out infinite', ...style }} />
}

export function SkeletonCard({ style }) {
  return (
    <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, padding: 16, ...style }}>
      <SkeletonBar width="40%" height={10} style={{ marginBottom: 10 }} />
      <SkeletonBar width="60%" height={24} style={{ marginBottom: 6 }} />
      <SkeletonBar width="30%" height={10} />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        {Array.from({ length: cols }, (_, i) => <SkeletonBar key={i} width={i === 0 ? '20%' : '15%'} height={10} />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'flex', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: cols }, (_, c) => <SkeletonBar key={c} width={c === 0 ? '30%' : '20%'} height={12} />)}
        </div>
      ))}
    </div>
  )
}

export default function LoadingSkeleton({ type = 'cards', count = 6, rows = 5, cols = 5 }) {
  if (type === 'table') return <SkeletonTable rows={rows} cols={cols} />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(count, 6)}, 1fr)`, gap: 10 }}>
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}
