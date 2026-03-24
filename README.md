# Aisellence PMS

AI-powered Property Management System für unabhängige Hotels im DACH-Raum.

## Tech Stack

- **React 18** + Vite
- **Supabase** (Datenbank + Realtime WebSockets)
- **React Router** (SPA Navigation)
- **Vercel** (Deployment)

## Setup

### 1. Repository klonen

```bash
git clone https://github.com/freddyananou97-ops/aisellence-pms.git
cd aisellence-pms
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Environment Variables

Erstelle eine `.env.local` Datei:

```
VITE_SUPABASE_URL=https://niabwewrwezstpyefxup.supabase.co
VITE_SUPABASE_ANON_KEY=dein_anon_key_hier
```

### 4. Supabase Realtime aktivieren

Im Supabase Dashboard → Database → Replication → diese Tabellen aktivieren:
- bookings
- complaints
- maintenance
- service_requests
- shift_logs
- housekeeping
- feedback

### 5. Lokal starten

```bash
npm run dev
```

Öffne http://localhost:5173

### 6. Auf Vercel deployen

```bash
# Vercel CLI
npm i -g vercel
vercel

# Oder: Push to GitHub → Vercel auto-deploy
git push origin main
```

In Vercel: Settings → Environment Variables → die beiden VITE_ Variablen eintragen.

## Projekt-Struktur

```
aisellence-pms/
├── public/
│   └── favicon.svg          # Aisellence A-Icon
├── src/
│   ├── components/
│   │   ├── Logo.jsx          # Aisellence Logo
│   │   └── Sidebar.jsx       # Navigation Sidebar
│   ├── hooks/
│   │   └── useRealtime.js    # Supabase Realtime Hook
│   ├── lib/
│   │   └── supabase.js       # Supabase Client + Queries
│   ├── pages/
│   │   ├── Dashboard.jsx     # Haupt-Dashboard
│   │   ├── Login.jsx         # Login Screen
│   │   └── ComingSoon.jsx    # Platzhalter
│   ├── styles/
│   │   └── global.css        # Dark Theme
│   ├── App.jsx               # Router
│   └── main.jsx              # Entry Point
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vercel.json
└── vite.config.js
```

## Module Roadmap

- [x] Dashboard (KPIs, Zimmer, Check-ins, Schichtbuch, Konkurrenz, Events, Wetter)
- [ ] Buchungsverwaltung
- [ ] Reservierungskalender
- [ ] Gästedatenbank
- [ ] Rechnungen (ZUGFeRD API angebunden)
- [ ] Revenue Management
- [ ] Schichtbuch
- [ ] Zimmerübersicht
- [ ] Housekeeping
- [ ] Feedback

## Realtime

Das Dashboard aktualisiert sich automatisch via Supabase Realtime WebSockets.
Wenn Marco (WhatsApp Bot) eine Beschwerde oder Service-Anfrage empfängt,
erscheint sie sofort auf dem Dashboard — kein manuelles Neuladen nötig.
