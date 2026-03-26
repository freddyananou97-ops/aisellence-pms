/**
 * Badge Patterns — Status badges, category chips, and indicators.
 */

// Status badge (booking status, session status)
export function StatusBadge({ label, color }) {
  return (
    <span style={{
      fontSize: 10,
      padding: '3px 8px',
      borderRadius: 6,
      background: `${color}12`,
      color,
      fontWeight: 500,
      textAlign: 'center',
    }}>
      {label}
    </span>
  )
}

// Category badge with icon (service requests)
export function CategoryBadge({ label, color, icon }) {
  return (
    <span style={{
      fontSize: 10,
      padding: '2px 7px',
      borderRadius: 4,
      background: `${color}15`,
      color,
      fontWeight: 500,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
    }}>
      {icon}
      {label}
    </span>
  )
}

// Dot indicator (live status, realtime)
export function LiveDot({ color = '#10b981', pulse = true }) {
  return (
    <div style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: color,
      ...(pulse ? { animation: 'pulse 2s ease-in-out infinite' } : {}),
    }} />
  )
}

// Count badge (sidebar, card headers)
export function CountBadge({ count }) {
  return (
    <span style={{
      fontSize: 10,
      color: 'var(--textMuted)',
      background: 'var(--border)',
      padding: '2px 8px',
      borderRadius: 10,
    }}>
      {count}
    </span>
  )
}

/**
 * Usage Examples:
 *
 * <StatusBadge label="Reserviert" color="#3b82f6" />
 * <StatusBadge label="Eingecheckt" color="#10b981" />
 * <StatusBadge label="Storniert" color="#ef4444" />
 *
 * <CategoryBadge label="Room Service" color="#f59e0b" icon={<RoomServiceIcon />} />
 *
 * <LiveDot /> (green pulsing)
 * <LiveDot color="#ef4444" pulse={false} /> (red static)
 *
 * <CountBadge count={5} />
 */
