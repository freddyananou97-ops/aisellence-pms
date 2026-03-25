/**
 * Simple QR Code component using the Google Charts QR API.
 * For a production app, replace with a client-side library like qrcode.react.
 * This approach works without any npm dependency.
 */
export default function QRCode({ value, size = 200 }) {
  if (!value) return null
  const encoded = encodeURIComponent(value)
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <img src={src} alt="QR Code" width={size} height={size} style={{ borderRadius: 12, background: '#fff' }} />
      <span style={{ fontSize: 10, color: '#9ca3af', maxWidth: size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        Mit Handy scannen um zu bezahlen
      </span>
    </div>
  )
}
