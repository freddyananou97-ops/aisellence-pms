# Aisellence PMS — Design System

## Color Palette

### Theme Colors (Dark Mode — Default)
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#080808` | Page background |
| `--bgSec` | `#0b0b0b` | Sidebar, secondary areas |
| `--bgCard` | `#0e0e0e` | Card backgrounds |
| `--border` | `#151515` | Dividers, table borders |
| `--borderLight` | `#1a1a1a` | Card borders, inputs |
| `--text` | `#ffffff` | Primary text |
| `--textSec` | `#cccccc` | Secondary text |
| `--textMuted` | `#888888` | Labels, timestamps |
| `--textDim` | `#444444` | Placeholder, disabled |

### Theme Colors (Light Mode)
| Token | Value |
|-------|-------|
| `--bg` | `#f5f5f7` |
| `--bgCard` | `#ffffff` |
| `--border` | `#e5e5e7` |
| `--text` | `#1a1a1a` |
| `--textMuted` | `#666666` |

### Accent Colors
| Name | Hex | Usage |
|------|-----|-------|
| Green | `#10b981` | Success, check-in, active |
| Blue | `#3b82f6` | Info, links, housekeeping |
| Purple | `#8b5cf6` | Spa, late checkout, concierge |
| Amber | `#f59e0b` | Warning, room service, pending |
| Red | `#ef4444` | Error, cancel, maintenance |
| Teal | `#14b8a6` | Luggage |
| Yellow | `#eab308` | Taxi |
| Dark Red | `#991b1b` | Complaints |
| Stripe | `#635bff` | Stripe payments |

### Service Request Category Colors
| Category | Color | Icon |
|----------|-------|------|
| Room Service | `#f59e0b` | Cloche/dome |
| Housekeeping | `#3b82f6` | House |
| Maintenance | `#ef4444` | Wrench |
| Taxi | `#eab308` | Car |
| Complaint | `#991b1b` | Warning triangle |
| Late Checkout | `#8b5cf6` | Clock |
| Luggage | `#14b8a6` | Suitcase |
| Wake-up | `#6b7280` | Alarm |

---

## Typography

- **Font**: `system-ui, -apple-system, 'Segoe UI', sans-serif`
- **Monospace**: `'SF Mono', 'Fira Code', monospace`

| Size | Pixels | Usage |
|------|--------|-------|
| xs | 9px | Badges, micro labels |
| sm | 11px | Secondary info, dates |
| base | 13px | Body text, inputs |
| md | 14px | Emphasized body |
| lg | 16px | Subheadings |
| xl | 18px | Section titles |
| 2xl | 22px | Page titles (h1) |
| 3xl | 32px | Welcome screen |
| 4xl | 42px | Login greeting |

| Weight | Value | Usage |
|--------|-------|-------|
| light | 300 | Large display text |
| normal | 400 | Body text |
| medium | 500 | Labels, card titles |
| semibold | 600 | Buttons, KPI values |
| bold | 700 | Emphasis (rare) |

---

## Spacing

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-6` | 24px |
| `--space-8` | 32px |

Standard content padding: `28px 32px`
Card padding: `16px 18px` (stat) or `20px 24px` (form)
Modal padding: `24px 28px`

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| sm | 4px | Badges, small chips |
| md | 8px | Buttons, inputs |
| lg | 10px | Tabs, large buttons |
| xl | 12px | Cards, containers |
| 2xl | 16px | Modals |
| full | 9999px | Pills, avatars |

---

## Z-Index Scale

| Layer | Value |
|-------|-------|
| Sidebar | 40 |
| Dropdown | 50 |
| Sticky header | 60 |
| Mobile nav | 80 |
| Mobile menu | 85 |
| Modal/Overlay | 100 |
| Toast | 110 |
| Login transition | 9999 |

---

## Component Patterns

### Modal
```jsx
<div style={{ position: 'fixed', inset: 0, background: 'var(--overlayBg)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
  <div style={{ background: 'var(--modalBg)', border: '1px solid var(--modalBorder)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Title</h3>
      <button onClick={onClose} style={{ background: 'var(--bgCard)', border: 'none', borderRadius: 8, width: 32, height: 32 }}>✕</button>
    </div>
    {/* Content */}
  </div>
</div>
```

### Card
```jsx
<div style={{ background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 12, overflow: 'hidden' }}>
  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Title</span>
  </div>
  <div>{/* Content */}</div>
</div>
```

### Button (Primary)
```jsx
<button style={{ padding: '10px 16px', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
  Action
</button>
```

### Badge
```jsx
<span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.08)', color: '#10b981', fontWeight: 500 }}>
  Status
</span>
```

### Input
```jsx
<label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textMuted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Label</label>
<input style={{ width: '100%', padding: '10px 14px', background: 'var(--inputBg)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
```

### Tab Bar
```jsx
<div style={{ display: 'flex', gap: 6 }}>
  {tabs.map(([k, l]) => (
    <button key={k} onClick={() => setTab(k)} style={{
      padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
      background: tab === k ? 'var(--text)' : 'var(--bgCard)',
      color: tab === k ? 'var(--bg)' : 'var(--textMuted)',
      border: `1px solid ${tab === k ? 'var(--text)' : 'var(--borderLight)'}`,
    }}>{l}</button>
  ))}
</div>
```

### Date Navigation
```jsx
<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
  <button onClick={prevDay} style={navBtn}>←</button>
  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '5px 10px', background: 'var(--bgCard)', border: '1px solid var(--borderLight)', borderRadius: 8, fontSize: 11, color: 'var(--text)' }} />
  <button onClick={goToday} style={{ ... }}>Heute</button>
  <button onClick={nextDay} style={navBtn}>→</button>
</div>
```

---

## Icons

All icons are inline SVGs with stroke-based rendering (no emoji, no icon font):
- **Size**: 12-15px for inline, 20-28px for feature icons, 36-48px for status icons
- **Stroke**: `strokeWidth="1.5"` (normal) or `"2"` (emphasis)
- **Colors**: Inherit from parent or use accent color
- **Style**: Lucide-compatible paths with `strokeLinecap="round" strokeLinejoin="round"`

---

## Animations

| Name | Duration | Usage |
|------|----------|-------|
| `fadeIn` | 0.3s | Page/modal enter |
| `pulse` | 2s infinite | Live indicators, loading |
| `skeleton-pulse` | 1.5s infinite | Loading skeletons |

---

## Responsive Breakpoints

| Breakpoint | Target |
|------------|--------|
| 768px | Mobile/tablet switch (sidebar → bottom nav) |

---

## File Structure

```
src/
  components/       Shared UI components
    ConfirmDialog   Modal confirmation with warning
    ErrorBoundary   Catches JS errors per page
    LoadingSkeleton Pulse-animated loading placeholders
    Logo            SVG logo component
    QRCode          Local QR code via canvas
    SignatureCanvas Touch-enabled signature pad
    Sidebar         Navigation + theme/tier switch
    CheckoutWizard  5-step checkout flow
  hooks/
    useModalClose   ESC key handler for modals
    useNotifications Audio + browser notifications
    useRealtime     Supabase realtime subscriptions
  lib/
    audit           Audit logging helper
    auth            PIN hashing + login
    beds24          Beds24 channel manager API
    checkout        Shared checkout logic
    export          CSV export helper
    hotel           Hotel config (from DB with fallback)
    invoice         Invoice HTML generation
    menu            Restaurant/room service menu
    nationalities   Country lists for guest display
    pricing         Rate rule resolution
    print           Print-ready HTML page builder
    roles           Role-based access control
    stripe          Stripe Checkout integration
    supabase        Supabase client + queries
    theme           Dark/light theme provider
    tier            PMS/Concierge tier provider
    translations    DE/EN translations for guest display
    zindex          Centralized z-index constants
```
